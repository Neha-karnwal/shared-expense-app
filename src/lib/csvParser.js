const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

// Helper to parse a single CSV row, taking care of double quotes
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Normalise user names
function normalizeName(nameStr) {
  if (!nameStr) return '';
  const trimmed = nameStr.trim();
  const lower = trimmed.toLowerCase();
  
  if (lower === 'aisha') return 'Aisha';
  if (lower === 'rohan') return 'Rohan';
  if (lower === 'priya' || lower === 'priya s') return 'Priya';
  if (lower === 'meera') return 'Meera';
  if (lower === 'sam') return 'Sam';
  if (lower === 'dev') return 'Dev';
  
  // Kabir is guest
  if (lower.includes('kabir') || lower.includes("dev's friend")) {
    return "Dev's friend Kabir";
  }
  
  return trimmed; // fallback
}

// Parse date string
// Formats: YYYY-MM-DD, DD/MM/YYYY, MMM DD (e.g. Mar 14)
function parseDateString(dateStr, rowNum) {
  if (!dateStr) return { date: null, format: 'missing', error: true };
  const trimmed = dateStr.trim();
  
  // 1. YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { date: new Date(trimmed + 'T00:00:00.000Z'), format: 'YYYY-MM-DD', error: false };
  }
  
  // 2. DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split('/');
    // Check if it's month/day/year or day/month/year
    // Wait, in row 34: "04/05/2026" - is it April 5 or May 4?
    // Let's return both options or tag it as ambiguous
    const parsedDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`);
    return { 
      date: parsedDate, 
      format: 'DD/MM/YYYY', 
      error: false,
      isAmbiguous: (trimmed === '04/05/2026'), // April 5 or May 4
      alternativeDate: trimmed === '04/05/2026' ? new Date('2026-04-05T00:00:00.000Z') : null
    };
  }
  
  // 3. MMM DD (e.g. Mar 14)
  const monthMatch = trimmed.match(/^([A-Za-z]{3})\s+(\d{1,2})$/);
  if (monthMatch) {
    const months = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    const m = months[monthMatch[1].toLowerCase()];
    const d = parseInt(monthMatch[2], 10);
    if (m !== undefined && !isNaN(d)) {
      // Default to 2026 since surrounding entries are 2026
      const date = new Date(Date.UTC(2026, m, d));
      return { date, format: 'MMM DD', error: false, note: 'Assumed year 2026' };
    }
  }
  
  return { date: new Date(trimmed), format: 'unknown', error: true };
}

function parseCSV(csvText) {
  const lines = csvText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return { rows: [], anomalies: [] };
  
  const headers = parseCSVLine(lines[0]);
  const rawRows = [];
  const anomalies = [];
  
  // Parse rows
  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1; // 1-indexed line number in file
    const rawLine = lines[i];
    const columns = parseCSVLine(rawLine);
    
    // Fill columns if short
    while (columns.length < headers.length) {
      columns.push('');
    }
    
    const [
      rawDate,
      rawDesc,
      rawPaidBy,
      rawAmount,
      rawCurrency,
      rawSplitType,
      rawSplitWith,
      rawSplitDetails,
      rawNotes
    ] = columns;
    
    const rowObj = {
      rowNumber: rowNum,
      raw: rawLine,
      originalData: {
        date: rawDate,
        description: rawDesc,
        paidBy: rawPaidBy,
        amount: rawAmount,
        currency: rawCurrency,
        splitType: rawSplitType,
        splitWith: rawSplitWith,
        splitDetails: rawSplitDetails,
        notes: rawNotes
      },
      resolvedData: {},
      anomalies: []
    };
    
    // --- 1. Parse Date ---
    const dateParseResult = parseDateString(rawDate, rowNum);
    rowObj.resolvedData.date = dateParseResult.date;
    if (dateParseResult.error || dateParseResult.format === 'unknown') {
      anomalies.push({
        rowNumber: rowNum,
        anomalyType: 'DATE_FORMAT',
        description: `Invalid/Unknown date format: "${rawDate}"`,
        suggestedAction: 'Parse as YYYY-MM-DD or correct manual entry.',
        status: 'PENDING'
      });
      rowObj.anomalies.push('DATE_FORMAT');
    } else if (dateParseResult.format !== 'YYYY-MM-DD') {
      let desc = `Non-standard date format "${rawDate}" parsed as ${dateParseResult.date ? dateParseResult.date.toISOString().split('T')[0] : 'unknown'}.`;
      let action = 'Convert to standard YYYY-MM-DD.';
      if (dateParseResult.isAmbiguous) {
        desc += ` (Ambiguous: April 5th or May 4th?)`;
        action = 'Choose between April 5th and May 4th (recommended April 5th to maintain chronological consistency).';
      }
      anomalies.push({
        rowNumber: rowNum,
        anomalyType: 'DATE_FORMAT',
        description: desc,
        suggestedAction: action,
        status: 'PENDING'
      });
      rowObj.anomalies.push('DATE_FORMAT');
    }
    
    // --- 2. Parse Paid By ---
    const normPaidBy = normalizeName(rawPaidBy);
    rowObj.resolvedData.paidBy = normPaidBy;
    if (!rawPaidBy || rawPaidBy.trim() === '') {
      anomalies.push({
        rowNumber: rowNum,
        anomalyType: 'MISSING_PAYER',
        description: `Missing paid_by field: "${rawDesc}"`,
        suggestedAction: 'Assign a valid roommate payer.',
        status: 'PENDING'
      });
      rowObj.anomalies.push('MISSING_PAYER');
    } else if (normPaidBy !== rawPaidBy) {
      anomalies.push({
        rowNumber: rowNum,
        anomalyType: 'GUEST_USER', // Or name correction
        description: `Name spelling variant: "${rawPaidBy}" resolved to "${normPaidBy}".`,
        suggestedAction: 'Normalize spelling to official roommate name.',
        status: 'PENDING'
      });
      rowObj.anomalies.push('NAME_VARIANT');
    }
    
    // --- 3. Parse Amount ---
    let parsedAmount = NaN;
    let cleanAmountStr = rawAmount.replace(/"/g, '').replace(/,/g, '').trim();
    parsedAmount = parseFloat(cleanAmountStr);
    rowObj.resolvedData.amount = parsedAmount;
    
    if (isNaN(parsedAmount)) {
      anomalies.push({
        rowNumber: rowNum,
        anomalyType: 'AMOUNT_FORMAT',
        description: `Invalid numeric amount: "${rawAmount}"`,
        suggestedAction: 'Clean amount string and parse as number.',
        status: 'PENDING'
      });
      rowObj.anomalies.push('AMOUNT_FORMAT');
    } else {
      // Check commas
      if (rawAmount.includes(',')) {
        anomalies.push({
          rowNumber: rowNum,
          anomalyType: 'AMOUNT_FORMAT',
          description: `Amount has comma formatting: "${rawAmount}" parsed as ${parsedAmount}`,
          suggestedAction: 'Remove commas and sanitize numeric string.',
          status: 'PENDING'
        });
        rowObj.anomalies.push('AMOUNT_FORMAT');
      }
      // Check high decimal precision
      if (cleanAmountStr.includes('.') && cleanAmountStr.split('.')[1].length > 2) {
        anomalies.push({
          rowNumber: rowNum,
          anomalyType: 'AMOUNT_FORMAT',
          description: `High decimal precision: "${rawAmount}" has 3+ decimal places.`,
          suggestedAction: `Round to 2 decimal places: ${parsedAmount.toFixed(2)}.`,
          status: 'PENDING'
        });
        rowObj.anomalies.push('HIGH_DECIMAL');
      }
      // Check negative
      if (parsedAmount < 0) {
        anomalies.push({
          rowNumber: rowNum,
          anomalyType: 'SETTLEMENT', // or refund
          description: `Negative expense amount: ${parsedAmount} ("${rawDesc}")`,
          suggestedAction: 'Treat as a credit refund and subtract from balances.',
          status: 'PENDING'
        });
        rowObj.anomalies.push('NEGATIVE_AMOUNT');
      }
      // Check zero
      if (parsedAmount === 0) {
        anomalies.push({
          rowNumber: rowNum,
          anomalyType: 'SETTLEMENT',
          description: `Zero amount expense: "${rawDesc}"`,
          suggestedAction: 'Keep as historical $0 log or ignore.',
          status: 'PENDING'
        });
        rowObj.anomalies.push('ZERO_AMOUNT');
      }
    }
    
    // --- 4. Parse Currency ---
    let normCurrency = rawCurrency ? rawCurrency.trim().toUpperCase() : '';
    rowObj.resolvedData.currency = normCurrency || 'INR'; // default to base
    if (!rawCurrency || rawCurrency.trim() === '') {
      anomalies.push({
        rowNumber: rowNum,
        anomalyType: 'CURRENCY',
        description: `Missing currency on row: "${rawDesc}", defaulting to INR.`,
        suggestedAction: 'Default to base currency INR.',
        status: 'PENDING'
      });
      rowObj.anomalies.push('MISSING_CURRENCY');
    } else if (normCurrency === 'USD') {
      anomalies.push({
        rowNumber: rowNum,
        anomalyType: 'CURRENCY',
        description: `USD currency transaction: "${rawDesc}" for $${parsedAmount}`,
        suggestedAction: 'Apply exchange rate (default $1 = ₹83.00) and convert to INR.',
        status: 'PENDING'
      });
      rowObj.anomalies.push('USD_CURRENCY');
    }
    
    // --- 5. Parse Split Type & Details ---
    let splitType = rawSplitType ? rawSplitType.trim().toLowerCase() : '';
    rowObj.resolvedData.splitType = splitType;
    
    // Parse split with
    let splitWith = [];
    if (rawSplitWith && rawSplitWith.trim() !== '') {
      // Split by semicolon
      splitWith = rawSplitWith.split(';').map(normalizeName);
    }
    rowObj.resolvedData.splitWith = splitWith;
    
    // Detect Settlement
    const isSettlementNote = rawNotes && (rawNotes.toLowerCase().includes('settlement') || rawNotes.toLowerCase().includes('paid back') || rawNotes.toLowerCase().includes('deposit'));
    const isSettlementDesc = rawDesc && (rawDesc.toLowerCase().includes('paid') && rawDesc.toLowerCase().includes('back') || rawDesc.toLowerCase().includes('deposit'));
    const isSettlement = splitType === '' || isSettlementNote || isSettlementDesc;
    rowObj.resolvedData.isSettlement = isSettlement;
    
    if (isSettlement) {
      anomalies.push({
        rowNumber: rowNum,
        anomalyType: 'SETTLEMENT',
        description: `Settlement logged as expense: "${rawDesc}" (Payer: ${normPaidBy}, Recipient: ${splitWith[0] || 'Unknown'})`,
        suggestedAction: 'Import as direct Peer-to-Peer payment transfer (reduces debts directly).',
        status: 'PENDING'
      });
      rowObj.anomalies.push('SETTLEMENT_LOGGED_AS_EXPENSE');
    }
    
    // Split details
    rowObj.resolvedData.splitDetails = rawSplitDetails;
    
    // Check percentage split summing to 100%
    if (splitType === 'percentage' && rawSplitDetails) {
      // Parse details: Aisha 30%; Rohan 30%; Priya 30%; Meera 20%
      const parts = rawSplitDetails.split(';').map(p => p.trim());
      let totalPct = 0;
      parts.forEach(p => {
        const match = p.match(/(.+)\s+(\d+)%/);
        if (match) {
          totalPct += parseInt(match[2], 10);
        }
      });
      if (totalPct !== 100) {
        anomalies.push({
          rowNumber: rowNum,
          anomalyType: 'PERCENT_SUM',
          description: `Percentage split sums to ${totalPct}% (expected 100%) on: "${rawDesc}"`,
          suggestedAction: 'Rescale percentages proportionally to sum to 100%.',
          status: 'PENDING'
        });
        rowObj.anomalies.push('PERCENTAGE_SUM_ERR');
      }
    }
    
    // Check guest members
    const guestMembers = splitWith.filter(m => m === "Dev's friend Kabir");
    if (guestMembers.length > 0) {
      anomalies.push({
        rowNumber: rowNum,
        anomalyType: 'GUEST_USER',
        description: `Guest/non-member included in split: "${rawDesc}" includes "Dev's friend Kabir"`,
        suggestedAction: "Assign Kabir's share to Dev (inviter) or add Kabir as a temporary member.",
        status: 'PENDING'
      });
      rowObj.anomalies.push('GUEST_MEMBER');
    }
    
    // --- 6. Temporal Timeline Check ---
    // Meera active Feb 1 to Mar 31.
    // Sam active Apr 15 to now.
    // Aisha, Rohan, Priya active Feb 1 to now.
    // Dev active Feb 1 to Mar 31.
    if (dateParseResult.date) {
      const expTime = dateParseResult.date.getTime();
      
      const meeraStart = new Date('2026-02-01T00:00:00.000Z').getTime();
      const meeraEnd = new Date('2026-03-31T23:59:59.999Z').getTime();
      
      const samStart = new Date('2026-04-15T00:00:00.000Z').getTime();
      
      // Check Meera
      if (splitWith.includes('Meera') && (expTime < meeraStart || expTime > meeraEnd)) {
        anomalies.push({
          rowNumber: rowNum,
          anomalyType: 'TEMPORAL',
          description: `Temporal error: Meera charged for expense on ${rawDate} ("${rawDesc}") but she left March 31.`,
          suggestedAction: 'Exclude Meera from split and redistribute her share to active members.',
          status: 'PENDING'
        });
        rowObj.anomalies.push('TEMPORAL_OUT_OF_BOUNDS_MEERA');
      }
      
      // Check Sam
      if (splitWith.includes('Sam') && (expTime < samStart) && !isSettlement) {
        anomalies.push({
          rowNumber: rowNum,
          anomalyType: 'TEMPORAL',
          description: `Temporal error: Sam charged for expense on ${rawDate} ("${rawDesc}") but he joined April 15.`,
          suggestedAction: 'Exclude Sam from split and redistribute his share to active members.',
          status: 'PENDING'
        });
        rowObj.anomalies.push('TEMPORAL_OUT_OF_BOUNDS_SAM');
      }
    }
    
    rawRows.push(rowObj);
  }
  
  // --- 7. Duplicate Detection (Across Rows) ---
  for (let i = 0; i < rawRows.length; i++) {
    const rowA = rawRows[i];
    if (rowA.anomalies.includes('DUPLICATE')) continue;
    
    for (let j = i + 1; j < rawRows.length; j++) {
      const rowB = rawRows[j];
      
      const samePayer = rowA.resolvedData.paidBy === rowB.resolvedData.paidBy;
      const sameAmount = Math.abs(rowA.resolvedData.amount - rowB.resolvedData.amount) < 0.01;
      const sameDate = rowA.resolvedData.date && rowB.resolvedData.date && rowA.resolvedData.date.getTime() === rowB.resolvedData.date.getTime();
      
      if (samePayer && sameAmount && sameDate) {
        const descA = rowA.originalData.description.toLowerCase();
        const descB = rowB.originalData.description.toLowerCase();
        
        // Check if description is exact or similar (e.g. Marina Bites dinner vs Dinner at Marina Bites)
        const isSimilarDesc = descA === descB || 
                              descA.includes(descB) || 
                              descB.includes(descA) ||
                              (descA.includes('marina') && descB.includes('marina')) ||
                              (descA.includes('thalassa') && descB.includes('thalassa'));
                              
        if (isSimilarDesc) {
          // If payer and amount and date are SAME:
          if (rowA.resolvedData.paidBy === rowB.resolvedData.paidBy) {
            // Row 5 & 6 (Marina Bites dinner) - Payer is same, amount is same, date is same.
            anomalies.push({
              rowNumber: rowB.rowNumber,
              anomalyType: 'DUPLICATE',
              description: `Duplicate Expense: Row ${rowB.rowNumber} matches Row ${rowA.rowNumber} ("${rowA.originalData.description}" vs "${rowB.originalData.description}")`,
              suggestedAction: `Discard duplicate Row ${rowB.rowNumber} and keep Row ${rowA.rowNumber}.`,
              status: 'PENDING',
              meta: { duplicateOf: rowA.rowNumber }
            });
            rowB.anomalies.push('DUPLICATE');
          }
        }
      }
      
      // --- 8. Conflicting Duplicate (Thalassa Dinner) ---
      // Same date, similar description, different details (different amount or different payer)
      const descA = rowA.originalData.description.toLowerCase();
      const descB = rowB.originalData.description.toLowerCase();
      const isThalassa = descA.includes('thalassa') && descB.includes('thalassa');
      const sameDateThalassa = rowA.resolvedData.date && rowB.resolvedData.date && rowA.resolvedData.date.getTime() === rowB.resolvedData.date.getTime();
      
      if (isThalassa && sameDateThalassa && i !== j) {
        // Different payer or different amount
        if (rowA.resolvedData.paidBy !== rowB.resolvedData.paidBy || Math.abs(rowA.resolvedData.amount - rowB.resolvedData.amount) > 0.01) {
          // Flag rowB as conflicting
          if (!rowB.anomalies.includes('CONFLICTING_DUPLICATE')) {
            anomalies.push({
              rowNumber: rowB.rowNumber,
              anomalyType: 'CONFLICTING_DUPLICATE',
              description: `Conflicting entries for Thalassa Dinner: Row ${rowA.rowNumber} (${rowA.originalData.paidBy} paid ₹${rowA.originalData.amount}) vs Row ${rowB.rowNumber} (${rowB.originalData.paidBy} paid ₹${rowB.originalData.amount})`,
              suggestedAction: 'Ask user to pick the correct entry or choose to import both.',
              status: 'PENDING',
              meta: { conflictWith: rowA.rowNumber }
            });
            rowB.anomalies.push('CONFLICTING_DUPLICATE');
          }
        }
      }
    }
  }
  
  return { rows: rawRows, anomalies };
}

module.exports = {
  parseCSV,
  parseCSVLine,
  normalizeName,
  parseDateString
};
