/**
 * Greedy Min-Transfers Algorithm (Splitwise-like)
 * Calculates the minimum number of transactions needed to settle all debts.
 * 
 * @param {Object} balances - Object containing { name: netBalance }
 * @returns {Array} - Array of transaction objects { from, to, amount }
 */
function simplifyDebts(balances) {
  const debtors = [];
  const creditors = [];

  // Categorise users into debtors and creditors
  for (const [user, balance] of Object.entries(balances)) {
    // Round to 2 decimal places to handle float precision issues
    const rounded = Math.round(balance * 100) / 100;
    if (rounded < -0.01) {
      debtors.push({ user, balance: rounded });
    } else if (rounded > 0.01) {
      creditors.push({ user, balance: rounded });
    }
  }

  // Sort debtors ascending (most negative first)
  debtors.sort((a, b) => a.balance - b.balance);
  // Sort creditors descending (largest credit first)
  creditors.sort((a, b) => b.balance - a.balance);

  const transactions = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const debitVal = -debtor.balance;
    const creditVal = creditor.balance;
    
    // Determine transfer amount
    const amount = Math.min(debitVal, creditVal);
    const roundedAmount = Math.round(amount * 100) / 100;

    if (roundedAmount > 0.01) {
      transactions.push({
        from: debtor.user,
        to: creditor.user,
        amount: roundedAmount,
      });
    }

    // Update balances
    debtor.balance += amount;
    creditor.balance -= amount;

    // Advance pointers if fully settled
    if (Math.abs(debtor.balance) < 0.01) {
      dIdx++;
    }
    if (Math.abs(creditor.balance) < 0.01) {
      cIdx++;
    }
  }

  return transactions;
}

module.exports = {
  simplifyDebts,
};
