import { useState, useEffect } from 'react';
import { calcWeightedPayouts } from '../utils/calculations';
import { exportCSV, importCSV } from '../utils/csv';

const PANEL = { background: 'var(--settings-panel-bg)', border: '1px solid rgba(139,180,225,0.2)', borderRadius: 10, padding: 20, marginBottom: 16 };
const H3 = { color: 'var(--header-bg)', fontSize: 14, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 };

export default function SettingsTab({ settings, entries, isUnlocked, onUpdateSettings, onClearAll, onImport }) {
  const { fees, payoutSettings } = settings;

  const [totalPayout, setTotalPayout] = useState(payoutSettings.totalPayout || 0);
  const [numWinners, setNumWinners]   = useState(payoutSettings.numWinners  || 10);
  const [payouts, setPayouts]         = useState(payoutSettings.payouts      || []);
  const [rawInputs, setRawInputs]     = useState(() => (payoutSettings.payouts || []).map(v => String(v || 0)));

  useEffect(() => {
    setTotalPayout(payoutSettings.totalPayout || 0);
    setNumWinners(payoutSettings.numWinners   || 10);
    setPayouts(payoutSettings.payouts         || []);
    setRawInputs((payoutSettings.payouts || []).map(v => String(v || 0)));
  }, [payoutSettings]);

  function evalExpr(str) {
    const cleaned = String(str).replace(/[^0-9+\-*/.() ]/g, '').trim();
    if (!cleaned) return 0;
    try {
      const result = Function('"use strict"; return (' + cleaned + ')')();
      return isFinite(result) ? Math.round(result) : 0;
    } catch { return 0; }
  }

  function syncPayouts(next, n = numWinners) {
    setPayouts(next);
    setRawInputs(Array.from({ length: n }, (_, i) => String(next[i] || 0)));
    onUpdateSettings({ payoutSettings: { totalPayout, numWinners: n, payouts: next } });
  }

  function handleAutoCalc() {
    const computed = calcWeightedPayouts(totalPayout, numWinners);
    syncPayouts(computed);
  }

  function handleNumWinnersBlur() {
    const n = Math.max(1, parseInt(numWinners) || 1);
    setNumWinners(n);
    const resized = Array.from({ length: n }, (_, i) => payouts[i] || 0);
    syncPayouts(resized, n);
  }

  function handleClearPayouts() {
    setTotalPayout(0);
    setNumWinners(10);
    syncPayouts(Array(10).fill(0), 10);
  }

  function handleInputChange(i, val) {
    const updated = [...rawInputs];
    updated[i] = val;
    setRawInputs(updated);
  }

  function handleInputBlur(i) {
    const evaluated = evalExpr(rawInputs[i]);
    const otherSum = payouts.reduce((s, v, j) => j !== i ? s + (v || 0) : s, 0);
    const capped = Math.max(0, Math.min(evaluated, totalPayout - otherSum));
    const updated = Array.from({ length: numWinners }, (_, j) => j === i ? capped : (payouts[j] || 0));
    setPayouts(updated);
    const newRaw = [...rawInputs];
    newRaw[i] = String(capped);
    setRawInputs(newRaw);
    onUpdateSettings({ payoutSettings: { totalPayout, numWinners, payouts: updated } });
  }

  const rowTotal = payouts.reduce((a, b) => a + (b || 0), 0);
  const diff = totalPayout - rowTotal;
  const diffColor = diff === 0 ? '#4CAF50' : diff > 0 ? '#ffb450' : '#ff6b6b';
  const diffLabel = diff === 0 ? '✔ Balanced' : diff > 0 ? `$${diff.toLocaleString()} unallocated` : `$${Math.abs(diff).toLocaleString()} over budget`;
  const placeLabel = (i) => i === 0 ? '🥇 1st' : i === 1 ? '🥈 2nd' : i === 2 ? '🥉 3rd' : `${i + 1}th`;

  const locked = !isUnlocked;

  return (
    <div className="tab-panel active">
      <div style={{ maxWidth: 640 }}>
        <h2 style={{ color: 'var(--gold-light)', marginBottom: 20, fontSize: 18 }}>Tournament Settings</h2>
        {locked && (
          <div style={{ background: 'rgba(255,180,80,0.1)', border: '1px solid rgba(255,180,80,0.3)', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: 'rgba(255,180,80,0.9)' }}>
            🔒 Settings are locked. Click <strong>Locked</strong> in the header to unlock editing.
          </div>
        )}

        {/* Payout Structure */}
        <div style={PANEL}>
          <h3 style={H3}>Payout Structure</h3>
          <div className="edit-grid-2" style={{ marginBottom: 14 }}>
            <div className="form-field">
              <label>Total Payout ($)</label>
              <input type="number" value={totalPayout} min="0" step="1" inputMode="numeric" disabled={locked}
                     onChange={e => setTotalPayout(parseInt(e.target.value) || 0)}
                     onBlur={() => onUpdateSettings({ payoutSettings: { totalPayout, numWinners, payouts } })} />
            </div>
            <div className="form-field">
              <label>Number of Winners</label>
              <input type="number" value={numWinners} min="1" max="100" step="1" inputMode="numeric" disabled={locked}
                     onChange={e => setNumWinners(parseInt(e.target.value) || 1)}
                     onBlur={handleNumWinnersBlur} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={handleAutoCalc} disabled={locked}>↻ Auto-Calculate</button>
            <button className="btn btn-outline btn-sm" onClick={handleClearPayouts} disabled={locked}>Clear Payouts</button>
          </div>

          {numWinners > 0 && (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--header-bg)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid rgba(139,180,225,0.2)', width: 70 }}>Place</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--header-bg)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid rgba(139,180,225,0.2)' }}>Payout</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--header-bg)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid rgba(139,180,225,0.2)', width: 55 }}>%</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--header-bg)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid rgba(139,180,225,0.2)', width: 100 }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: numWinners }, (_, i) => {
                    const amt = payouts[i] || 0;
                    const pct = totalPayout > 0 ? ((amt / totalPayout) * 100).toFixed(1) : '0.0';
                    const runningBalance = totalPayout - payouts.slice(0, i + 1).reduce((s, v) => s + (v || 0), 0);
                    const balColor = runningBalance === 0 ? '#4CAF50' : runningBalance < 0 ? '#ff6b6b' : 'var(--header-bg)';
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(139,180,225,0.08)' }}>
                        <td style={{ padding: '5px 8px', color: 'var(--header-bg)', fontWeight: 600 }}>{placeLabel(i)}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right' }}>
                          <span style={{ color: 'var(--header-bg)', marginRight: 2 }}>$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={rawInputs[i] ?? String(amt)}
                            disabled={locked}
                            onChange={e => handleInputChange(i, e.target.value)}
                            onBlur={() => handleInputBlur(i)}
                            onFocus={e => e.target.select()}
                            placeholder="0 or 100+50"
                            style={{ width: 110, padding: '4px 6px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(139,180,225,0.3)', borderRadius: 5, color: 'var(--white)', fontSize: 13, textAlign: 'right', fontWeight: 600 }}
                          />
                        </td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--header-bg)', fontSize: 12 }}>{pct}%</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: balColor }}>
                          ${runningBalance.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--header-bg)', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <span>Allocated: <strong style={{ color: 'var(--white)' }}>${rowTotal.toLocaleString()}</strong></span>
                <span style={{ color: diffColor, fontWeight: 700 }}>{diffLabel}</span>
                {!locked && <span style={{ opacity: 0.6 }}>Tip: enter math like 500+250 in any cell</span>}
              </div>
            </>
          )}
        </div>

        {/* Fee Structure */}
        <div style={PANEL}>
          <h3 style={H3}>Fee Structure</h3>
          <div className="edit-grid-3">
            <div className="form-field">
              <label>Entry Fee ($)</label>
              <input type="number" value={fees.entryFee} min="0" step="1" disabled={locked}
                     onChange={e => onUpdateSettings({ fees: { ...fees, entryFee: parseFloat(e.target.value) || 0 } })} />
            </div>
            <div className="form-field">
              <label>Lunker Fee ($)</label>
              <input type="number" value={fees.lunkerFee} min="0" step="1" disabled={locked}
                     onChange={e => onUpdateSettings({ fees: { ...fees, lunkerFee: parseFloat(e.target.value) || 0 } })} />
            </div>
            <div className="form-field">
              <label>Option Fee ($)</label>
              <input type="number" value={fees.optFee} min="0" step="1" disabled={locked}
                     onChange={e => onUpdateSettings({ fees: { ...fees, optFee: parseFloat(e.target.value) || 0 } })} />
            </div>
          </div>
          <p style={{ color: 'var(--header-bg)', fontSize: 11, marginTop: 8 }}>
            Lunker Pot = Lunker Fee × number of "Lunker Paid = Yes" entries.<br />
            Option Pot = Option Fee × number of "Option Paid = Yes" entries.<br />
            Buy-In cells are highlighted red if below the entry fee amount.
          </p>
        </div>

        {/* Data Management */}
        <div style={PANEL}>
          <h3 style={H3}>Data Management</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => exportCSV(entries, payoutSettings)}>💾 Export CSV</button>
            {isUnlocked && (
              <label className="btn btn-outline" style={{ cursor: 'pointer' }}>
                📂 Import CSV
                <input type="file" accept=".csv" style={{ display: 'none' }}
                       onChange={e => {
                         const f = e.target.files[0];
                         if (f) importCSV(f).then(onImport).catch(() => {});
                         e.target.value = '';
                       }} />
              </label>
            )}
            {isUnlocked && <button className="btn btn-danger" onClick={onClearAll}>🗑️ Clear All Data</button>}
          </div>
        </div>

{/* Install as App */}
        <div style={PANEL}>
          <h3 style={H3}>Install as App</h3>
          <p style={{ color: 'var(--header-bg)', fontSize: 13, lineHeight: 1.7, marginBottom: 12 }}>
            This app can be installed on your device for offline use.
          </p>
          <ul style={{ color: 'var(--header-bg)', fontSize: 12, lineHeight: 2, listStyle: 'disc', paddingLeft: 18 }}>
            <li><strong style={{ color: 'var(--white)' }}>Chrome / Edge (Windows/Mac):</strong> Click the install icon (⊕) in the address bar</li>
            <li><strong style={{ color: 'var(--white)' }}>Safari (Mac):</strong> File → Add to Dock</li>
            <li><strong style={{ color: 'var(--white)' }}>iPhone/iPad:</strong> Share → Add to Home Screen</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
