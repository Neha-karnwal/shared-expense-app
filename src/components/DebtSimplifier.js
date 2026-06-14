import styles from './components.module.css';

export default function DebtSimplifier({ payments = [] }) {
  const isSettled = payments.length === 0;

  return (
    <div className={`${styles.simplifierCard} glass-panel`}>
      <div className={styles.simplifierHeader}>
        <h3 className={styles.simplifierTitle}>
          <span>💡</span> Aisha's Settlement Plan (Simplified Debts)
        </h3>
        {!isSettled && (
          <span className="badge badge-primary">
            {payments.length} transfer{payments.length > 1 ? 's' : ''} left
          </span>
        )}
      </div>

      {isSettled ? (
        <div className={styles.emptyState}>
          <span className={styles.settledBadge}>🎉</span>
          <h4>Everyone is fully settled!</h4>
          <p>No transactions required.</p>
        </div>
      ) : (
        <div className={styles.paymentList}>
          {payments.map((p, idx) => (
            <div key={idx} className={styles.paymentRow}>
              {/* Debtor (Payer) */}
              <div className={styles.personCard}>
                <div className={`${styles.avatar} ${styles.avatarDebtor}`}>
                  {p.from[0]}
                </div>
                <div className={styles.personName}>{p.from}</div>
              </div>

              {/* Flow Details */}
              <div className={styles.flowDirection}>
                <div className={styles.flowAmount}>₹{p.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                <span className={styles.arrow}>➔</span>
              </div>

              {/* Creditor (Recipient) */}
              <div className={styles.personCard}>
                <div className={styles.personName}>{p.to}</div>
                <div className={`${styles.avatar} ${styles.avatarCreditor}`}>
                  {p.to[0]}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
