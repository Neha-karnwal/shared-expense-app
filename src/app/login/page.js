'use client';

import { useState } from 'react';
import { handleLogin } from '../actions';
import styles from './page.module.css';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const roommates = [
    { name: 'Aisha', pass: 'aisha123' },
    { name: 'Rohan', pass: 'rohan123' },
    { name: 'Priya', pass: 'priya123' },
    { name: 'Meera', pass: 'meera123' },
    { name: 'Sam', pass: 'sam123' },
    { name: 'Dev', pass: 'dev123' }
  ];

  async function onSubmit(e) {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);
      
      const result = await handleLogin(formData);
      if (result && result.error) {
        setError(result.error);
        setLoading(false);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  }

  // Quick Login trigger
  async function triggerQuickLogin(name, pass) {
    setError('');
    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('username', name);
      formData.append('password', pass);
      
      const result = await handleLogin(formData);
      if (result && result.error) {
        setError(result.error);
        setLoading(false);
      }
    } catch (err) {
      setError('An unexpected error occurred.');
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={`${styles.loginCard} glass-panel`}>
        <div className={styles.header}>
          <h1 className={styles.title}>SharedExpense</h1>
          <p className={styles.subtitle}>Relational, messy expense reconciliator</p>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={onSubmit} className={styles.form}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">Roommate Name</label>
            <input
              id="username"
              type="text"
              className="form-input"
              placeholder="e.g. Aisha"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            className={`btn btn-primary ${styles.submitBtn} ${loading ? 'btn-disabled' : ''}`}
            disabled={loading}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className={styles.divider}>or</div>

        <div className={styles.quickSection}>
          <div className={styles.quickTitle}>Quick Login as Roommate</div>
          <div className={styles.quickGrid}>
            {roommates.map((rm) => (
              <button
                key={rm.name}
                type="button"
                className={styles.quickBtn}
                onClick={() => triggerQuickLogin(rm.name, rm.pass)}
                disabled={loading}
              >
                {rm.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
