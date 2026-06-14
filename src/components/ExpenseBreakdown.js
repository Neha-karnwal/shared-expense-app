'use client';

import { useState, useEffect } from 'react';
import { getUserLedger } from '../app/actions';
import styles from './components.module.css';

export default function ExpenseBreakdown({ members = [], initialUserId }) {
  const [selectedUserId, setSelectedUserId] = useState(initialUserId || (members[0]?.userId || ''));
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalBalance, setTotalBalance] = useState(0);
  const [targetUser, setTargetUser] = useState(null);

  useEffect(() => {
    let active = true;
    if (!selectedUserId) return;

    async function loadLedger() {
      setLoading(true);
      try {
        const res = await getUserLedger(selectedUserId);
        if (active && res && !res.error) {
          setLedger(res.ledger);
          setTotalBalance(res.totalBalance);
          setTargetUser(res.targetUser);
        }
      } catch (err) {
        console.error('Failed to load ledger:', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadLedger();
    return () => {
      active = false;
    };
  }, [selectedUserId]);

  const handleCardClick = (userId) => {
    setSelectedUserId(userId);
  };

  const getInitials = (name) => name ? name[0] : '?';

  return (
    <div className={`${styles.breakdownCard} glass-panel`}>
      <div className={styles.ledgerHeader}>
        <h3 className={styles.simplifierTitle}>
          <span>📋</span> Rohan's Request: Ledger Breakdowns (No Magic Numbers)
        </h3>
        {targetUser && (
          <div className={styles.totalSummary}>
            <div className={styles.totalBox}>
              <div className={styles.totalLabel}>Net Balance for {targetUser.name}</div>
              <div className={`${styles.totalValue} ${totalBalance >= 0 ? styles.creditValue : styles.debitValue}`}>
                {totalBalance >= 0 ? '+' : ''}₹{totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Roommate selector cards */}
      <div className={styles.balanceGrid}>
        {members.map((m) => {
          const isActive = m.userId === selectedUserId;
          const isCredit = m.balance >= 0;
          return (
            <div
              key={m.userId}
              className={`${styles.balanceCard} glass-panel ${isActive ? styles.balanceCardActive : ''}`}
              onClick={() => handleCardClick(m.userId)}
            >
              <div className={`${styles.balanceCardAvatar} ${isActive ? styles.balanceCardAvatarActive : ''}`}>
                {getInitials(m.name)}
              </div>
              <div className={styles.balanceCardName}>{m.name}</div>
              <div className={`${styles.balanceCardAmt} ${isCredit ? styles.creditValue : styles.debitValue}`}>
                {isCredit ? '+' : ''}₹{Math.round(m.balance).toLocaleString('en-IN')}
              </div>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className={styles.emptyState}>
          <p>Loading ledger entries...</p>
        </div>
      ) : ledger.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No ledger entries found for this user.</p>
        </div>
      ) : (
        <div className={styles.ledgerTableWrapper}>
          <table className={styles.ledgerTable}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Expense / Settlement</th>
                <th>Payer</th>
                <th>Paid Amount</th>
                <th>Your Share</th>
                <th>Net Balance Effect</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((entry) => {
                const isPositive = entry.netEffect >= 0;
                const dateStr = new Date(entry.date).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                });

                return (
                  <tr key={entry.id} className={styles.ledgerRow}>
                    <td className={styles.cellDate}>{dateStr}</td>
                    <td>
                      <div className={styles.cellDesc}>
                        {entry.description}
                        {entry.isSettlement && <span className="badge badge-primary" style={{ marginLeft: 8, fontSize: 9 }}>Settlement</span>}
                      </div>
                      {entry.originalCurrency !== 'INR' && (
                        <div className={styles.cellOriginal}>
                          Priya's View: {entry.originalAmount} {entry.originalCurrency} (Rate: ₹{entry.exchangeRate.toFixed(2)})
                        </div>
                      )}
                      {entry.notes && <div className={styles.cellOriginal}>{entry.notes}</div>}
                    </td>
                    <td>{entry.paidBy}</td>
                    <td>₹{entry.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td>₹{entry.oweAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td>
                      <span className={`${styles.effectBadge} ${isPositive ? styles.effectCredit : styles.effectDebit}`}>
                        {isPositive ? '+' : ''}₹{entry.netEffect.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
