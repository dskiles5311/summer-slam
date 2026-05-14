import { useState, useRef, useEffect } from 'react';

const SESSION_PW_KEY = 'ss_password';

const FIELD = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(139,180,225,0.3)',
  borderRadius: 8,
  color: 'var(--white)',
  fontSize: 16,
  padding: '10px 14px',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
};

export default function ConfirmActionModal({ label, onConfirm, onCancel }) {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const inputRef      = useRef(null);
  const overlayDownRef = useRef(false);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  function handleSubmit(e) {
    e.preventDefault();
    const stored = sessionStorage.getItem(SESSION_PW_KEY);
    if (password === stored) {
      onConfirm();
    } else {
      setError('Incorrect password');
      setPassword('');
      inputRef.current?.focus();
    }
  }

  return (
    <div
      className="edit-overlay"
      onPointerDown={e => { overlayDownRef.current = e.target === e.currentTarget; }}
      onPointerUp={e => { if (overlayDownRef.current && e.target === e.currentTarget) onCancel(); }}
    >
      <div className="edit-panel" style={{ maxWidth: 360 }}>
        <div className="edit-panel-inner">
          <div className="edit-panel-header">
            <h3>Confirm Action</h3>
            <button className="edit-panel-close" onClick={onCancel}>✕</button>
          </div>
          <p style={{ color: 'var(--header-bg)', fontSize: 14, marginBottom: 20 }}>
            Enter admin password to{' '}
            <strong style={{ color: 'var(--white)' }}>{label}</strong>.
          </p>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <input
                ref={inputRef}
                id="cam-password"
                name="password"
                type="password"
                value={password}
                placeholder="Password"
                onChange={e => { setPassword(e.target.value); setError(''); }}
                style={{ ...FIELD, ...(error ? { borderColor: '#ff6b6b' } : {}) }}
              />
              {error && (
                <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 4 }}>{error}</div>
              )}
            </div>
            <div className="edit-panel-actions">
              <button type="button" className="btn btn-outline btn-lg" onClick={onCancel}>Cancel</button>
              <button type="submit" className="btn btn-gold btn-lg">Confirm</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
