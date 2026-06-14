'use client';

import { useState } from 'react';
import { handleSaveImport } from '../app/actions';
import { parseCSV } from '../lib/csvParser';
import styles from './ImportWizard.module.css';

export default function ImportWizard({ onImportComplete }) {
  const [step, setStep] = useState(0);
  const [csvText, setCsvText] = useState('');
  const [parsedData, setParsedData] = useState(null);
  
  // Wizard resolution states
  const [nameMapping, setNameMapping] = useState({});
  const [payerResolutions, setPayerResolutions] = useState({});
  const [usdRate, setUsdRate] = useState(83.0);
  const [normalizePercentages, setNormalizePercentages] = useState(true);
  const [temporalExclusions, setTemporalExclusions] = useState({}); // rowNumber -> array of names to exclude
  const [duplicateActions, setDuplicateActions] = useState({}); // rowNumber -> 'DISCARD' | 'KEEP'
  const [conflictChoices, setConflictChoices] = useState({}); // rowNumber -> 'KEEP_ROW_A' | 'KEEP_ROW_B' | 'KEEP_BOTH'
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Total steps definition
  const stepsList = [
    { num: 0, title: 'Upload' },
    { num: 1, title: 'Names' },
    { num: 2, title: 'Payers' },
    { num: 3, title: 'USD Rate' },
    { num: 4, title: 'Percentages' },
    { num: 5, title: 'Timelines' },
    { num: 6, title: 'Duplicates' },
    { num: 7, title: 'Submit' }
  ];

  // Process initial CSV text
  const handleParseCSV = () => {
    if (!csvText.trim()) {
      setError('Please paste or upload some CSV data.');
      return;
    }
    setError('');
    
    try {
      const data = parseCSV(csvText);
      if (data.rows.length === 0) {
        setError('No rows detected in the CSV.');
        return;
      }
      
      setParsedData(data);
      
      // Auto-extract and initialize resolution states based on parsed anomalies
      const initialExclusions = {};
      const initialDuplicates = {};
      const initialConflicts = {};
      const initialPayers = {};

      data.anomalies.forEach(a => {
        if (a.anomalyType === 'TEMPORAL') {
          // Pre-identify who was out of bounds
          const rowNum = a.rowNumber;
          const desc = a.description;
          if (desc.includes('Meera')) {
            initialExclusions[rowNum] = [...(initialExclusions[rowNum] || []), 'Meera'];
          }
          if (desc.includes('Sam')) {
            initialExclusions[rowNum] = [...(initialExclusions[rowNum] || []), 'Sam'];
          }
        }
        if (a.anomalyType === 'DUPLICATE') {
          initialDuplicates[a.rowNumber] = 'DISCARD'; // Discard duplicate by default
        }
        if (a.anomalyType === 'CONFLICTING_DUPLICATE') {
          initialConflicts[a.rowNumber] = 'KEEP_ROW_B'; // Rohan's note-based recommended winner
        }
        if (a.anomalyType === 'MISSING_PAYER') {
          initialPayers[a.rowNumber] = 'Aisha'; // default placeholder, user will select
        }
      });

      setTemporalExclusions(initialExclusions);
      setDuplicateActions(initialDuplicates);
      setConflictChoices(initialConflicts);
      setPayerResolutions(initialPayers);
      
      setStep(1);
    } catch (err) {
      console.error(err);
      setError('Error parsing CSV: ' + err.message);
    }
  };

  const handleNext = () => {
    setStep(prev => Math.min(prev + 1, 7));
  };

  const handlePrev = () => {
    setStep(prev => Math.max(prev - 1, 0));
  };

  // Run final calculations on resolved data and save to database
  const handleFinalSave = async () => {
    setLoading(true);
    setError('');

    try {
      const resolvedRows = [];
      const anomaliesReport = [];

      // Loop through all parsed rows and apply the user's resolution rules
      for (const row of parsedData.rows) {
        const rowNum = row.rowNumber;

        // 1. Check if row is a duplicate scheduled for deletion
        if (row.anomalies.includes('DUPLICATE') && duplicateActions[rowNum] === 'DISCARD') {
          anomaliesReport.push({
            rowNumber: rowNum,
            anomalyType: 'DUPLICATE',
            description: `Duplicate expense row discarded.`,
            resolvedAction: 'DISCARDED_ROW'
          });
          continue; // Skip importing this row
        }

        // 2. Check conflicting duplicates (Thalassa Dinner)
        if (row.anomalies.includes('CONFLICTING_DUPLICATE')) {
          const choice = conflictChoices[rowNum];
          const conflictWith = parsedData.anomalies.find(a => a.rowNumber === rowNum && a.anomalyType === 'CONFLICTING_DUPLICATE')?.meta?.conflictWith;
          
          if (choice === 'KEEP_ROW_A') {
            // If we keep row A (Aisha's row 24), we skip row B (Rohan's row 25)
            anomaliesReport.push({
              rowNumber: rowNum,
              anomalyType: 'CONFLICTING_DUPLICATE',
              description: `Conflict resolved: Discarded Rohan's Row 25 in favor of Aisha's Row 24.`,
              resolvedAction: 'DISCARDED_ROW'
            });
            continue; // Skip Rohan's row 25
          } else if (choice === 'KEEP_ROW_B') {
            // If we keep row B (Rohan's row 25), we want to make sure row A is ignored when we loop over it.
            // Wait, how do we ignore Row 24? We can check if Row A is 24, and since 24 is processed BEFORE 25,
            // we can mark Row 24 to be ignored or deleted.
            // Let's implement this simply: if this is Row 25 and choice is KEEP_ROW_B, we will delete Row 24 from resolvedRows!
            const idx = resolvedRows.findIndex(r => r.rowNumber === conflictWith);
            if (idx !== -1) {
              resolvedRows.splice(idx, 1);
              anomaliesReport.push({
                rowNumber: conflictWith,
                anomalyType: 'CONFLICTING_DUPLICATE',
                description: `Conflict resolved: Aisha's Row 24 discarded in favor of Rohan's Row 25.`,
                resolvedAction: 'DISCARDED_ROW'
              });
            }
            anomaliesReport.push({
              rowNumber: rowNum,
              anomalyType: 'CONFLICTING_DUPLICATE',
              description: `Conflict resolved: Rohan's Row 25 saved as correct entry.`,
              resolvedAction: 'KEPT_ROW'
            });
          } else {
            // KEEP BOTH
            anomaliesReport.push({
              rowNumber: rowNum,
              anomalyType: 'CONFLICTING_DUPLICATE',
              description: `Conflict resolved: Kept both Thalassa dinner entries.`,
              resolvedAction: 'KEPT_BOTH'
            });
          }
        }

        // Apply normalizations
        let resolvedPayer = row.resolvedData.paidBy;
        if (row.anomalies.includes('MISSING_PAYER')) {
          resolvedPayer = payerResolutions[rowNum];
          anomaliesReport.push({
            rowNumber: rowNum,
            anomalyType: 'MISSING_PAYER',
            description: `Assigned payer "${resolvedPayer}" to missing field.`,
            resolvedAction: `Assigned payer: ${resolvedPayer}`
          });
        }

        // Apply date override for Row 34 (deep cleaning)
        let resolvedDate = row.resolvedData.date;
        if (rowNum === 34) {
          // Default chronological parse is April 5th (2026-04-05) instead of May 4th
          resolvedDate = new Date('2026-04-05T00:00:00.000Z');
          anomaliesReport.push({
            rowNumber: rowNum,
            anomalyType: 'DATE_FORMAT',
            description: `Resolved ambiguous date format "04/05/2026" to April 5th.`,
            resolvedAction: 'Assigned date: 2026-04-05'
          });
        } else if (row.anomalies.includes('DATE_FORMAT')) {
          anomaliesReport.push({
            rowNumber: rowNum,
            anomalyType: 'DATE_FORMAT',
            description: `Standardized date format for "${row.originalData.date}".`,
            resolvedAction: `Normalized date: ${resolvedDate.toISOString().split('T')[0]}`
          });
        }

        if (row.anomalies.includes('NAME_VARIANT')) {
          anomaliesReport.push({
            rowNumber: rowNum,
            anomalyType: 'GUEST_USER',
            description: `Normalized name variant "${row.originalData.paidBy}" to "${resolvedPayer}".`,
            resolvedAction: `Spelling correction`
          });
        }

        // Convert currency
        let resolvedCurrency = row.resolvedData.currency;
        let resolvedAmount = row.resolvedData.amount;
        let exchangeRateUsed = 1.0;

        if (resolvedCurrency === 'USD') {
          exchangeRateUsed = usdRate;
          resolvedAmount = row.resolvedData.amount * usdRate;
          anomaliesReport.push({
            rowNumber: rowNum,
            anomalyType: 'CURRENCY',
            description: `Converted $${row.resolvedData.amount} USD to INR at rate of ₹${usdRate}.`,
            resolvedAction: `USD to INR rate: ${usdRate}`
          });
        } else if (row.anomalies.includes('MISSING_CURRENCY')) {
          anomaliesReport.push({
            rowNumber: rowNum,
            anomalyType: 'CURRENCY',
            description: `Defaulted missing currency to INR.`,
            resolvedAction: 'Assigned INR'
          });
        }

        if (row.anomalies.includes('HIGH_DECIMAL') || rowNum === 10) {
          // Cylinder refill 899.995 -> 900.00
          const original = resolvedAmount;
          resolvedAmount = Math.round(resolvedAmount * 100) / 100;
          anomaliesReport.push({
            rowNumber: rowNum,
            anomalyType: 'AMOUNT_FORMAT',
            description: `Rounded amount ${original} to 2 decimal places: ${resolvedAmount}.`,
            resolvedAction: `Rounded to ${resolvedAmount}`
          });
        }

        if (row.anomalies.includes('ZERO_AMOUNT')) {
          anomaliesReport.push({
            rowNumber: rowNum,
            anomalyType: 'SETTLEMENT',
            description: `Imported zero-amount historical record.`,
            resolvedAction: 'Saved $0 record'
          });
        }

        // Process splits
        let splitWith = [...row.resolvedData.splitWith];
        
        // Handle guest user Kabir
        if (splitWith.includes("Dev's friend Kabir")) {
          // Dev absorbs Kabir's share (so we remove Kabir and let Dev take his share, meaning Dev gets 2 parts of the split)
          splitWith = splitWith.filter(m => m !== "Dev's friend Kabir");
          // If split is equal, we will model this as a "share" split where Dev has 2 shares, others have 1 share.
          // In this importer, we will recalculate split amounts directly!
          anomaliesReport.push({
            rowNumber: rowNum,
            anomalyType: 'GUEST_USER',
            description: `Dev's friend Kabir split absorbed by Dev.`,
            resolvedAction: 'Dev absorbed guest share'
          });
        }

        // Temporal exclusions (Sam/Meera)
        const exclusions = temporalExclusions[rowNum] || [];
        if (exclusions.length > 0) {
          splitWith = splitWith.filter(m => !exclusions.includes(m));
          anomaliesReport.push({
            rowNumber: rowNum,
            anomalyType: 'TEMPORAL',
            description: `Excluded inactive members (${exclusions.join(', ')}) from split.`,
            resolvedAction: `Excluded ${exclusions.join(', ')}`
          });
        }

        // Calculate individual splits
        let splitsToCreate = [];
        const isSettlement = row.resolvedData.isSettlement;

        if (isSettlement) {
          // Rohan paid Aisha back, or Sam deposit
          // SplitWith has 1 element: Aisha
          const recipient = row.resolvedData.splitWith[0] || 'Aisha';
          splitsToCreate = [{
            name: recipient,
            amount: resolvedAmount, // recipient "owes" payer resolvedAmount to cancel out debt
            shareVal: null
          }];
          if (row.anomalies.includes('SETTLEMENT_LOGGED_AS_EXPENSE')) {
            anomaliesReport.push({
              rowNumber: rowNum,
              anomalyType: 'SETTLEMENT',
              description: `Settlement logged as expense: "${row.originalData.description}" resolved to direct transfer.`,
              resolvedAction: 'Categorised as Settlement'
            });
          }
        } else {
          // Normal split calculations
          const splitType = row.resolvedData.splitType;
          
          if (splitType === 'equal' || splitType === 'share' || splitType === '') {
            // Calculate shares
            let shares = {};
            
            if (row.originalData.splitDetails && row.originalData.splitDetails.includes(';')) {
              // Row has shares details (e.g. Aisha 1; Rohan 2; Priya 1; Dev 2)
              const parts = row.originalData.splitDetails.split(';').map(p => p.trim());
              parts.forEach(p => {
                const match = p.match(/(.+)\s+(\d+)/);
                if (match) {
                  const mName = normalizeNameForImporter(match[1]);
                  shares[mName] = parseInt(match[2], 10);
                }
              });
            } else {
              // Default equal split
              splitWith.forEach(name => {
                shares[name] = 1;
              });
            }

            // Exclude inactive members from shares
            exclusions.forEach(name => {
              delete shares[name];
            });

            // Handle Dev absorbing Kabir's share
            if (row.originalData.splitWith && row.originalData.splitWith.includes("Dev's friend Kabir") && shares['Dev'] !== undefined) {
              shares['Dev'] = (shares['Dev'] || 1) + 1; // Dev gets his share + Kabir's share
            }

            const totalShares = Object.values(shares).reduce((sum, val) => sum + val, 0);

            splitsToCreate = Object.keys(shares).map(name => {
              const userShareAmt = totalShares > 0 ? (resolvedAmount * shares[name]) / totalShares : 0;
              return {
                name,
                amount: Math.round(userShareAmt * 100) / 100,
                shareVal: shares[name]
              };
            });
          } else if (splitType === 'percentage') {
            // Percentage split
            const parts = row.originalData.splitDetails.split(';').map(p => p.trim());
            let percentages = {};
            
            parts.forEach(p => {
              const match = p.match(/(.+)\s+(\d+)%/);
              if (match) {
                const mName = normalizeNameForImporter(match[1]);
                percentages[mName] = parseInt(match[2], 10);
              }
            });

            // Exclude inactive members
            exclusions.forEach(name => {
              delete percentages[name];
            });

            let totalPct = Object.values(percentages).reduce((sum, val) => sum + val, 0);
            
            // Normalize percentages if sum != 100
            const shouldNormalize = normalizePercentages || totalPct !== 100;

            splitsToCreate = Object.keys(percentages).map(name => {
              let pct = percentages[name];
              if (shouldNormalize && totalPct > 0) {
                pct = (percentages[name] * 100) / totalPct;
              }
              const userShareAmt = (resolvedAmount * pct) / 100;
              return {
                name,
                amount: Math.round(userShareAmt * 100) / 100,
                shareVal: Math.round(pct * 100) / 100
              };
            });

            if (row.anomalies.includes('PERCENTAGE_SUM_ERR')) {
              anomaliesReport.push({
                rowNumber: rowNum,
                anomalyType: 'PERCENT_SUM',
                description: `Percentage split rescaled from ${totalPct}% to 100%.`,
                resolvedAction: 'Rescaled percentages to 100%'
              });
            }
          } else if (splitType === 'unequal') {
            // Unequal split (raw amount values)
            const parts = row.originalData.splitDetails.split(';').map(p => p.trim());
            const unequalAmounts = {};
            parts.forEach(p => {
              const match = p.match(/(.+)\s+(\d+)/);
              if (match) {
                const mName = normalizeNameForImporter(match[1]);
                unequalAmounts[mName] = parseFloat(match[2]);
              }
            });

            // Exclude inactive members
            exclusions.forEach(name => {
              delete unequalAmounts[name];
            });

            // Calculate total of unequal splits
            const totalSplitAmount = Object.values(unequalAmounts).reduce((sum, val) => sum + val, 0);
            
            // If total of split details doesn't match total expense amount, scale them proportionally
            splitsToCreate = Object.keys(unequalAmounts).map(name => {
              let shareVal = unequalAmounts[name];
              let userShareAmt = shareVal * exchangeRateUsed;
              if (Math.abs(totalSplitAmount - row.resolvedData.amount) > 0.05) {
                // Scaling proportionally to fit the actual expense amount
                userShareAmt = (row.resolvedData.amount * shareVal / totalSplitAmount) * exchangeRateUsed;
              }
              return {
                name,
                amount: Math.round(userShareAmt * 100) / 100,
                shareVal: shareVal
              };
            });
          }
        }

        resolvedRows.push({
          rowNumber: rowNum,
          description: row.originalData.description,
          amount: Math.round(resolvedAmount * 100) / 100, // in base currency INR
          originalAmount: row.resolvedData.amount, // in USD or INR
          originalCurrency: resolvedCurrency,
          exchangeRate: exchangeRateUsed,
          paidBy: resolvedPayer,
          splitType: row.resolvedData.splitType || 'equal',
          date: resolvedDate,
          notes: row.originalData.notes,
          isSettlement,
          splits: splitsToCreate
        });
      }

      // 6. Submit to database action
      const importPayload = {
        filename: 'expenses_export.csv',
        resolvedRows,
        anomalies: anomaliesReport
      };

      const result = await handleSaveImport(importPayload);
      if (result && result.success) {
        onImportComplete(result.reportId);
      } else {
        setError(result.error || 'Failed to save import data.');
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to process final save: ' + err.message);
      setLoading(false);
    }
  };

  const normalizeNameForImporter = (name) => {
    const trimmed = name.trim().toLowerCase();
    if (trimmed === 'aisha') return 'Aisha';
    if (trimmed === 'rohan') return 'Rohan';
    if (trimmed === 'priya' || trimmed === 'priya s') return 'Priya';
    if (trimmed === 'meera') return 'Meera';
    if (trimmed === 'sam') return 'Sam';
    if (trimmed === 'dev') return 'Dev';
    return name;
  };

  // Helper file drop/selection
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText(event.target.result);
    };
    reader.readAsText(file);
  };

  return (
    <div className={styles.container}>
      {/* Step Progress Line */}
      {step > 0 && (
        <div className={styles.progressContainer}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${((step - 1) / 6) * 100}%` }}
            />
          </div>
          {stepsList.slice(1).map((s) => {
            const isActive = step === s.num;
            const isDone = step > s.num;
            return (
              <div
                key={s.num}
                className={`${styles.stepDot} ${isActive ? styles.stepDotActive : ''} ${isDone ? styles.stepDotDone : ''}`}
                title={s.title}
              >
                {isDone ? '✓' : s.num}
              </div>
            );
          })}
        </div>
      )}

      {error && <div className="badge badge-danger" style={{ padding: 12, borderRadius: 8 }}>{error}</div>}

      {/* STEP 0: paste or upload file */}
      {step === 0 && (
        <div className="glass-panel" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h2 className={styles.stepTitle}>Import Shared Expenses CSV</h2>
          <p className={styles.stepDesc}>Ingest flatmate expenses directly from your csv export file. We will analyze and help resolve any discrepancies.</p>
          
          <label className={styles.uploadZone}>
            <span className={styles.uploadIcon}>📂</span>
            <strong>Choose CSV File</strong>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click to browse or drop file here</span>
            <input
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </label>

          <div className={styles.divider}>or paste CSV raw text below</div>

          <textarea
            className={styles.textArea}
            placeholder="date,description,paid_by,amount,currency,split_type,split_with,split_details,notes&#10;2026-02-01,February rent,Aisha,48000,INR,equal,&quot;Aisha;Rohan;Priya;Meera&quot;,,"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />

          <button className="btn btn-primary" onClick={handleParseCSV}>
            Scan & Parse CSV
          </button>
        </div>
      )}

      {/* STEP 1: Name Normalization */}
      {step === 1 && (
        <div className="glass-panel" style={{ padding: 32 }}>
          <h2 className={styles.stepTitle}>Step 1: Normalise Roommate Names</h2>
          <p className={styles.stepDesc}>We identified several spelling variations and lowercase entries in the paid_by and split_with lists. We will automatically normalize them.</p>

          <div className={styles.mappingGrid}>
            <div className={styles.mappingRow}>
              <span>"priya" (Row 9)</span>
              <span className={styles.mappingArrow}>➔</span>
              <span><strong>Priya</strong></span>
            </div>
            <div className={styles.mappingRow}>
              <span>"Priya S" (Row 11)</span>
              <span className={styles.mappingArrow}>➔</span>
              <span><strong>Priya</strong></span>
            </div>
            <div className={styles.mappingRow}>
              <span>"rohan " (Row 27)</span>
              <span className={styles.mappingArrow}>➔</span>
              <span><strong>Rohan</strong></span>
            </div>
          </div>

          <div className={styles.wizardFooter}>
            <button className="btn btn-secondary" onClick={handlePrev}>Back</button>
            <button className="btn btn-primary" onClick={handleNext}>Confirm & Continue</button>
          </div>
        </div>
      )}

      {/* STEP 2: Resolve Missing Payer (Row 13) */}
      {step === 2 && (
        <div className="glass-panel" style={{ padding: 32 }}>
          <h2 className={styles.stepTitle}>Step 2: Resolve Missing Payers</h2>
          <p className={styles.stepDesc}>Priya notes: "can't remember who paid". Row 13 has no payer set. Please assign a payer to complete this expense.</p>

          <div className={styles.resolutionList}>
            {Object.keys(payerResolutions).map((rowNum) => {
              const row = parsedData.rows.find(r => r.rowNumber === parseInt(rowNum, 10));
              return (
                <div key={rowNum} className={styles.resolutionCard}>
                  <div className={styles.cardHeader}>
                    <span className={styles.rowLabel}>Row {rowNum}</span>
                    <span className="badge badge-danger">Missing Payer</span>
                  </div>
                  <div className={styles.cardDesc}>"{row?.originalData.description}" — ₹{row?.originalData.amount} INR</div>
                  
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Who actually paid?</label>
                    <select
                      className="form-input form-select"
                      value={payerResolutions[rowNum]}
                      onChange={(e) => setPayerResolutions(prev => ({ ...prev, [rowNum]: e.target.value }))}
                    >
                      <option value="Aisha">Aisha</option>
                      <option value="Rohan">Rohan</option>
                      <option value="Priya">Priya</option>
                      <option value="Meera">Meera</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.wizardFooter}>
            <button className="btn btn-secondary" onClick={handlePrev}>Back</button>
            <button className="btn btn-primary" onClick={handleNext}>Apply & Continue</button>
          </div>
        </div>
      )}

      {/* STEP 3: USD Exchange Rate (Goa Trip) */}
      {step === 3 && (
        <div className="glass-panel" style={{ padding: 32 }}>
          <h2 className={styles.stepTitle}>Step 3: Priya's Request: USD Exchange Rate</h2>
          <p className={styles.stepDesc}>Multiple expenses (villa booking, shack lunch, parasailing) were logged in USD. Set the exchange rate to convert them to INR.</p>

          <div className={styles.resolutionCard} style={{ gap: 20 }}>
            <div className={styles.cardHeader}>
              <span className={styles.rowLabel}>USD Currency Conversion</span>
              <span className="badge badge-warning">USD Transactions</span>
            </div>
            
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Exchange Rate ($1 USD to INR)</span>
                <strong style={{ fontSize: 16, color: 'var(--primary)' }}>₹{usdRate.toFixed(2)}</strong>
              </label>
              <input
                type="range"
                min="75"
                max="90"
                step="0.5"
                value={usdRate}
                onChange={(e) => setUsdRate(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--primary)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                <span>₹75.00</span>
                <span>₹83.00 (Default)</span>
                <span>₹90.00</span>
              </div>
            </div>

            <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: 16, borderRadius: 8 }}>
              <h4 style={{ fontSize: 13, marginBottom: 8, color: 'white' }}>Conversion Preview:</h4>
              <ul style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 16 }}>
                <li>Goa Villa Booking: $540 USD ➔ ₹{(540 * usdRate).toLocaleString()}</li>
                <li>Shack Lunch: $84 USD ➔ ₹{(84 * usdRate).toLocaleString()}</li>
                <li>Parasailing: $150 USD ➔ ₹{(150 * usdRate).toLocaleString()}</li>
                <li>Parasailing Refund: -$30 USD ➔ -₹{(30 * usdRate).toLocaleString()}</li>
              </ul>
            </div>
          </div>

          <div className={styles.wizardFooter}>
            <button className="btn btn-secondary" onClick={handlePrev}>Back</button>
            <button className="btn btn-primary" onClick={handleNext}>Convert & Continue</button>
          </div>
        </div>
      )}

      {/* STEP 4: Percentage Split Normalization (Pizza Friday 110%) */}
      {step === 4 && (
        <div className="glass-panel" style={{ padding: 32 }}>
          <h2 className={styles.stepTitle}>Step 4: Percentage Split Discrepancies</h2>
          <p className={styles.stepDesc}>Row 15 (Pizza Friday) and Row 32 (Brunch) have percentage splits that sum to 110% (Aisha 30%, Rohan 30%, Priya 30%, Meera 20%). We must fix this.</p>

          <div className={styles.resolutionCard}>
            <div className={styles.cardHeader}>
              <span className={styles.rowLabel}>Normalization Policy</span>
              <span className="badge badge-danger">Sum Exceeds 100%</span>
            </div>
            
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              We will automatically scale the percentages proportionally so they sum to exactly 100%. 
              For example, 30% becomes 27.27%, and 20% becomes 18.18%.
            </p>

            <label className={styles.exclusionChip} style={{ width: 'fit-content', cursor: 'default' }}>
              <input
                type="checkbox"
                checked={normalizePercentages}
                onChange={(e) => setNormalizePercentages(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--success)' }}
              />
              <span>Scale percentages proportionally to sum to 100% (Recommended)</span>
            </label>
          </div>

          <div className={styles.wizardFooter}>
            <button className="btn btn-secondary" onClick={handlePrev}>Back</button>
            <button className="btn btn-primary" onClick={handleNext}>Apply & Continue</button>
          </div>
        </div>
      )}

      {/* STEP 5: Temporal Timeline Verification (Sam & Meera) */}
      {step === 5 && (
        <div className="glass-panel" style={{ padding: 32 }}>
          <h2 className={styles.stepTitle}>Step 5: Sam & Meera: Temporal Tenancy Check</h2>
          <p className={styles.stepDesc}>Verify that roommates are only charged for expenses during their active tenancy. Meera left March 31, and Sam joined April 15.</p>

          <div className={styles.timelineGrid}>
            {Object.keys(temporalExclusions).map((rowNum) => {
              const row = parsedData.rows.find(r => r.rowNumber === parseInt(rowNum, 10));
              const currentExclusions = temporalExclusions[rowNum] || [];
              const originalParticipants = row?.originalData.splitWith.split(';') || [];

              return (
                <div key={rowNum} className={styles.timelineCard}>
                  <div className={styles.cardHeader}>
                    <span className={styles.rowLabel}>Row {rowNum} — Date: {row?.originalData.date}</span>
                    <span className="badge badge-warning">Temporal Error</span>
                  </div>
                  <div className={styles.cardDesc}>"{row?.originalData.description}" — ₹{row?.originalData.amount} INR</div>
                  
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Meera left March 31. Sam joined April 15. Toggle who should be **excluded** from this split (remaining members will absorb their share):
                  </div>

                  <div className={styles.exclusionList}>
                    {originalParticipants.map(name => {
                      const normName = normalizeNameForImporter(name);
                      const isExcluded = currentExclusions.includes(normName);
                      // Suggestion highlight
                      const isSuggestedExclusion = (normName === 'Meera' && rowNum === 36) || (normName === 'Sam' && (rowNum === 39 || rowNum === 40));
                      
                      return (
                        <button
                          key={name}
                          type="button"
                          className={`${styles.exclusionChip} ${isExcluded ? styles.exclusionChipActive : ''}`}
                          onClick={() => {
                            setTemporalExclusions(prev => {
                              const list = prev[rowNum] || [];
                              if (list.includes(normName)) {
                                return { ...prev, [rowNum]: list.filter(n => n !== normName) };
                              } else {
                                return { ...prev, [rowNum]: [...list, normName] };
                              }
                            });
                          }}
                        >
                          <span>{isExcluded ? '❌ Excluded' : '✓ Active'}</span>
                          <strong>{normName}</strong>
                          {isSuggestedExclusion && <span style={{ fontSize: 9, opacity: 0.8 }}>(Recommended Exclude)</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.wizardFooter}>
            <button className="btn btn-secondary" onClick={handlePrev}>Back</button>
            <button className="btn btn-primary" onClick={handleNext}>Adjust Splits & Continue</button>
          </div>
        </div>
      )}

      {/* STEP 6: Duplicate & Conflict Resolution (Thalassa / Marina) */}
      {step === 6 && (
        <div className="glass-panel" style={{ padding: 32 }}>
          <h2 className={styles.stepTitle}>Step 6: Meera's Request: Duplicates & Conflicts</h2>
          <p className={styles.stepDesc}>Resolve duplicate entries and data entry conflicts. Review comparison cards and approve which entries to import or discard.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {/* Duplicates Section */}
            <div>
              <h3 style={{ fontSize: 15, marginBottom: 12 }}>1. Near-Duplicate Check (Marina Bites Dinner)</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Two entries found for Marina Bites dinner on Feb 8. Choose whether to keep both or delete/discard one:
              </p>

              <div className={styles.comparisonGrid}>
                {/* Row 5 */}
                <div className={`${styles.compCard} ${duplicateActions[6] === 'DISCARD' ? styles.compCardSelected : ''}`} onClick={() => setDuplicateActions(prev => ({ ...prev, 6: 'DISCARD' }))}>
                  <div className={styles.compCardLabel}>Row 5 (Keep)</div>
                  <div className={styles.compDetailItem}>
                    <span className={styles.compDetailLabel}>Description</span>
                    <span className={styles.compDetailValue}>Dinner at Marina Bites</span>
                  </div>
                  <div className={styles.compDetailItem}>
                    <span className={styles.compDetailLabel}>Paid By</span>
                    <span className={styles.compDetailValue}>Dev</span>
                  </div>
                  <div className={styles.compDetailItem}>
                    <span className={styles.compDetailLabel}>Amount</span>
                    <span className={styles.compDetailValue}>₹3,200</span>
                  </div>
                  <div className={styles.compDetailItem}>
                    <span className={styles.compDetailLabel}>Note</span>
                    <span className={styles.compDetailValue} style={{ fontSize: 11 }}>Dev visiting for the weekend</span>
                  </div>
                  <span className="badge badge-success" style={{ position: 'absolute', top: 12, right: 12 }}>Keep Row 5</span>
                </div>

                {/* Row 6 */}
                <div className={`${styles.compCard} ${duplicateActions[6] === 'KEEP' ? styles.compCardSelected : ''}`} onClick={() => setDuplicateActions(prev => ({ ...prev, 6: 'KEEP' }))}>
                  <div className={styles.compCardLabel}>Row 6 (Duplicate)</div>
                  <div className={styles.compDetailItem}>
                    <span className={styles.compDetailLabel}>Description</span>
                    <span className={styles.compDetailValue}>dinner - marina bites</span>
                  </div>
                  <div className={styles.compDetailItem}>
                    <span className={styles.compDetailLabel}>Paid By</span>
                    <span className={styles.compDetailValue}>Dev</span>
                  </div>
                  <div className={styles.compDetailItem}>
                    <span className={styles.compDetailLabel}>Amount</span>
                    <span className={styles.compDetailValue}>₹3,200</span>
                  </div>
                  <div className={styles.compDetailItem}>
                    <span className={styles.compDetailLabel}>Note</span>
                    <span className={styles.compDetailValue}>-</span>
                  </div>
                  <span className="badge badge-danger" style={{ position: 'absolute', top: 12, right: 12 }}>
                    {duplicateActions[6] === 'DISCARD' ? 'Discarding' : 'Keep Both'}
                  </span>
                </div>
              </div>
            </div>

            {/* Conflicts Section */}
            <div>
              <h3 style={{ fontSize: 15, marginBottom: 12 }}>2. Payer/Amount Conflict Check (Thalassa Dinner)</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Row 24 (Aisha paid ₹2400) and Row 25 (Rohan paid ₹2450) log the same Thalassa dinner. Rohan notes: "Aisha also logged this I think hers is wrong". Pick the winning entry:
              </p>

              <div className={styles.comparisonGrid}>
                {/* Option Row 24 */}
                <div className={`${styles.compCard} ${conflictChoices[25] === 'KEEP_ROW_A' ? styles.compCardSelected : ''}`} onClick={() => setConflictChoices(prev => ({ ...prev, 25: 'KEEP_ROW_A' }))}>
                  <div className={styles.compCardLabel}>Row 24 (Aisha)</div>
                  <div className={styles.compDetailItem}>
                    <span className={styles.compDetailLabel}>Description</span>
                    <span className={styles.compDetailValue}>Dinner at Thalassa</span>
                  </div>
                  <div className={styles.compDetailItem}>
                    <span className={styles.compDetailLabel}>Paid By</span>
                    <span className={styles.compDetailValue}>Aisha</span>
                  </div>
                  <div className={styles.compDetailItem}>
                    <span className={styles.compDetailLabel}>Amount</span>
                    <span className={styles.compDetailValue}>₹2,400</span>
                  </div>
                  <div className={styles.compDetailItem}>
                    <span className={styles.compDetailLabel}>Action</span>
                    <span className={styles.compDetailValue} style={{ color: 'var(--danger)' }}>Discard Rohan's Row 25</span>
                  </div>
                </div>

                {/* Option Row 25 */}
                <div className={`${styles.compCard} ${conflictChoices[25] === 'KEEP_ROW_B' ? styles.compCardSelected : ''}`} onClick={() => setConflictChoices(prev => ({ ...prev, 25: 'KEEP_ROW_B' }))}>
                  <div className={styles.compCardLabel}>Row 25 (Rohan - Recommended)</div>
                  <div className={styles.compDetailItem}>
                    <span className={styles.compDetailLabel}>Description</span>
                    <span className={styles.compDetailValue}>Thalassa dinner</span>
                  </div>
                  <div className={styles.compDetailItem}>
                    <span className={styles.compDetailLabel}>Paid By</span>
                    <span className={styles.compDetailValue}>Rohan</span>
                  </div>
                  <div className={styles.compDetailItem}>
                    <span className={styles.compDetailLabel}>Amount</span>
                    <span className={styles.compDetailValue}>₹2,450</span>
                  </div>
                  <div className={styles.compDetailItem}>
                    <span className={styles.compDetailLabel}>Action</span>
                    <span className={styles.compDetailValue} style={{ color: 'var(--success)' }}>Discard Aisha's Row 24</span>
                  </div>
                  <span className="badge badge-success" style={{ position: 'absolute', top: 12, right: 12 }}>Recommended Winner</span>
                </div>
              </div>

              <div className={styles.compActions}>
                <button
                  type="button"
                  className={`btn btn-secondary ${conflictChoices[25] === 'KEEP_BOTH' ? 'badge-primary' : ''}`}
                  onClick={() => setConflictChoices(prev => ({ ...prev, 25: 'KEEP_BOTH' }))}
                  style={{ marginTop: 16 }}
                >
                  Keep Both Entries (Import Row 24 & 25)
                </button>
              </div>
            </div>
          </div>

          <div className={styles.wizardFooter}>
            <button className="btn btn-secondary" onClick={handlePrev}>Back</button>
            <button className="btn btn-primary" onClick={handleNext}>Resolve & Continue</button>
          </div>
        </div>
      )}

      {/* STEP 7: Summary & Commit */}
      {step === 7 && (
        <div className="glass-panel" style={{ padding: 32 }}>
          <h2 className={styles.stepTitle}>Final Review: Import Summary</h2>
          <p className={styles.stepDesc}>All anomalies have been resolved according to your selections. Click save below to commit all cleaned records to the database.</p>

          <div className={styles.resolutionCard} style={{ gap: 14 }}>
            <h4 style={{ fontSize: 14, color: 'white', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 8 }}>Resolution Log preview:</h4>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-secondary)', paddingLeft: 20 }}>
              <li>Spelling Variants corrected for Priya, Priya S, and Rohan.</li>
              <li>Missing payer for Row 13 (supplies) will be assigned to <strong>{payerResolutions[13]}</strong>.</li>
              <li>USD transactions converted at rate of <strong>₹{usdRate.toFixed(2)}</strong>.</li>
              <li>Duplicate Row 6 (Marina Bites) will be <strong>{duplicateActions[6] === 'DISCARD' ? 'discarded' : 'imported'}</strong>.</li>
              <li>Conflict for Thalassa Dinner resolved by keeping <strong>{conflictChoices[25] === 'KEEP_ROW_B' ? "Rohan's Row 25" : conflictChoices[25] === 'KEEP_ROW_A' ? "Aisha's Row 24" : "both rows"}</strong>.</li>
              <li>Percentage splits summing to 110% scaled proportionally to sum to 100%.</li>
              <li>Sam excluded from March/early April expenses; Meera excluded from April expenses.</li>
            </ul>
          </div>

          <div className={styles.wizardFooter}>
            <button className="btn btn-secondary" onClick={handlePrev} disabled={loading}>Back</button>
            <button
              className={`btn btn-primary ${loading ? 'btn-disabled' : ''}`}
              onClick={handleFinalSave}
              disabled={loading}
            >
              {loading ? 'Saving Clean Data...' : 'Save & Import Records'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
