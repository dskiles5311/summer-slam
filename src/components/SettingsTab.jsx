import { useState, useEffect } from 'react';
import { calcWeightedPayouts } from '../utils/calculations';
import { exportCSV, importCSV } from '../utils/csv';
import { evalMath } from '../utils/evalMath';

const PANEL = { background: 'var(--settings-panel-bg)', border: '1px solid rgba(139,180,225,0.2)', borderRadius: 10, padding: 20, marginBottom: 16 };
const H3 = { color: 'var(--header-bg)', fontSize: 14, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 };

export default function SettingsTab({ settings, entries, isUnlocked, onUpdateSettings, onClearAll, onImport, onClearWeighLog }) {
  const { fees, payoutSettings, penalties } = settings;

  const [totalPayout, setTotalPayout]       = useState(payoutSettings.totalPayout || 0);
  const [numWinners, setNumWinners]         = useState(payoutSettings.numWinners  || 10);
  const [minPayout, setMinPayout]           = useState(payoutSettings.minPayout   || 250);
  const [payouts, setPayouts]               = useState(payoutSettings.payouts      || []);
  const [rawInputs, setRawInputs]           = useState(() => (payoutSettings.payouts || []).map(v => String(v || 0)));
  const [localFees, setLocalFees]           = useState(fees);
  const [localPenalties, setLocalPenalties] = useState(penalties);
  const [showLog, setShowLog]               = useState(false);
  const [localFlights, setLocalFlights]     = useState(() => (settings.flights || []).map((f, i) => ({ ...f, _key: i })));
  const [editingFlightIdx, setEditingFlightIdx] = useState(null);
  const [flightDraft, setFlightDraft]       = useState(null);
  const [flightError, setFlightError]       = useState(null);

  useEffect(() => {
    setTotalPayout(payoutSettings.totalPayout || 0);
    setNumWinners(payoutSettings.numWinners   || 10);
    setMinPayout(payoutSettings.minPayout     || 250);
    setPayouts(payoutSettings.payouts         || []);
    setRawInputs((payoutSettings.payouts || []).map(v => String(v || 0)));
  }, [payoutSettings]);

  useEffect(() => { setLocalFees(fees); }, [fees]);
  useEffect(() => { setLocalPenalties(penalties); }, [penalties]);
  useEffect(() => {
    setLocalFlights((settings.flights || []).map((f, i) => ({ ...f, _key: i })));
  }, [settings.flights]);

  function evalExpr(str) {
    const result = evalMath(String(str));
    return isNaN(result) ? 0 : Math.round(result);
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

  function syncPayouts(next, n = numWinners, min = minPayout) {
    setPayouts(next);
    setRawInputs(Array.from({ length: n }, (_, i) => String(next[i] || 0)));
    onUpdateSettings({ payoutSettings: { totalPayout, numWinners: n, minPayout: min, payouts: next } });
  }

  function handleAutoCalc() {
    syncPayouts(calcWithMin(totalPayout, numWinners, minPayout));
  }

  function handleNumWinnersBlur() {
    const n = Math.max(1, parseInt(numWinners) || 1);
    setNumWinners(n);
    if (n === payoutSettings.numWinners) return;
    // Trim or pad with zeros — preserve existing values, don't redistribute
    const next = Array.from({ length: n }, (_, i) => payouts[i] || 0);
    syncPayouts(next, n);
  }

  function handleClearPayouts() {
    setTotalPayout(0);
    setNumWinners(10);
    syncPayouts(Array(10).fill(0), 10);
  }

  function handleResetPayStructure() {
    if (!confirm('Reset payout structure to tournament defaults?')) return;
    const d = {
      totalPayout: 10500,
      numWinners:  17,
      minPayout:   255,
      payouts:     [4000,1000,800,600,500,360,350,340,330,320,295,280,275,270,265,260,255],
    };
    setTotalPayout(d.totalPayout);
    setNumWinners(d.numWinners);
    setMinPayout(d.minPayout);
    setPayouts(d.payouts);
    setRawInputs(d.payouts.map(String));
    onUpdateSettings({ payoutSettings: d });
  }

  function handleInputChange(i, val) {
    const updated = [...rawInputs];
    updated[i] = val;
    setRawInputs(updated);
  }

  function handleInputBlur(i) {
    const evaluated = evalExpr(rawInputs[i]);
    const updated = [...payouts];
    updated[i] = evaluated;
    setPayouts(updated);
    setRawInputs(updated.map(String));
    onUpdateSettings({ payoutSettings: { totalPayout, numWinners, minPayout, payouts: updated } });
  }

  function flightSortAndStrip(arr) {
    const sorted = [...arr].sort((a, b) => (parseInt(a.boatStart) || 0) - (parseInt(b.boatStart) || 0));
    return sorted.map(({ _key, ...rest }) => rest);
  }

  function handleFlightAdd() {
    setFlightDraft({ boatStart: '', boatEnd: '', launchTime: '', checkInTime: '' });
    setEditingFlightIdx('new');
  }

  function handleFlightEdit(idx) {
    setFlightDraft({ ...localFlights[idx] });
    setEditingFlightIdx(idx);
  }

  function handleFlightDelete(idx) {
    if (!confirm('Delete this flight?')) return;
    const updated = localFlights.filter((_, i) => i !== idx);
    setLocalFlights(updated);
    onUpdateSettings({ flights: flightSortAndStrip(updated) });
  }

  function handleFlightSave() {
    const start = parseInt(flightDraft.boatStart) || 0;
    const end   = parseInt(flightDraft.boatEnd)   || 0;

    if (!start || !end) {
      setFlightError('Boat # Start and End are required.');
      return;
    }
    if (end < start) {
      setFlightError('Boat # End must be greater than or equal to Start.');
      return;
    }

    // Check for overlaps with other flights (skip the one being edited)
    const others = editingFlightIdx === 'new'
      ? localFlights
      : localFlights.filter((_, i) => i !== editingFlightIdx);

    const overlap = others.find(fl => {
      const s = parseInt(fl.boatStart) || 0;
      const e = parseInt(fl.boatEnd)   || 0;
      return start <= e && end >= s;
    });
    if (overlap) {
      const overlapNum = localFlights.indexOf(overlap) + 1;
      setFlightError(`Overlaps with Flight ${overlapNum} (boats #${overlap.boatStart}–#${overlap.boatEnd}).`);
      return;
    }

    setFlightError(null);
    const f = {
      boatStart:   start,
      boatEnd:     end,
      launchTime:  (flightDraft.launchTime  || '').trim(),
      checkInTime: (flightDraft.checkInTime || '').trim(),
    };
    let updated;
    if (editingFlightIdx === 'new') {
      updated = [...localFlights, { ...f, _key: Date.now() }];
    } else {
      updated = localFlights.map((fl, i) => i === editingFlightIdx ? { ...fl, ...f } : fl);
    }
    setLocalFlights(updated);
    onUpdateSettings({ flights: flightSortAndStrip(updated) });
    setEditingFlightIdx(null);
    setFlightDraft(null);
  }

  function handleFlightCancel() {
    setEditingFlightIdx(null);
    setFlightDraft(null);
    setFlightError(null);
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
      <div className="toolbar">
        <h2 style={{ color: 'var(--gold-light)', fontSize: 18, fontWeight: 800 }}>Tournament Settings</h2>
        {locked && <span style={{ fontSize: 12, color: 'rgba(255,180,80,0.85)', fontWeight: 600 }}>🔒 Locked</span>}
      </div>
      <div style={{ maxWidth: 640, margin: '0 auto', paddingTop: 16 }}>
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
            <button className="btn btn-outline btn-sm" onClick={handleResetPayStructure} disabled={locked}>↺ Reset to Default</button>
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
                            onKeyDown={e => { if (e.key === 'Enter') { e.target.blur(); } }}
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
          <div className="edit-grid-3" style={{ marginBottom: 12 }}>
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
          <div className="edit-grid-2">
            <div className="form-field">
              <label>Option 1 Payout (%)</label>
              <input type="number" value={localFees.option1Pct ?? 70} min="0" max="100" step="1" disabled={locked}
                     onChange={e => setLocalFees(prev => ({ ...prev, option1Pct: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) }))}
                     onBlur={() => onUpdateSettings({ fees: localFees })} />
            </div>
            <div className="form-field">
              <label>Option 2 Payout (%)</label>
              <input type="number" value={100 - (localFees.option1Pct ?? 70)} disabled
                     style={{ opacity: 0.6 }} />
            </div>
          </div>
          <p style={{ color: 'var(--header-bg)', fontSize: 11, marginTop: 8 }}>
            Lunker Pot = Lunker Fee × number of "Lunker Paid = Yes" entries.<br />
            Option Pot = Option Fee × number of "Option Paid = Yes" entries.<br />
            Option 2 % is automatically set to 100 minus Option 1 %.<br />
            Buy-In cells are highlighted red if below the entry fee amount.
          </p>
        </div>

        {/* Penalties */}
        <div style={PANEL}>
          <h3 style={H3}>Penalties</h3>
          <div className="edit-grid-2" style={{ marginBottom: 12 }}>
            <div className="form-field">
              <label>Dead Fish (lbs per fish)</label>
              <input type="number" value={localPenalties?.deadFishPenalty ?? 0.5} min="0" step="0.01" disabled={locked}
                     onChange={e => setLocalPenalties(prev => ({ ...prev, deadFishPenalty: parseFloat(e.target.value) || 0 }))}
                     onBlur={() => onUpdateSettings({ penalties: localPenalties })} />
            </div>
            <div className="form-field">
              <label>Short Fish — weight deduction (lbs per fish)</label>
              <input type="number" value={localPenalties?.shortFishPenalty ?? 1.0} min="0" step="0.01" disabled={locked}
                     onChange={e => setLocalPenalties(prev => ({ ...prev, shortFishPenalty: parseFloat(e.target.value) || 0 }))}
                     onBlur={() => onUpdateSettings({ penalties: localPenalties })} />
            </div>
            <div className="form-field">
              <label>Short Fish — fish count deduction (per fish)</label>
              <input type="number" value={localPenalties?.shortFishCountPenalty ?? 1} min="0" max="1" step="1" disabled={locked}
                     onChange={e => setLocalPenalties(prev => ({ ...prev, shortFishCountPenalty: parseInt(e.target.value) || 0 }))}
                     onBlur={() => onUpdateSettings({ penalties: localPenalties })} />
            </div>
            <div className="form-field">
              <label>Over Limit (lbs per fish over max)</label>
              <input type="number" value={localPenalties?.overLimitPenalty ?? 3.0} min="0" step="0.01" disabled={locked}
                     onChange={e => setLocalPenalties(prev => ({ ...prev, overLimitPenalty: parseFloat(e.target.value) || 0 }))}
                     onBlur={() => onUpdateSettings({ penalties: localPenalties })} />
            </div>
            <div className="form-field">
              <label>Max Fish Limit</label>
              <input type="number" value={localPenalties?.maxFish ?? 5} min="1" step="1" disabled={locked}
                     onChange={e => setLocalPenalties(prev => ({ ...prev, maxFish: parseInt(e.target.value) || 1 }))}
                     onBlur={() => onUpdateSettings({ penalties: localPenalties })} />
            </div>
          </div>
          <p style={{ color: 'var(--header-bg)', fontSize: 11, marginTop: 8 }}>
            Dead fish: deduct X lbs per dead fish from total weight.<br />
            Short fish: deduct X lbs from total weight and X from fish count per short fish.<br />
            Over limit: deduct X lbs for each fish over the max limit.
          </p>
        </div>

        {/* Leaderboard Display */}
        <div style={PANEL}>
          <h3 style={H3}>Leaderboard Display</h3>
          <div className="edit-grid-3">
            <div className="form-field">
              <label>Recent Weigh-Ins to Show</label>
              <input type="number" value={settings.recentWeighCount ?? 2} min="0" max="10" step="1" disabled={locked}
                     onChange={e => onUpdateSettings({ recentWeighCount: Math.max(0, parseInt(e.target.value) || 0) })} />
            </div>
          </div>
          <p style={{ color: 'var(--header-bg)', fontSize: 11, marginTop: 8 }}>
            Shows the most recent weigh-ins in a bar above the leaderboard. Set to 0 to hide.
          </p>
        </div>

        {/* Flight Schedule */}
        <div style={PANEL}>
          <h3 style={H3}>Flight Schedule</h3>

          {localFlights.length === 0 && editingFlightIdx === null && (
            <p style={{ color: 'var(--header-bg)', fontSize: 13, marginBottom: 12 }}>
              No flights configured.{!locked && ' Add a flight to assign boats to launch groups on the Flights tab.'}
            </p>
          )}

          {localFlights.map((fl, idx) => (
            <div key={fl._key} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,180,225,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
              {editingFlightIdx === idx ? (
                <FlightForm draft={flightDraft} onChange={setFlightDraft} onSave={handleFlightSave} onCancel={handleFlightCancel} error={flightError} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 700, color: 'var(--gold-light)', marginRight: 8 }}>Flight {idx + 1}</span>
                    <span style={{ color: 'var(--header-bg)', fontSize: 13 }}>
                      Boats #{fl.boatStart}–#{fl.boatEnd}
                      {fl.launchTime  && <span> · 🚤 {fl.launchTime}</span>}
                      {fl.checkInTime && <span> · 📋 {fl.checkInTime}</span>}
                    </span>
                  </div>
                  {!locked && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => handleFlightEdit(idx)}>✏️ Edit</button>
                      <button className="btn btn-danger btn-sm"  onClick={() => handleFlightDelete(idx)}>🗑️</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {editingFlightIdx === 'new' && (
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,180,225,0.35)', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
              <FlightForm draft={flightDraft} onChange={setFlightDraft} onSave={handleFlightSave} onCancel={handleFlightCancel} error={flightError} />
            </div>
          )}

          {!locked && editingFlightIdx === null && (
            <button className="btn btn-primary btn-sm" style={{ marginTop: 4 }} onClick={handleFlightAdd}>
              + Add Flight
            </button>
          )}
        </div>

        {/* Data Management */}
        <div style={PANEL}>
          <h3 style={H3}>Data Management</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => exportCSV(entries, payoutSettings)}>💾 Export CSV</button>
            <button className="btn btn-outline" onClick={() => setShowLog(true)}>📋 Weigh-In Log</button>
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

        <div style={{ textAlign: 'center', padding: '8px 0 4px', color: 'var(--header-bg)', fontSize: 12 }}>
          <div style={{ marginBottom: 4 }}>Summer Slam Tournament Manager <span style={{ color: 'var(--gold-light)', fontWeight: 700 }}>v1.0.0</span></div>
          <div>Created by <strong style={{ color: 'var(--white)' }}>David Skiles</strong></div>
        </div>
      </div>

      {showLog && <WeighInLogModal entries={entries} penalties={penalties} onClose={() => setShowLog(false)} onClearLog={onClearWeighLog} />}
    </div>
  );
}

function calcEntryPenalties(e, penalties = {}) {
  const deadRate       = parseFloat(penalties.deadFishPenalty)       || 0.5;
  const shortRate      = parseFloat(penalties.shortFishPenalty)      || 1.0;
  const shortCountRate = parseInt(penalties.shortFishCountPenalty)   ?? 1;
  const overRate       = parseFloat(penalties.overLimitPenalty)      || 3.0;
  const maxFish        = parseInt(penalties.maxFish)                 || 5;
  const dead = Math.max(0, parseInt(e.deadFish)  || 0);
  const shrt = Math.max(0, parseInt(e.shortFish) || 0);
  // numFish is stored post-adjustment (short fish already removed), so
  // reconstruct the raw count to correctly derive the over-limit count.
  const adjFish     = Math.max(0, parseInt(e.numFish) || 0);
  const shrtFishDed = shrt * shortCountRate;
  const rawFish     = adjFish + shrtFishDed;
  const over        = Math.max(0, rawFish - maxFish);
  const deadPen     = dead * deadRate;
  const shortPen    = shrt * shortRate;
  const overPen     = over * overRate;
  return { dead, shrt, shrtFishDed, rawFish, adjFish, over, deadPen, shortPen, overPen, total: deadPen + shortPen + overPen };
}

function WeighInLogModal({ entries, penalties, onClose, onClearLog }) {
  const overlayDownRef = { current: false };

  const logged = [...entries]
    .filter(e => e.weighedAt)
    .sort((a, b) => new Date(a.weighedAt) - new Date(b.weighedAt));

  function fmtTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts + (ts.includes('Z') || ts.includes('+') ? '' : 'Z'));
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function penaltyLines(e) {
    const pen = calcEntryPenalties(e, penalties);
    const lines = [];
    if (pen.dead > 0)  lines.push(`${pen.dead} dead −${pen.deadPen.toFixed(2)} lbs`);
    if (pen.shrt > 0)  lines.push(`${pen.shrt} short −${pen.shortPen.toFixed(2)} lbs${pen.shrtFishDed > 0 ? `, fish ${pen.rawFish}→${pen.adjFish}` : ''}`);
    if (pen.over > 0)  lines.push(`${pen.over} over limit −${pen.overPen.toFixed(2)} lbs`);
    if (pen.total > 0) lines.push(`Wt penalty −${pen.total.toFixed(2)} lbs`);
    return { lines, total: pen.total };
  }

  function handlePrint() {
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const rows = logged.map((e, i) => {
      const lw  = parseFloat(e.lunkerWeight) || 0;
      const tw  = parseFloat(e.totalWeight)  || 0;
      const rw  = parseFloat(e.rawWeight)    || 0;
      const { lines, total: penTotal } = penaltyLines(e);
      const dedCell = lines.length ? lines.join('<br>') : '—';
      const boater   = esc([e.boaterFirst, e.boaterLast].filter(Boolean).join(' ') || '—');
      const coAngler = esc([e.coAnglerFirst, e.coAnglerLast].filter(Boolean).join(' ') || '—');
      return `<tr>
        <td style="text-align:right">${i + 1}</td>
        <td>${fmtTime(e.weighedAt)}</td>
        <td>#${esc(e.boatNo || '—')}</td>
        <td>${boater}</td>
        <td>${coAngler}</td>
        <td style="text-align:right">${e.numFish || 0}</td>
        <td style="text-align:right">${lw > 0 ? lw.toFixed(2) : '—'}</td>
        <td style="text-align:right">${rw > 0 ? rw.toFixed(2) : '—'}</td>
        <td style="text-align:right;color:${penTotal > 0 ? '#c0392b' : '#555'}">${dedCell}</td>
        <td style="text-align:right;font-weight:700">${tw > 0 ? tw.toFixed(2) : '—'}</td>
      </tr>`;
    }).join('');
    const win = window.open('', '_blank', 'width=960,height=600');
    win.document.write(`<!DOCTYPE html><html><head><title>Weigh-In Log</title>
      <style>
        body{font-family:sans-serif;font-size:12px;padding:20px;color:#000}
        h2{margin-bottom:4px}p{margin-bottom:12px;color:#555;font-size:11px}
        table{width:100%;border-collapse:collapse}
        th{text-align:left;padding:6px 8px;background:#1a3a6e;color:#fff;font-size:11px;text-transform:uppercase}
        td{padding:5px 8px;border-bottom:1px solid #ddd;vertical-align:top}
        tr:nth-child(even) td{background:#f9f9f9}
      </style></head><body>
      <h2>Summer Slam — Weigh-In Log</h2>
      <p>Printed ${new Date().toLocaleString()} &nbsp;·&nbsp; ${logged.length} weigh-in${logged.length !== 1 ? 's' : ''}</p>
      <table><thead><tr>
        <th style="text-align:right">#</th><th>Time</th><th>Boat</th>
        <th>Boater</th><th>Co-Angler</th>
        <th style="text-align:right">Fish (Adj)</th>
        <th style="text-align:right">Lunker</th>
        <th style="text-align:right">Scale Wt</th>
        <th style="text-align:right">Deductions</th>
        <th style="text-align:right">Adj Wt</th>
      </tr></thead><tbody>${rows}</tbody></table>
      <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script>
      </body></html>`);
    win.document.close();
  }

  function handleExport() {
    const header = ['#', 'Time', 'Boat', 'Boater', 'Co-Angler', 'Fish (Adj)', 'Lunker', 'Scale Wt', 'Deductions', 'Adj Wt'];
    const csvRows = [header, ...logged.map((e, i) => {
      const lw = parseFloat(e.lunkerWeight) || 0;
      const tw = parseFloat(e.totalWeight)  || 0;
      const rw = parseFloat(e.rawWeight)    || 0;
      const { lines } = penaltyLines(e);
      const csvEsc = v => `"${String(v).replace(/"/g, '""')}"`;
      return [
        i + 1,
        fmtTime(e.weighedAt),
        `#${e.boatNo || ''}`,
        csvEsc([e.boaterFirst, e.boaterLast].filter(Boolean).join(' ') || ''),
        csvEsc([e.coAnglerFirst, e.coAnglerLast].filter(Boolean).join(' ') || ''),
        e.numFish || 0,
        lw > 0 ? lw.toFixed(2) : '',
        rw > 0 ? rw.toFixed(2) : '',
        csvEsc(lines.join(' / ')),
        tw > 0 ? tw.toFixed(2) : '',
      ];
    })].map(r => r.join(',')).join('\r\n');
    const blob = new Blob([csvRows], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `weigh-in-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleClear() {
    if (!confirm('Clear the weigh-in log? This removes timestamps from all entries and cannot be undone.')) return;
    onClearLog();
    onClose();
  }

  const rightAligned = new Set(['#', 'Fish (Adj)', 'Lunker', 'Scale Wt', 'Deductions', 'Adj Wt']);

  return (
    <div
      className="edit-overlay"
      onPointerDown={e => { overlayDownRef.current = e.target === e.currentTarget; }}
      onPointerUp={e => { if (overlayDownRef.current && e.target === e.currentTarget) onClose(); }}
    >
      <div className="edit-panel" style={{ maxWidth: 900, width: '95vw' }}>
        <div className="edit-panel-inner">
          <div className="edit-panel-header">
            <h3>📋 Weigh-In Log</h3>
            <button className="edit-panel-close" onClick={onClose}>✕</button>
          </div>
          <p style={{ color: 'var(--header-bg)', fontSize: 12, marginBottom: 14 }}>
            {logged.length} weigh-in{logged.length !== 1 ? 's' : ''} recorded · read-only · ordered by time
          </p>
          {logged.length === 0 ? (
            <p style={{ color: 'var(--header-bg)', textAlign: 'center', padding: '32px 0' }}>
              No weigh-ins recorded yet.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['#', 'Time', 'Boat', 'Boater', 'Co-Angler', 'Fish (Adj)', 'Lunker', 'Scale Wt', 'Deductions', 'Adj Wt'].map(h => (
                      <th key={h} style={{ textAlign: rightAligned.has(h) ? 'right' : 'left', padding: '6px 10px', color: 'var(--header-bg)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, borderBottom: '1px solid rgba(139,180,225,0.2)', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logged.map((e, i) => {
                    const lw = parseFloat(e.lunkerWeight) || 0;
                    const tw = parseFloat(e.totalWeight)  || 0;
                    const rw = parseFloat(e.rawWeight)    || 0;
                    const { lines, total: penTotal } = penaltyLines(e);
                    return (
                      <tr key={e.id} style={{ borderBottom: '1px solid rgba(139,180,225,0.08)' }}>
                        <td style={{ padding: '7px 10px', color: 'var(--header-bg)', textAlign: 'right', fontWeight: 600 }}>{i + 1}</td>
                        <td style={{ padding: '7px 10px', color: 'var(--gold-light)', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtTime(e.weighedAt)}</td>
                        <td style={{ padding: '7px 10px', fontWeight: 700 }}>#{e.boatNo || '—'}</td>
                        <td style={{ padding: '7px 10px' }}>{[e.boaterFirst, e.boaterLast].filter(Boolean).join(' ') || '—'}</td>
                        <td style={{ padding: '7px 10px', color: 'var(--header-bg)' }}>{[e.coAnglerFirst, e.coAnglerLast].filter(Boolean).join(' ') || '—'}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right' }}>{e.numFish || 0}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--header-bg)' }}>{lw > 0 ? lw.toFixed(2) : '—'}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--header-bg)' }}>{rw > 0 ? rw.toFixed(2) : '—'}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: penTotal > 0 ? '#ff6b6b' : 'var(--header-bg)', fontSize: 12, lineHeight: 1.6, verticalAlign: 'top' }}>
                          {lines.length ? lines.map((l, j) => <div key={j}>{l}</div>) : '—'}
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--gold-light)' }}>{tw > 0 ? tw.toFixed(2) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button className="btn btn-danger btn-lg" onClick={handleClear} style={{ marginRight: 'auto' }}>🗑️ Clear Log</button>
            <button className="btn btn-outline btn-lg" onClick={handleExport} disabled={logged.length === 0}>💾 Export CSV</button>
            <button className="btn btn-outline btn-lg" onClick={handlePrint} disabled={logged.length === 0}>🖨️ Print</button>
            <button className="btn btn-outline btn-lg" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const ampmMatch = s.match(/\s*(am|pm)$/i);
  const ampm = ampmMatch ? ' ' + ampmMatch[1].toUpperCase() : '';
  const timePart = ampmMatch ? s.slice(0, -ampmMatch[0].length).trim() : s;
  const digits = timePart.replace(/\D/g, '');
  if (!digits) return s;
  let h, m;
  if      (digits.length <= 2) { h = parseInt(digits);           m = 0; }
  else if (digits.length === 3) { h = parseInt(digits[0]);        m = parseInt(digits.slice(1)); }
  else if (digits.length === 4) { h = parseInt(digits.slice(0,2)); m = parseInt(digits.slice(2)); }
  else return s;
  if (isNaN(h) || isNaN(m) || m > 59 || h > 23) return s;
  return `${h}:${String(m).padStart(2, '0')}${ampm}`;
}

function FlightForm({ draft, onChange, onSave, onCancel, error }) {
  return (
    <div style={{ width: '100%' }}>
      <div className="edit-grid-2" style={{ marginBottom: 8 }}>
        <div className="form-field">
          <label>Launch Time</label>
          <input type="text" value={draft.launchTime} placeholder="e.g. 715 AM"
                 onChange={e => onChange(prev => ({ ...prev, launchTime: e.target.value }))}
                 onBlur={e => onChange(prev => ({ ...prev, launchTime: formatTime(e.target.value) }))} />
        </div>
        <div className="form-field">
          <label>Boat # Start</label>
          <input type="number" value={draft.boatStart} min="1" inputMode="numeric"
                 onChange={e => onChange(prev => ({ ...prev, boatStart: e.target.value }))} />
        </div>
        <div className="form-field">
          <label>Boat # End</label>
          <input type="number" value={draft.boatEnd} min="1" inputMode="numeric"
                 onChange={e => onChange(prev => ({ ...prev, boatEnd: e.target.value }))} />
        </div>
        <div className="form-field">
          <label>Check-In Time</label>
          <input type="text" value={draft.checkInTime} placeholder="e.g. 315 PM"
                 onChange={e => onChange(prev => ({ ...prev, checkInTime: e.target.value }))}
                 onBlur={e => onChange(prev => ({ ...prev, checkInTime: formatTime(e.target.value) }))} />
        </div>
      </div>
      {error && (
        <div style={{ fontSize: 12, color: '#ff9090', background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.35)', borderRadius: 6, padding: '6px 10px', marginBottom: 6 }}>
          ⚠️ {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button className="btn btn-primary btn-sm" onClick={onSave}>Save</button>
        <button className="btn btn-outline btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
