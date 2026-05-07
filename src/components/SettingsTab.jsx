import { useState, useEffect, Fragment } from 'react';
import { calcWeightedPayouts } from '../utils/calculations';
import { exportCSV, importCSV } from '../utils/csv';

const PANEL = { background: 'var(--settings-panel-bg)', border: '1px solid rgba(139,180,225,0.2)', borderRadius: 10, padding: 20, marginBottom: 16 };
const H3 = { color: 'var(--header-bg)', fontSize: 14, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 };

export default function SettingsTab({ settings, entries, isUnlocked, onUpdateSettings, onClearAll, onImport }) {
  const { fees, payoutSettings } = settings;

  const [totalPayout, setTotalPayout] = useState(payoutSettings.totalPayout || 0);
  const [numWinners, setNumWinners]   = useState(payoutSettings.numWinners  || 10);
  const [minPayout, setMinPayout]     = useState(payoutSettings.minPayout   || 250);
  const [payouts, setPayouts]         = useState(payoutSettings.payouts      || []);
  const [rawInputs, setRawInputs]     = useState(() => (payoutSettings.payouts || []).map(v => String(v || 0)));
  const [rowErrors, setRowErrors]     = useState([]);
  const [localFees, setLocalFees]     = useState(fees);

  useEffect(() => {
    setTotalPayout(payoutSettings.totalPayout || 0);
    setNumWinners(payoutSettings.numWinners   || 10);
    setMinPayout(payoutSettings.minPayout     || 250);
    setPayouts(payoutSettings.payouts         || []);
    setRawInputs((payoutSettings.payouts || []).map(v => String(v || 0)));
  }, [payoutSettings]);

  useEffect(() => { setLocalFees(fees); }, [fees]);

  function evalExpr(str) {
    const cleaned = String(str).replace(/[^0-9+\-*/.() ]/g, '').trim();
    if (!cleaned) return 0;
    try {
      const result = Function('"use strict"; return (' + cleaned + ')')();
      return isFinite(result) ? Math.round(result) : 0;
    } catch { return 0; }
  }

  // Weighted distribution guaranteeing the last-place floor.
  // Finds the largest group of bottom positions that all receive exactly
  // `floor`, such that the remaining top positions, when distributed with
  // the weighted formula, still give their own last position >= floor.
  // This prevents a lower place ever receiving more than the place above it.
  function calcWithMin(total, n, floor) {
    if (n <= 0 || total <= 0) return Array(Math.max(n, 0)).fill(0);
    if (floor <= 0) return calcWeightedPayouts(total, n);

    for (let k = 0; k < n; k++) {
      const topCount = n - k;
      const budget = total - k * floor;
      if (budget <= 0) break;
      const top = calcWeightedPayouts(budget, topCount);
      // Boundary holds when the last top-group position is >= floor
      if (top[topCount - 1] >= floor) {
        const result = [...top, ...Array(k).fill(floor)];
        // Absorb any rounding gap into first place
        const gap = total - result.reduce((a, b) => a + b, 0);
        if (gap !== 0) result[0] += gap;
        return result;
      }
    }
    // Fallback: budget can't support the floor for every position
    const each = Math.floor(total / n);
    const arr = Array(n).fill(each);
    arr[0] += total - each * n;
    return arr;
  }

  // Builds the distribution for positions below the edited row using a cascade cap:
  // each position receives min(its_natural_weighted_amount, the_position_above_it).
  // This guarantees strict monotonic ordering regardless of how large the budget is
  // relative to the ceiling. Winner count contracts when budget can't sustain the floor
  // for all minCount positions, and expands when budget remains after all positions are
  // filled and the floor would still be met by one more position.
  function redistributeBelow(budget, minCount, maxFirst, floor) {
    if (budget <= 0 || minCount <= 0) return { dist: [], count: 0 };

    const results = [];
    let remaining = budget;
    let ceiling = maxFirst > 0 ? maxFirst : Infinity;
    // Start with floor-constrained count (contraction); expand later if budget allows
    let targetCount = floor > 0
      ? Math.max(1, Math.min(minCount, Math.floor(budget / floor)))
      : minCount;

    for (let i = 0; remaining > 0; i++) {
      // After filling targetCount, expand by one if remaining budget meets the floor
      if (i >= targetCount) {
        if (floor > 0 && remaining >= floor) targetCount++;
        else break;
      }

      // How many positions are left, capped by what floor can support from remaining budget
      const posLeft = Math.max(1, Math.min(
        targetCount - i,
        floor > 0 ? Math.floor(remaining / floor) : targetCount - i
      ));

      const natural = calcWithMin(remaining, posLeft, floor)[0];
      const amt = isFinite(ceiling) ? Math.min(natural, ceiling) : natural;

      if (amt <= 0) break;

      results.push(amt);
      remaining -= amt;
      ceiling = amt; // Next position must be <= this one
    }

    return { dist: results, count: results.length };
  }

  function syncPayouts(next, n = numWinners, min = minPayout) {
    setPayouts(next);
    setRawInputs(Array.from({ length: n }, (_, i) => String(next[i] || 0)));
    setRowErrors([]);
    onUpdateSettings({ payoutSettings: { totalPayout, numWinners: n, minPayout: min, payouts: next } });
  }

  function handleAutoCalc() {
    syncPayouts(calcWithMin(totalPayout, numWinners, minPayout));
  }

  function handleNumWinnersBlur() {
    const n = Math.max(1, parseInt(numWinners) || 1);
    setNumWinners(n);
    // If payouts already exist, recalculate the whole distribution so the
    // minimum floor is preserved for the new last position.
    const hasPayouts = payouts.some(p => p > 0);
    const next = hasPayouts
      ? calcWithMin(totalPayout, n, minPayout)
      : Array.from({ length: n }, (_, i) => payouts[i] || 0);
    syncPayouts(next, n);
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
    if (rowErrors[i]) {
      const errs = [...rowErrors];
      errs[i] = null;
      setRowErrors(errs);
    }
  }

  function handleInputBlur(i) {
    const evaluated = evalExpr(rawInputs[i]);

    // Positions above this row are locked
    const lockedAbove = payouts.slice(0, i).reduce((s, v) => s + (v || 0), 0);
    const remainingForThisAndBelow = Math.max(0, totalPayout - lockedAbove);
    const capped = Math.max(0, Math.min(evaluated, remainingForThisAndBelow));

    const belowBudget = remainingForThisAndBelow - capped;
    const minBelowCount = numWinners - i - 1;

    // Redistribute below — may expand winner count to keep positions monotonically decreasing
    let finalBelow, finalBelowCount;
    if (minBelowCount <= 0 || belowBudget <= 0) {
      finalBelow = Array(Math.max(0, minBelowCount)).fill(0);
      finalBelowCount = Math.max(0, minBelowCount);
    } else {
      const result = redistributeBelow(belowBudget, minBelowCount, capped, minPayout);
      finalBelow = result.dist;
      finalBelowCount = result.count;
    }

    const newNumWinners = i + 1 + finalBelowCount;
    const updated = [...payouts.slice(0, i), capped, ...finalBelow];

    setNumWinners(newNumWinners);
    setPayouts(updated);
    setRawInputs(Array.from({ length: newNumWinners }, (_, j) => String(updated[j] || 0)));
    const errs = Array(newNumWinners).fill(null);
    if (evaluated > remainingForThisAndBelow) {
      errs[i] = `Exceeds remaining balance — capped at $${remainingForThisAndBelow.toLocaleString()}`;
    }
    setRowErrors(errs);
    onUpdateSettings({ payoutSettings: { totalPayout, numWinners: newNumWinners, minPayout, payouts: updated } });
  }

  const rowTotal = payouts.reduce((a, b) => a + (b || 0), 0);
  const diff = totalPayout - rowTotal;
  const diffColor = diff === 0 ? '#4CAF50' : diff > 0 ? '#ffb450' : '#ff6b6b';
  const diffLabel = diff === 0 ? '✔ Balanced' : diff > 0 ? `$${diff.toLocaleString()} unallocated` : `$${Math.abs(diff).toLocaleString()} over budget`;
  const floorWarning = totalPayout > 0 && totalPayout < numWinners * minPayout
    ? `⚠ Budget too low to guarantee $${minPayout.toLocaleString()} floor for all ${numWinners} positions`
    : null;
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
          <div className="edit-grid-3" style={{ marginBottom: 14 }}>
            <div className="form-field">
              <label>Total Payout ($)</label>
              <input type="number" value={totalPayout} min="0" step="1" inputMode="numeric" disabled={locked}
                     onChange={e => setTotalPayout(parseInt(e.target.value) || 0)}
                     onBlur={() => onUpdateSettings({ payoutSettings: { totalPayout, numWinners, minPayout, payouts } })} />
            </div>
            <div className="form-field">
              <label>Number of Winners</label>
              <input type="number" value={numWinners} min="1" max="100" step="1" inputMode="numeric" disabled={locked}
                     onChange={e => setNumWinners(parseInt(e.target.value) || 1)}
                     onBlur={handleNumWinnersBlur} />
            </div>
            <div className="form-field">
              <label>Min Last Place ($)</label>
              <input type="number" value={minPayout} min="0" step="1" inputMode="numeric" disabled={locked}
                     onChange={e => setMinPayout(parseInt(e.target.value) || 0)}
                     onBlur={() => onUpdateSettings({ payoutSettings: { totalPayout, numWinners, minPayout, payouts } })} />
            </div>
          </div>
          {floorWarning && (
            <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.35)', borderRadius: 6, padding: '7px 12px', marginBottom: 10, fontSize: 12, color: '#ff9090', fontWeight: 600 }}>
              {floorWarning}
            </div>
          )}
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
                    const err = rowErrors[i];
                    return (
                      <Fragment key={i}>
                        <tr style={{ borderBottom: err ? 'none' : '1px solid rgba(139,180,225,0.08)' }}>
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
                              onKeyDown={e => { if (e.key === 'Enter') { e.target.blur(); } }}
                              onFocus={e => e.target.select()}
                              placeholder="0 or 100+50"
                              style={{ width: 110, padding: '4px 6px', background: err ? 'rgba(255,107,107,0.12)' : 'rgba(255,255,255,0.08)', border: `1px solid ${err ? '#ff6b6b' : 'rgba(139,180,225,0.3)'}`, borderRadius: 5, color: 'var(--white)', fontSize: 13, textAlign: 'right', fontWeight: 600 }}
                            />
                          </td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--header-bg)', fontSize: 12 }}>{pct}%</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: balColor }}>
                            ${runningBalance.toLocaleString()}
                          </td>
                        </tr>
                        {err && (
                          <tr key={`err-${i}`} style={{ borderBottom: '1px solid rgba(139,180,225,0.08)' }}>
                            <td colSpan={4} style={{ padding: '2px 8px 6px', color: '#ff6b6b', fontSize: 11, fontWeight: 600 }}>
                              ⚠ {err}
                            </td>
                          </tr>
                        )}
                      </Fragment>
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
              <input type="number" value={localFees.entryFee} min="0" step="1" disabled={locked}
                     onChange={e => setLocalFees(prev => ({ ...prev, entryFee: parseFloat(e.target.value) || 0 }))}
                     onBlur={() => onUpdateSettings({ fees: localFees })} />
            </div>
            <div className="form-field">
              <label>Lunker Fee ($)</label>
              <input type="number" value={localFees.lunkerFee} min="0" step="1" disabled={locked}
                     onChange={e => setLocalFees(prev => ({ ...prev, lunkerFee: parseFloat(e.target.value) || 0 }))}
                     onBlur={() => onUpdateSettings({ fees: localFees })} />
            </div>
            <div className="form-field">
              <label>Option Fee ($)</label>
              <input type="number" value={localFees.optFee} min="0" step="1" disabled={locked}
                     onChange={e => setLocalFees(prev => ({ ...prev, optFee: parseFloat(e.target.value) || 0 }))}
                     onBlur={() => onUpdateSettings({ fees: localFees })} />
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
                         if (f) {
                           if (!confirm('Import will ADD entries to existing data (not replace). Continue?')) {
                             e.target.value = '';
                             return;
                           }
                           importCSV(f).then(onImport).catch(() => {});
                         }
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
