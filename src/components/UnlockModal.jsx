import { useState, useEffect, useRef, useCallback } from 'react';

export default function UnlockModal({ onUnlock, onCancel }) {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const inputRef = useRef(null);
  const overlayDownRef = useRef(false);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onUnlock(password);
    } catch {
      setError('Incorrect password');
      setPassword('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
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
            <h3>🔒 Unlock Editing</h3>
            <button className="edit-panel-close" onClick={onCancel}>✕</button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-field" style={{ marginBottom: 16 }}>
              <label>Password</label>
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 12 }}>{error}</p>
            )}
            <div className="edit-panel-actions">
              <button type="button" className="btn btn-outline btn-lg" onClick={onCancel}>Cancel</button>
              <button type="submit" className="btn btn-gold btn-lg" disabled={loading || !password}>
                {loading ? 'Checking…' : '🔓 Unlock'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
