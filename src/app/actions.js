'use server';

import { loginUser, logoutUser, getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db';
import { simplifyDebts } from '@/lib/splitwise';
import { revalidatePath } from 'next/cache';

/**
 * Handle user login
 */
export async function handleLogin(formData) {
  const username = formData.get('username')?.trim();
  const password = formData.get('password');
  
  if (!username || !password) {
    return { error: 'Please enter both username and password' };
  }
  
  const res = await loginUser(username, password);
  if (res.success) {
    redirect('/');
  } else {
    return { error: res.error || 'Authentication failed' };
  }
}

/**
 * Handle user logout
 */
export async function handleLogout() {
  await logoutUser();
  redirect('/login');
}

/**
 * Get dashboard data for the main group
 */
export async function getDashboardData() {
  const user = await getCurrentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  // Find the first group (Cozy Flat 404)
  const group = await prisma.group.findFirst({
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true }
          }
        }
      }
    }
  });

  if (!group) {
    return { error: 'No groups found' };
  }

  // Fetch all expenses in this group
  const expenses = await prisma.expense.findMany({
    where: { groupId: group.id },
    include: {
      paidBy: { select: { id: true, name: true } },
      splits: {
        include: {
          user: { select: { id: true, name: true } }
        }
      }
    },
    orderBy: { date: 'asc' }
  });

  // Calculate balances
  // Net balance = (total paid by user) - (total user's share of all expenses)
  const memberBalances = {};
  const memberNames = {};
  
  // Initialize balances for all group members (and any users who participated)
  group.members.forEach(m => {
    memberBalances[m.user.id] = 0;
    memberNames[m.user.id] = m.user.name;
  });

  expenses.forEach(exp => {
    const amount = exp.amount;
    const paidById = exp.paidById;
    
    // Ensure payer is initialized
    if (memberBalances[paidById] === undefined) {
      memberBalances[paidById] = 0;
    }
    
    // Credit the payer
    memberBalances[paidById] += amount;
    
    // Debit split participants
    exp.splits.forEach(split => {
      const uId = split.userId;
      if (memberBalances[uId] === undefined) {
        memberBalances[uId] = 0;
      }
      memberBalances[uId] -= split.amount;
    });
  });

  // Map balances to readable objects
  const balancesArray = Object.keys(memberBalances).map(uId => {
    const name = memberNames[uId] || 'Unknown User';
    return {
      userId: uId,
      name,
      balance: Math.round(memberBalances[uId] * 100) / 100
    };
  });

  // Simplify debts
  // Map ID balances to name balances for the simplification algorithm
  const nameBalances = {};
  balancesArray.forEach(b => {
    nameBalances[b.name] = b.balance;
  });

  const simplifiedPayments = simplifyDebts(nameBalances);

  return {
    currentUser: user,
    group,
    expenses,
    balances: balancesArray,
    simplifiedPayments
  };
}

/**
 * Get detailed transaction ledger for a specific user (Rohan's view)
 */
export async function getUserLedger(userId) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  // Fetch target user details
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true }
  });

  if (!targetUser) {
    return { error: 'User not found' };
  }

  // Fetch all expenses in the group
  const expenses = await prisma.expense.findMany({
    include: {
      paidBy: { select: { id: true, name: true } },
      splits: {
        include: {
          user: { select: { id: true, name: true } }
        }
      }
    },
    orderBy: { date: 'desc' }
  });

  // Filter expenses where target user was the payer OR a split participant
  const ledgerEntries = [];
  let calculatedBalance = 0;

  expenses.forEach(exp => {
    const isPayer = exp.paidById === userId;
    const userSplit = exp.splits.find(s => s.userId === userId);
    const inSplit = !!userSplit;

    if (isPayer || inSplit) {
      const paidAmount = isPayer ? exp.amount : 0;
      const oweAmount = inSplit ? userSplit.amount : 0;
      const netEffect = paidAmount - oweAmount;
      calculatedBalance += netEffect;

      ledgerEntries.push({
        id: exp.id,
        date: exp.date,
        description: exp.description,
        isSettlement: exp.isSettlement,
        originalAmount: exp.originalAmount,
        originalCurrency: exp.originalCurrency,
        exchangeRate: exp.exchangeRate,
        paidBy: exp.paidBy.name,
        isPayer,
        inSplit,
        totalAmount: exp.amount,
        paidAmount: Math.round(paidAmount * 100) / 100,
        oweAmount: Math.round(oweAmount * 100) / 100,
        netEffect: Math.round(netEffect * 100) / 100,
        notes: exp.notes
      });
    }
  });

  return {
    targetUser,
    ledger: ledgerEntries,
    totalBalance: Math.round(calculatedBalance * 100) / 100
  };
}

/**
 * Add a manual expense
 */
export async function handleAddExpense(expenseData) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  const {
    groupId,
    description,
    amount,
    currency,
    exchangeRate,
    paidById,
    splitType,
    date,
    notes,
    isSettlement,
    splits // Array of { userId, shareVal }
  } = expenseData;

  try {
    const convertedAmount = amount * exchangeRate;
    
    // Create the expense
    const newExpense = await prisma.expense.create({
      data: {
        groupId,
        description,
        amount: convertedAmount,
        originalAmount: amount,
        originalCurrency: currency,
        exchangeRate,
        paidById,
        splitType,
        date: new Date(date),
        notes,
        isSettlement: !!isSettlement
      }
    });

    // Calculate individual split amounts based on splitType
    let splitsToSave = [];
    if (splitType === 'equal') {
      const perPerson = convertedAmount / splits.length;
      splitsToSave = splits.map(s => ({
        expenseId: newExpense.id,
        userId: s.userId,
        amount: perPerson,
        shareVal: null
      }));
    } else if (splitType === 'unequal') {
      splitsToSave = splits.map(s => ({
        expenseId: newExpense.id,
        userId: s.userId,
        amount: s.shareVal * exchangeRate,
        shareVal: s.shareVal
      }));
    } else if (splitType === 'percentage') {
      splitsToSave = splits.map(s => ({
        expenseId: newExpense.id,
        userId: s.userId,
        amount: (convertedAmount * s.shareVal) / 100,
        shareVal: s.shareVal
      }));
    } else if (splitType === 'share') {
      const totalShares = splits.reduce((sum, s) => sum + s.shareVal, 0);
      splitsToSave = splits.map(s => ({
        expenseId: newExpense.id,
        userId: s.userId,
        amount: (convertedAmount * s.shareVal) / totalShares,
        shareVal: s.shareVal
      }));
    }

    // Save splits
    for (const split of splitsToSave) {
      await prisma.expenseSplit.create({
        data: split
      });
    }

    revalidatePath('/');
    return { success: true, expense: newExpense };
  } catch (error) {
    console.error('Error adding expense:', error);
    return { error: 'Failed to save expense to database' };
  }
}

/**
 * Save CSV Import Data after resolutions
 */
export async function handleSaveImport(importData) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  const { filename, resolvedRows, anomalies } = importData;

  try {
    // 1. Get default group
    const group = await prisma.group.findFirst();
    if (!group) return { error: 'No group available to import into.' };

    // 2. Fetch all users from DB to map names to IDs
    const dbUsers = await prisma.user.findMany();
    const userMap = {};
    dbUsers.forEach(u => {
      userMap[u.name] = u.id;
    });

    // 3. Create ImportReport
    const report = await prisma.importReport.create({
      data: {
        filename
      }
    });

    // 4. Save anomalies log
    for (const a of anomalies) {
      await prisma.importAnomaly.create({
        data: {
          reportId: report.id,
          rowNumber: a.rowNumber,
          anomalyType: a.anomalyType,
          description: a.description,
          suggestedAction: a.suggestedAction,
          resolvedAction: a.resolvedAction || 'Applied default rules',
          status: 'RESOLVED'
        }
      });
    }

    // 5. Save the resolved rows
    for (const r of resolvedRows) {
      // Check if this row is marked to be ignored/deleted
      if (r.action === 'IGNORE') continue;

      const payerId = userMap[r.paidBy];
      if (!payerId) {
        console.warn(`Skipping row ${r.rowNumber} due to missing payer: ${r.paidBy}`);
        continue;
      }

      // Create expense record
      const expense = await prisma.expense.create({
        data: {
          groupId: group.id,
          description: r.description,
          amount: r.amount, // base currency INR
          originalAmount: r.originalAmount,
          originalCurrency: r.originalCurrency,
          exchangeRate: r.exchangeRate,
          paidById: payerId,
          splitType: r.splitType || 'equal',
          date: new Date(r.date),
          notes: r.notes || `Imported from CSV row ${r.rowNumber}`,
          isSettlement: !!r.isSettlement
        }
      });

      // Save split entries
      // r.splits is an array of { name, amount, shareVal }
      for (const split of r.splits) {
        const splitUserId = userMap[split.name];
        if (!splitUserId) {
          console.warn(`Payer or split member ${split.name} not found in DB, skipping split`);
          continue;
        }

        await prisma.expenseSplit.create({
          data: {
            expenseId: expense.id,
            userId: splitUserId,
            amount: split.amount,
            shareVal: split.shareVal
          }
        });
      }
    }

    revalidatePath('/');
    return { success: true, reportId: report.id };
  } catch (error) {
    console.error('Error committing CSV import:', error);
    return { error: 'Failed to commit CSV data to database: ' + error.message };
  }
}

/**
 * Fetch a list of all import reports
 */
export async function getImportReports() {
  return prisma.importReport.findMany({
    include: {
      anomalies: true
    },
    orderBy: {
      runAt: 'desc'
    }
  });
}
