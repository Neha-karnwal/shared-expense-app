'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { handleLogout, handleAddExpense } from '../app/actions';
import DebtSimplifier from './DebtSimplifier';
import ExpenseBreakdown from './ExpenseBreakdown';
import styles from '../app/page.module.css';

export default function DashboardClient({
  currentUser,
  group,
  expenses = [],
  balances = [],
  simplifiedPayments = []
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form states
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [exchangeRate, setExchangeRate] = useState('1.0');
  const [paidById, setPaidById] = useState(currentUser?.id || '');
  const [splitType, setSplitType] = useState('equal');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  
  // Custom split values per member: { [userId]: shareVal }
  const [splitValues, setSplitValues] = useState({});
  const [selectedSplits, setSelectedSplits] = useState({}); // { [userId]: boolean }

  const hasExpenses = expenses.length > 0;

  // Active roommates lists for dropdowns
  const roommates = group.members.map(m => m.user);

  // Helper to determine if a roommate was active on a given date
  const isMemberActiveOnDate = (member, dateStr) => {
    const checkTime = new Date(dateStr).getTime();
    const groupMember = group.members.find(m => m.user.id === member.id);
    if (!groupMember) return false;

    const joinedTime = new Date(groupMember.joinedAt).getTime();
    const leftTime = groupMember.leftAt ? new Date(groupMember.leftAt).getTime() : null;

    if (checkTime < joinedTime) return false;
    if (leftTime && checkTime > leftTime) return false;
    return true;
  };

  // Get list of roommates active on the currently selected date
  const activeRoommates = roommates.filter(rm => isMemberActiveOnDate(rm, date));

  // Initialize splits checkboxes when modal opens or date changes
  const handleOpenModal = () => {
    setIsModalOpen(true);
    setError('');
    // Initialize checkboxes for active roommates
    const initialChecked = {};
    const initialVals = {};
    roommates.forEach(r => {
      const active = isMemberActiveOnDate(r, date);
      initialChecked[r.id] = active;
      initialVals[r.id] = splitType === 'percentage' ? 0 : 1;
    });
    setSelectedSplits(initialChecked);
    setSplitValues(initialVals);
  };

  const handleDateChange = (newDate) => {
    setDate(newDate);
    // Recheck active status
    setSelectedSplits(prev => {
      const next = { ...prev };
      roommates.forEach(r => {
        next[r.id] = isMemberActiveOnDate(r, newDate);
      });
      return next;
    });
  };

  const handleSplitCheckboxChange = (userId) => {
    setSelectedSplits(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const handleSplitValueChange = (userId, val) => {
    setSplitValues(prev => ({ ...prev, [userId]: parseFloat(val) || 0 }));
  };

  const handleLogoutClick = () => {
    startTransition(async () => {
      await handleLogout();
    });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const numericAmount = parseFloat(amount);
    const numericRate = parseFloat(exchangeRate);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid amount.');
      setLoading(false);
      return;
    }

    if (isNaN(numericRate) || numericRate <= 0) {
      setError('Please enter a valid exchange rate.');
      setLoading(false);
      return;
    }

    // Filter splits who are checked
    const participants = roommates.filter(r => selectedSplits[r.id]);
    if (participants.length === 0) {
      setError('At least one roommate must be selected in the split.');
      setLoading(false);
      return;
    }

    // Check percentage sum
    if (splitType === 'percentage') {
      const sum = participants.reduce((total, p) => total + (splitValues[p.id] || 0), 0);
      if (Math.abs(sum - 100) > 0.01) {
        setError(`Percentages must sum to exactly 100%. Current sum: ${sum}%`);
        setLoading(false);
        return;
      }
    }

    // Build splits array
    const splitsArray = participants.map(p => ({
      userId: p.id,
      shareVal: splitType === 'equal' ? null : (splitValues[p.id] || 0)
    }));

    const payload = {
      groupId: group.id,
      description,
      amount: numericAmount,
      currency,
      exchangeRate: numericRate,
      paidById,
      splitType,
      date,
      notes,
      isSettlement: splitType === 'equal' && splitsArray.length === 1 && splitsArray[0].userId !== paidById,
      splits: splitsArray
    };

    try {
      const res = await handleAddExpense(payload);
      if (res && res.success) {
        setIsModalOpen(false);
        // Reset form
        setDescription('');
        setAmount('');
        setCurrency('INR');
        setExchangeRate('1.0');
        setNotes('');
        router.refresh();
      } else {
        setError(res.error || 'Failed to save expense.');
      }
    } catch (err) {
      setError('An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <header className={styles.header}>
        <div className={`container ${styles.headerContainer}`}>
          <div className={styles.logo}>SplitFlat</div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>Logged in as <strong>{currentUser?.name}</strong></span>
            <button className="btn btn-secondary" onClick={handleLogoutClick} disabled={isPending}>
              {isPending ? 'Logging Out...' : 'Log Out'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className={`container ${styles.mainContent}`}>
        <div className={styles.welcomeSection}>
          <div className={styles.welcomeText}>
            <h2>{group.name}</h2>
            <p>February – May 2026 Expense Registry</p>
          </div>
          <div className={styles.actions}>
            <Link href="/import" className="btn btn-secondary">
              📂 CSV Import Wizard
            </Link>
            <button className="btn btn-primary" onClick={handleOpenModal}>
              ➕ Add Manual Expense
            </button>
          </div>
        </div>

        {/* If no data seeded or imported */}
        {!hasExpenses ? (
          <div className={`${styles.emptyCard} glass-panel`}>
            <span className={styles.emptyIcon}>📊</span>
            <h3>No Expenses Logged Yet</h3>
            <p>To view roommate balances and settlement plans, run the CSV Import Wizard to ingest their historical expenses sheet.</p>
            <Link href="/import" className="btn btn-primary" style={{ marginTop: 12 }}>
              Launch CSV Import Wizard
            </Link>
          </div>
        ) : (
          <div className={styles.grid}>
            {/* Sidebar (Left column) */}
            <div className={styles.sidebar}>
              <DebtSimplifier payments={simplifiedPayments} />
              
              <div className="glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h4 style={{ fontSize: 15, fontWeight: 700 }}>Quick System Actions</h4>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>You can re-import the sheet or add direct payments to balance out debts manually.</p>
                <Link href="/import" className="btn btn-secondary" style={{ width: '100%' }}>
                  📂 Re-import CSV file
                </Link>
              </div>
            </div>

            {/* Content Body (Right column) */}
            <div className={styles.contentBody}>
              <ExpenseBreakdown members={balances} initialUserId={currentUser?.id} />
            </div>
          </div>
        )}
      </main>

      {/* Manual Expense Modal */}
      {isModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={`${styles.modal} glass-panel`}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Add Shared Expense</h3>
              <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>×</button>
            </div>

            {error && <div className="badge badge-danger" style={{ padding: 10, borderRadius: 8 }}>{error}</div>}

            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="desc">Description</label>
                <input
                  id="desc"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Electricity bill"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="amt">Amount</label>
                  <input
                    id="amt"
                    type="number"
                    step="0.01"
                    className="form-input"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="curr">Currency</label>
                  <select
                    id="curr"
                    className="form-input form-select"
                    value={currency}
                    onChange={(e) => {
                      setCurrency(e.target.value);
                      if (e.target.value === 'INR') setExchangeRate('1.0');
                      else setExchangeRate('83.0');
                    }}
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              {currency === 'USD' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="rate">USD to INR Exchange Rate</label>
                  <input
                    id="rate"
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                    required
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="payer">Paid By</label>
                  <select
                    id="payer"
                    className="form-input form-select"
                    value={paidById}
                    onChange={(e) => setPaidById(e.target.value)}
                  >
                    {activeRoommates.map((rm) => (
                      <option key={rm.id} value={rm.id}>
                        {rm.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="date">Date</label>
                  <input
                    id="date"
                    type="date"
                    className="form-input"
                    value={date}
                    onChange={(e) => handleDateChange(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="split">Split Type</label>
                <select
                  id="split"
                  className="form-input form-select"
                  value={splitType}
                  onChange={(e) => setSplitType(e.target.value)}
                >
                  <option value="equal">Split Equally</option>
                  <option value="unequal">Unequal Shares (₹)</option>
                  <option value="percentage">Percentage Split (%)</option>
                  <option value="share">Custom Shares Ratio (1, 2, etc.)</option>
                </select>
              </div>

              {/* Dynamic Split Splits Selector */}
              <div className={styles.splitSelector}>
                <div className={styles.rowLabel} style={{ marginBottom: 8 }}>Split Participants (Timeline Active Only)</div>
                {roommates.map((rm) => {
                  const isActive = isMemberActiveOnDate(rm, date);
                  const isChecked = selectedSplits[rm.id] && isActive;
                  
                  return (
                    <div key={rm.id} className={styles.splitRow} style={{ opacity: isActive ? 1 : 0.4 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: isActive ? 'pointer' : 'not-allowed' }}>
                        <input
                          type="checkbox"
                          checked={!!isChecked}
                          onChange={() => handleSplitCheckboxChange(rm.id)}
                          disabled={!isActive}
                          style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
                        />
                        <span style={{ fontSize: 14 }}>{rm.name}</span>
                        {!isActive && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>(Away on this Date)</span>}
                      </label>

                      {/* Display share value inputs if not equal */}
                      {isChecked && splitType !== 'equal' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="number"
                            step="any"
                            className="form-input"
                            style={{ width: 80, padding: '4px 8px', fontSize: 12, textAlign: 'right' }}
                            value={splitValues[rm.id] || ''}
                            onChange={(e) => handleSplitValueChange(rm.id, e.target.value)}
                            placeholder={splitType === 'percentage' ? '%' : splitType === 'unequal' ? '₹' : 'share'}
                            required
                          />
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {splitType === 'percentage' ? '%' : splitType === 'unequal' ? 'INR' : 'share'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="notes">Notes (Optional)</label>
                <textarea
                  id="notes"
                  className="form-input"
                  placeholder="Details..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ height: 60 }}
                />
              </div>

              <button
                type="submit"
                className={`btn btn-primary ${loading ? 'btn-disabled' : ''}`}
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Add Expense'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
