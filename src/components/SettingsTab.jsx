import { useState, useEffect } from 'react';
import { calcWeightedPayouts } from '../utils/calculations';
import { exportCSV, importCSV } from '../utils/csv';
import { evalMath } from '../utils/evalMath';
import { fetchEventLog, clearEventLog, fetchQrCounts } from '../utils/api';
import { exportRosterPdf } from '../utils/exportRosterPdf';

const PANEL = { background: 'var(--settings-panel-bg)', border: '1px solid rgba(139,180,225,0.2)', borderRadius: 10, padding: 20, marginBottom: 16 };
const H3 = { color: 'var(--header-bg)', fontSize: 14, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' };

export default function SettingsTab({ settings, entries, isUnlocked, onUpdateSettings, onClearAll, onImport, onClearWeighLog, onClearSignUpLog, onClearCheckInLog, onClearCheckOutLog }) {
  const { fees, payoutSettings, penalties } = settings;

  const [totalPayout, setTotalPayout]       = useState(payoutSettings.totalPayout || 0);
  const [numWinners, setNumWinners]         = useState(payoutSettings.numWinners  || 10);
  const [minPayout, setMinPayout]           = useState(payoutSettings.minPayout   || 250);
  const [payouts, setPayouts]               = useState(payoutSettings.payouts      || []);
  const [rawInputs, setRawInputs]           = useState(() => (payoutSettings.payouts || []).map(v => String(v || 0)));
  const [localFees, setLocalFees]           = useState(fees);
  const [localPenalties, setLocalPenalties] = useState(penalties);
  const [showLog, setShowLog]               = useState(false);
  const [showSignUpLog, setShowSignUpLog]   = useState(false);
  const [showCheckInLog, setShowCheckInLog] = useState(false);
  const [showOffWaterLog, setShowOffWaterLog] = useState(false);
  const [tournamentDate, setTournamentDate] = useState(settings.tournamentDate || '');
  const [checkInOpens, setCheckInOpens]     = useState(settings.checkInOpens || '04:00');
  const [localFlights, setLocalFlights]     = useState(() => (settings.flights || []).map((f, i) => ({ ...f, _key: i })));
  const [localPresets, setLocalPresets]     = useState(settings.payoutPresets || []);
  const [editingFlightIdx, setEditingFlightIdx] = useState(null);
  const [flightDraft, setFlightDraft]       = useState(null);
  const [flightError, setFlightError]       = useState(null);
  const [defaultFlightSize, setDefaultFlightSize] = useState(parseInt(settings.defaultFlightSize) || 30);
  const [qrCounts, setQrCounts] = useState(null);

  useEffect(() => {
    fetchQrCounts().then(setQrCounts).catch(() => {});
  }, []);

  useEffect(() => {
    setTotalPayout(payoutSettings.totalPayout || 0);
    setNumWinners(payoutSettings.numWinners   || 10);
    setMinPayout(payoutSettings.minPayout     || 250);
    setPayouts(payoutSettings.payouts         || []);
    setRawInputs((payoutSettings.payouts || []).map(v => String(v || 0)));
  }, [payoutSettings]);

  useEffect(() => { setTournamentDate(settings.tournamentDate || ''); }, [settings.tournamentDate]);
  useEffect(() => { setCheckInOpens(settings.checkInOpens || '04:00'); }, [settings.checkInOpens]);
  useEffect(() => { setDefaultFlightSize(parseInt(settings.defaultFlightSize) || 30); }, [settings.defaultFlightSize]);
  useEffect(() => { setLocalFees(fees); }, [fees]);
  useEffect(() => { setLocalPenalties(penalties); }, [penalties]);
  useEffect(() => {
    setLocalFlights((settings.flights || []).map((f, i) => ({ ...f, _key: i })));
  }, [settings.flights]);
  useEffect(() => { setLocalPresets(settings.payoutPresets || []); }, [settings.payoutPresets]);

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
    const r5 = n => Math.round(n / 5) * 5;
    const n = numWinners;
    const floor = minPayout;
    if (totalPayout <= 0 || n <= 0) return;

    const topCount = Math.min(5, n);
    const backCount = n - topCount;
    const maxTop = totalPayout - backCount * floor;
    const totalPrem = Math.max(0, totalPayout - n * floor);

    // 1st: use current value if valid, else derive from 56% of premium pool
    const first = (payouts[0] > 0 && payouts[0] <= maxTop)
      ? payouts[0]
      : Math.max(floor, r5(floor + totalPrem * 0.56));

    // Cascade 2nd–5th using clean fractions derived from actual payout history
    const RATIOS = [null, 3/7, 2/3, 4/5, 3/4];
    const top = [first];
    for (let i = 1; i < topCount; i++) {
      top.push(Math.max(floor, r5(top[i - 1] * RATIOS[i])));
    }

    // Scale 2nd–5th down if top exceeds available budget
    let topTotal = top.reduce((s, v) => s + v, 0);
    if (topTotal > maxTop && topCount > 1) {
      const avail = maxTop - top[0];
      const need = top.slice(1).reduce((s, v) => s + v, 0);
      const scale = avail > 0 && need > 0 ? avail / need : 0;
      for (let i = 1; i < top.length; i++) {
        top[i] = Math.max(floor, r5(top[i] * scale));
      }
      topTotal = top.reduce((s, v) => s + v, 0);
      // Trim any $5 rounding overshoot from lowest top place
      let i = top.length - 1;
      while (topTotal > maxTop && i >= 1) {
        if (top[i] > floor) { top[i] -= 5; topTotal -= 5; } else i--;
      }
    }

    // Back half: step ladder down to floor in $5 steps
    const backBudget = totalPayout - topTotal;
    const backPrem = backBudget - backCount * floor;
    const back = [];
    if (backCount > 0) {
      if (backPrem <= 0) {
        for (let i = 0; i < backCount; i++) back.push(floor);
      } else {
        // Max k non-floor places: 5*k*(k+1)/2 ≤ backPrem
        let k = 0;
        while (k < backCount && 5 * (k + 1) * (k + 2) / 2 <= backPrem) k++;
        if (k === 0) {
          const b = Array(backCount).fill(floor);
          b[0] = floor + r5(backPrem);
          back.push(...b);
        } else {
          const startPrem = r5((backPrem + 5 * k * (k - 1) / 2) / k);
          let used = 0;
          for (let i = 0; i < backCount; i++) {
            const p = i < k ? Math.max(0, startPrem - 5 * i) : 0;
            back.push(floor + p);
            used += p;
          }
          back[0] += backPrem - used; // absorb $5 rounding into 6th
        }
      }
    }

    // Absorb any final rounding gap into 1st
    const result = [...top, ...back];
    result[0] += totalPayout - result.reduce((s, v) => s + v, 0);
    syncPayouts(result);
  }

  function handleSavePreset() {
    const name = prompt('Name this preset (e.g. "14-Winner Preset (2027)"):');
    if (!name || !name.trim()) return;
    const preset = { name: name.trim(), totalPayout, numWinners, minPayout, payouts: [...payouts] };
    const updated = [...localPresets, preset];
    setLocalPresets(updated);
    onUpdateSettings({ payoutPresets: updated });
  }

  function handleLoadPreset(preset) {
    if (!confirm(`Load "${preset.name}"? This will overwrite your current payout structure.`)) return;
    setTotalPayout(preset.totalPayout);
    setNumWinners(preset.numWinners);
    setMinPayout(preset.minPayout);
    setPayouts(preset.payouts);
    setRawInputs(preset.payouts.map(String));
    onUpdateSettings({ payoutSettings: { totalPayout: preset.totalPayout, numWinners: preset.numWinners, minPayout: preset.minPayout, payouts: preset.payouts } });
  }

  function handleDeletePreset(idx) {
    if (!confirm('Delete this preset?')) return;
    const updated = localPresets.filter((_, i) => i !== idx);
    setLocalPresets(updated);
    onUpdateSettings({ payoutPresets: updated });
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
    if (!confirm('Reset payout structure to tournament defaults? (15 winners / $10,000)')) return;
    const d = {
      totalPayout: 10000,
      numWinners:  15,
      minPayout:   250,
      payouts:     [3500,1500,1000,800,600,280,270,270,265,265,250,250,250,250,250],
    };
    setTotalPayout(d.totalPayout);
    setNumWinners(d.numWinners);
    setMinPayout(d.minPayout);
    setPayouts(d.payouts);
    setRawInputs(d.payouts.map(String));
    onUpdateSettings({ payoutSettings: d });
  }

  function handleReset17Winners() {
    if (!confirm('Apply 17-winner / $10,500 payout structure?')) return;
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
    const sorted = [...localFlights].sort((a, b) => (parseInt(a.boatStart) || 0) - (parseInt(b.boatStart) || 0));
    const last = sorted[sorted.length - 1];
    const size = parseInt(defaultFlightSize) || 30;
    let nextStart = 1;
    if (last) {
      nextStart = last.boatEnd
        ? parseInt(last.boatEnd) + 1
        : parseInt(last.boatStart) + size;
    }
    setFlightDraft({ boatStart: nextStart, boatEnd: 0, launchTime: '', checkInTime: '' });
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
    if (editingFlightIdx === 'new') {
      const newStart = parseInt(flightDraft.boatStart) || 0;
      if (!newStart) {
        setFlightError('Could not determine boat start. Please try again.');
        return;
      }
      // Auto-cap any currently unbounded flight at newStart-1
      const cappedFlights = localFlights.map(fl => {
        if (!parseInt(fl.boatEnd) && parseInt(fl.boatStart) < newStart) {
          return { ...fl, boatEnd: newStart - 1 };
        }
        return fl;
      });
      const f = {
        boatStart:   newStart,
        boatEnd:     0,
        launchTime:  (flightDraft.launchTime  || '').trim(),
        checkInTime: (flightDraft.checkInTime || '').trim(),
      };
      const updated = [...cappedFlights, { ...f, _key: Date.now() }];
      setLocalFlights(updated);
      onUpdateSettings({ flights: flightSortAndStrip(updated) });
      setEditingFlightIdx(null);
      setFlightDraft(null);
      setFlightError(null);
      return;
    }

    // Editing an existing flight — full validation
    const startRaw = evalMath(String(flightDraft.boatStart ?? ''));
    const endRaw   = evalMath(String(flightDraft.boatEnd   ?? ''));
    const start = isNaN(startRaw) ? 0 : Math.round(startRaw);
    const end   = isNaN(endRaw)   ? 0 : Math.round(endRaw);

    if (!start) {
      setFlightError('Boat # Start is required.');
      return;
    }
    if (end && end < start) {
      setFlightError('Boat # End must be greater than or equal to Start.');
      return;
    }

    const others = localFlights.filter((_, i) => i !== editingFlightIdx);
    const overlap = others.find(fl => {
      const s      = parseInt(fl.boatStart) || 0;
      const e      = parseInt(fl.boatEnd)   || Infinity;
      const newEnd = end || Infinity;
      return start <= e && newEnd >= s;
    });
    if (overlap) {
      const overlapNum   = localFlights.indexOf(overlap) + 1;
      const overlapRange = overlap.boatEnd ? `#${overlap.boatStart}–#${overlap.boatEnd}` : `#${overlap.boatStart}+`;
      setFlightError(`Overlaps with Flight ${overlapNum} (boats ${overlapRange}).`);
      return;
    }

    setFlightError(null);
    const f = {
      boatStart:   start,
      boatEnd:     end,
      launchTime:  (flightDraft.launchTime  || '').trim(),
      checkInTime: (flightDraft.checkInTime || '').trim(),
    };
    const updated = localFlights.map((fl, i) => i === editingFlightIdx ? { ...fl, ...f } : fl);
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
      <div className="tab-scroll">
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

        {/* QR Code Scans */}
        <div style={PANEL}>
          <h3 style={H3}>QR Code Scans</h3>
          {qrCounts === null ? (
            <p style={{ textAlign: 'center', color: 'var(--header-bg)', fontSize: 13 }}>Loading…</p>
          ) : (
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              {[['Rules', 'rules'], ['Off Limits', 'off-limits']].map(([label, key]) => (
                <div key={key} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,180,225,0.2)', borderRadius: 8, padding: '12px 24px', minWidth: 120 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold-light)' }}>{qrCounts[key] ?? 0}</div>
                  <div style={{ fontSize: 12, color: 'var(--header-bg)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tournament Day */}
        <div style={PANEL}>
          <h3 style={H3}>Tournament Day</h3>
          <div className="form-field" style={{ maxWidth: 220, margin: '0 auto' }}>
            <label htmlFor="st-tournament-date">Tournament Date</label>
            <input
              id="st-tournament-date"
              name="tournamentDate"
              type="date"
              value={tournamentDate}
              disabled={locked}
              onChange={e => setTournamentDate(e.target.value)}
              onBlur={() => onUpdateSettings({ tournamentDate })}
            />
          </div>
          {tournamentDate && (
            <p style={{ color: 'var(--header-bg)', fontSize: 12, marginTop: 10, textAlign: 'center' }}>
              {new Date(tournamentDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          )}
          <div className="form-field" style={{ maxWidth: 220, marginTop: 14, margin: '14px auto 0' }}>
            <label htmlFor="st-checkin-opens">Check-In Opens</label>
            <input
              id="st-checkin-opens"
              name="checkInOpens"
              type="time"
              value={checkInOpens}
              disabled={locked}
              onChange={e => setCheckInOpens(e.target.value)}
              onBlur={() => onUpdateSettings({ checkInOpens })}
            />
          </div>
          {checkInOpens && (
            <p style={{ color: 'var(--header-bg)', fontSize: 12, marginTop: 6, textAlign: 'center' }}>
              DNS markers appear on the leaderboard after {new Date('1970-01-01T' + checkInOpens).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
          )}
        </div>

        {/* Payout Structure */}
        <div style={PANEL}>
          <h3 style={H3}>Payout Structure</h3>
          <div className="edit-grid-3" style={{ marginBottom: 14 }}>
            <div className="form-field">
              <label htmlFor="st-total-payout">Total Payout ($)</label>
              <input id="st-total-payout" name="totalPayout" type="number" value={totalPayout} min="0" step="1" inputMode="numeric" disabled={locked}
                     onChange={e => setTotalPayout(parseInt(e.target.value) || 0)}
                     onBlur={() => onUpdateSettings({ payoutSettings: { totalPayout, numWinners, minPayout, payouts } })} />
            </div>
            <div className="form-field">
              <label htmlFor="st-num-winners">Number of Winners</label>
              <input id="st-num-winners" name="numWinners" type="number" value={numWinners} min="1" max="100" step="1" inputMode="numeric" disabled={locked}
                     onChange={e => setNumWinners(parseInt(e.target.value) || 1)}
                     onBlur={handleNumWinnersBlur} />
            </div>
            <div className="form-field">
              <label htmlFor="st-min-payout">Min Last Place ($)</label>
              <input id="st-min-payout" name="minPayout" type="number" value={minPayout} min="0" step="1" inputMode="numeric" disabled={locked}
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
            <button className="btn btn-outline btn-sm" onClick={handleResetPayStructure} disabled={locked}>↺ 15-Winner Preset (2026)</button>
            <button className="btn btn-outline btn-sm" onClick={handleReset17Winners} disabled={locked}>↺ 17-Winner Preset (2025)</button>
            {localPresets.map((preset, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <button className="btn btn-outline btn-sm" onClick={() => handleLoadPreset(preset)} disabled={locked}>↺ {preset.name}</button>
                <button className="btn btn-outline btn-sm" onClick={() => handleDeletePreset(idx)} disabled={locked}
                  style={{ padding: '3px 8px', color: '#ff9090', borderColor: 'rgba(255,107,107,0.4)' }}>✕</button>
              </div>
            ))}
            <button className="btn btn-outline btn-sm" onClick={handleSavePreset} disabled={locked}
              style={{ borderStyle: 'dashed' }}>+ Save as Preset</button>
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
                            id={`st-payout-${i}`}
                            name={`payout-${i}`}
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
              <label htmlFor="st-entry-fee">Entry Fee ($)</label>
              <input id="st-entry-fee" name="entryFee" type="number" value={localFees.entryFee} min="0" step="1" disabled={locked}
                     onChange={e => setLocalFees(prev => ({ ...prev, entryFee: parseFloat(e.target.value) || 0 }))}
                     onBlur={() => onUpdateSettings({ fees: localFees })} />
            </div>
            <div className="form-field">
              <label htmlFor="st-lunker-fee">Lunker Fee ($)</label>
              <input id="st-lunker-fee" name="lunkerFee" type="number" value={localFees.lunkerFee} min="0" step="1" disabled={locked}
                     onChange={e => setLocalFees(prev => ({ ...prev, lunkerFee: parseFloat(e.target.value) || 0 }))}
                     onBlur={() => onUpdateSettings({ fees: localFees })} />
            </div>
            <div className="form-field">
              <label htmlFor="st-opt-fee">Option Fee ($)</label>
              <input id="st-opt-fee" name="optFee" type="number" value={localFees.optFee} min="0" step="1" disabled={locked}
                     onChange={e => setLocalFees(prev => ({ ...prev, optFee: parseFloat(e.target.value) || 0 }))}
                     onBlur={() => onUpdateSettings({ fees: localFees })} />
            </div>
          </div>
          <div className="edit-grid-2">
            <div className="form-field">
              <label htmlFor="st-opt1-pct">Option 1 Payout (%)</label>
              <input id="st-opt1-pct" name="option1Pct" type="number" value={localFees.option1Pct ?? 70} min="0" max="100" step="1" disabled={locked}
                     onChange={e => setLocalFees(prev => ({ ...prev, option1Pct: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) }))}
                     onBlur={() => onUpdateSettings({ fees: localFees })} />
            </div>
            <div className="form-field">
              <label htmlFor="st-opt2-pct">Option 2 Payout (%)</label>
              <input id="st-opt2-pct" name="option2Pct" type="number" value={100 - (localFees.option1Pct ?? 70)} disabled
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

        {/* Penalties & Limits */}
        <div style={PANEL}>
          <h3 style={H3}>Penalties &amp; Limits</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
            {[
              { id: 'st-dead-fish-pen',      label: 'Dead Fish (lbs per fish)',                    field: 'deadFishPenalty',       step: 0.01, parse: parseFloat },
              { id: 'st-short-fish-pen',     label: 'Short Fish — weight deduction (lbs per fish)', field: 'shortFishPenalty',      step: 0.01, parse: parseFloat },
              { id: 'st-short-fish-count',   label: 'Short Fish — fish count deduction (per fish)', field: 'shortFishCountPenalty', step: 1,    parse: parseInt,  max: 1 },
              { id: 'st-over-limit-pen',     label: 'Over Limit (lbs per fish over max)',           field: 'overLimitPenalty',      step: 0.01, parse: parseFloat },
              { id: 'st-max-fish',           label: 'Max Fish Limit',                               field: 'maxFish',               step: 1,    parse: parseInt,  min: 1 },
              { id: 'st-min-fish-length',    label: 'Minimum Fish Length (inches)',                 field: 'minFishLength',         step: 1,    parse: parseInt,  min: 1 },
              { id: 'st-late-pen-per-min',   label: 'Late Penalty (lbs per minute)',                field: 'latePenaltyPerMin',     step: 0.01, parse: parseFloat },
              { id: 'st-late-dq-min',        label: 'Late DQ (minutes past check-in)',              field: 'latePenaltyDQMin',      step: 1,    parse: parseInt,  min: 1 },
            ].map(({ id, label, field, step, parse, min = 0, max }) => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <label htmlFor={id} style={{ fontSize: 13, color: 'var(--header-bg)', flex: 1 }}>{label}</label>
                <div className="form-field" style={{ width: 100, flexShrink: 0 }}>
                  <input id={id} name={field} type="number" step={step} min={min} max={max}
                         value={localPenalties?.[field] ?? (step < 1 ? 0 : 1)}
                         disabled={locked}
                         onChange={e => setLocalPenalties(prev => ({ ...prev, [field]: parse(e.target.value) || 0 }))}
                         onBlur={() => onUpdateSettings({ penalties: localPenalties })} />
                </div>
              </div>
            ))}
          </div>
          <p style={{ color: 'var(--header-bg)', fontSize: 11, marginTop: 8 }}>
            Dead fish: deduct X lbs per dead fish from total weight.<br />
            Short fish: deduct X lbs from total weight and X from fish count per short fish.<br />
            Over limit: deduct X lbs for each fish over the max limit.<br />
            Late penalty: deduct X lbs per minute past flight check-in time; team is DQ'd after Y minutes.
          </p>
        </div>

        {/* Leaderboard Display */}
        <div style={PANEL}>
          <h3 style={H3}>Leaderboard Display</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text)' }}>Recently Weighed Section</span>
            <button
              type="button"
              disabled={locked}
              onClick={() => onUpdateSettings({ showRecentWeighed: !(settings.showRecentWeighed !== false) })}
              style={{
                padding: '4px 14px', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: locked ? 'default' : 'pointer',
                border: `1.5px solid ${settings.showRecentWeighed !== false ? '#4CAF50' : 'rgba(255,107,107,0.6)'}`,
                background: settings.showRecentWeighed !== false ? 'rgba(76,175,80,0.15)' : 'rgba(255,107,107,0.1)',
                color: settings.showRecentWeighed !== false ? '#4CAF50' : '#ff9090',
              }}
            >
              {settings.showRecentWeighed !== false ? '✓ On' : '✕ Off'}
            </button>
          </div>
          <div className="edit-grid-3" style={{ maxWidth: 220, margin: '0 auto' }}>
            <div className="form-field">
              <label htmlFor="st-recent-weigh-count">Recent Weigh-Ins to Show</label>
              <input id="st-recent-weigh-count" name="recentWeighCount" type="number" value={settings.recentWeighCount ?? 2} min="1" max="10" step="1" disabled={locked || settings.showRecentWeighed === false}
                     onChange={e => onUpdateSettings({ recentWeighCount: Math.max(1, parseInt(e.target.value) || 1) })} />
            </div>
          </div>
          <p style={{ color: 'var(--header-bg)', fontSize: 11, marginTop: 8 }}>
            Shows the most recent weigh-ins in a bar above the leaderboard. Count is preserved when toggled off.
          </p>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 16, paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text)' }}>Currently Weighing Section</span>
              <button
                type="button"
                disabled={locked}
                onClick={() => onUpdateSettings({ showCurrentlyWeighing: !(settings.showCurrentlyWeighing !== false) })}
                style={{
                  padding: '4px 14px', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: locked ? 'default' : 'pointer',
                  border: `1.5px solid ${settings.showCurrentlyWeighing !== false ? '#4CAF50' : 'rgba(255,107,107,0.6)'}`,
                  background: settings.showCurrentlyWeighing !== false ? 'rgba(76,175,80,0.15)' : 'rgba(255,107,107,0.1)',
                  color: settings.showCurrentlyWeighing !== false ? '#4CAF50' : '#ff9090',
                }}
              >
                {settings.showCurrentlyWeighing !== false ? '✓ On' : '✕ Off'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', justifyContent: 'center', maxWidth: 300, margin: '0 auto' }}>
              <div className="form-field" style={{ flex: 1 }}>
                <label htmlFor="st-cw-duration">Display Duration</label>
                <input id="st-cw-duration" name="currentlyWeighingDuration" type="number"
                  value={settings.currentlyWeighingDuration ?? 2} min="1" max="60" step="1"
                  disabled={locked || settings.showCurrentlyWeighing === false}
                  onChange={e => onUpdateSettings({ currentlyWeighingDuration: Math.max(1, parseInt(e.target.value) || 1) })} />
              </div>
              <div className="form-field" style={{ flex: 1 }}>
                <label htmlFor="st-cw-unit">Unit</label>
                <select id="st-cw-unit" name="currentlyWeighingUnit"
                  value={settings.currentlyWeighingUnit ?? 'minutes'}
                  disabled={locked || settings.showCurrentlyWeighing === false}
                  onChange={e => onUpdateSettings({ currentlyWeighingUnit: e.target.value })}>
                  <option value="seconds">Seconds</option>
                  <option value="minutes">Minutes</option>
                </select>
              </div>
            </div>
            <p style={{ color: 'var(--header-bg)', fontSize: 11, marginTop: 8 }}>
              Shows the boat currently being weighed at the top of the leaderboard. Disappears after the set duration. Duration is preserved when toggled off.
            </p>
          </div>
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
                      {fl.boatEnd ? `Boats #${fl.boatStart}–#${fl.boatEnd}` : `Boats #${fl.boatStart}+`}
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
              <FlightForm draft={flightDraft} onChange={setFlightDraft} onSave={handleFlightSave} onCancel={handleFlightCancel} error={flightError} isNew />
            </div>
          )}

          {!locked && editingFlightIdx === null && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              <div className="form-field" style={{ width: 140, marginBottom: 0 }}>
                <label htmlFor="st-default-flight-size" style={{ fontSize: 12 }}>Boats Per Flight</label>
                <input
                  id="st-default-flight-size"
                  type="number"
                  value={defaultFlightSize}
                  min="1"
                  step="1"
                  onChange={e => setDefaultFlightSize(parseInt(e.target.value) || 30)}
                  onBlur={() => onUpdateSettings({ defaultFlightSize })}
                />
              </div>
              <button className="btn btn-primary btn-sm" style={{ marginBottom: 2 }} onClick={handleFlightAdd}>
                + Add Flight
              </button>
            </div>
          )}
        </div>

        {/* Data Management */}
        <div style={PANEL}>
          <h3 style={H3}>Data Management</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => exportCSV(entries, payoutSettings)}>💾 Export CSV</button>
            <button className="btn btn-outline" onClick={() => setShowSignUpLog(true)}>📝 Sign-Up Log</button>
            <button className="btn btn-outline" onClick={() => setShowCheckInLog(true)}>⚓ Check In Log</button>
            <button className="btn btn-outline" onClick={() => setShowOffWaterLog(true)}>🏁 Check Out Log</button>
            <button className="btn btn-outline" onClick={() => setShowLog(true)}>📋 Weigh-In Log</button>
            {isUnlocked && <button className="btn btn-outline" onClick={() => exportRosterPdf(entries, settings)}>🖨️ Export PDF Report</button>}
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

      {showLog        && <WeighInLogModal   entries={entries} penalties={penalties} onClose={() => setShowLog(false)}        onClearLog={onClearWeighLog} />}
      {showSignUpLog  && <EventLogModal title="Sign-Up Log"   icon="📝" type="signup"   onClose={() => setShowSignUpLog(false)} />}
      {showCheckInLog && <EventLogModal title="Check In Log"  icon="⚓" type="checkin"  onClose={() => setShowCheckInLog(false)} />}
      {showOffWaterLog && <EventLogModal title="Check Out Log" icon="🏁" type="checkout" onClose={() => setShowOffWaterLog(false)} />}
      </div>
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
    const iso = ts.includes('T') ? ts : ts.replace(' ', 'T');
    const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z');
    if (isNaN(d)) return '—';
    return `${d.toLocaleDateString([], { month: '2-digit', day: '2-digit', year: '2-digit' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
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

function EventLogModal({ title, icon, type, onClose }) {
  const [events, setEvents]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchEventLog(type)
      .then(data => { setEvents(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [type]);

  function parseSqliteTs(ts) {
    if (!ts) return null;
    const iso = ts.includes('T') ? ts : ts.replace(' ', 'T');
    const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z');
    return isNaN(d) ? null : d;
  }

  function fmtTime(ts) {
    const d = parseSqliteTs(ts);
    if (!d) return '—';
    return `${d.toLocaleDateString([], { month: '2-digit', day: '2-digit', year: '2-digit' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  }

  const showValue = type === 'checkout' || type === 'weighin';
  const valueLabel = type === 'checkout' ? 'Status' : 'Weight (lbs)';

  function handleExport() {
    if (!events?.length) return;
    const headers = ['#', 'Time', 'Boat #', 'Name', ...(showValue ? [valueLabel] : [])];
    const rows = [headers, ...events.map((ev, i) => [
      i + 1,
      fmtTime(ev.createdAt),
      ev.boatNo || '—',
      ev.boaterName || '—',
      ...(showValue ? [ev.value || '—'] : []),
    ])];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  async function handleClear() {
    if (!confirm(`Clear the ${title}? This cannot be undone.`)) return;
    try {
      await clearEventLog(type);
      setEvents([]);
    } catch (e) {
      alert(`Failed to clear log: ${e.message}`);
    }
  }

  const TH = { padding: '6px 10px', color: 'var(--header-bg)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, borderBottom: '1px solid rgba(139,180,225,0.2)', whiteSpace: 'nowrap', textAlign: 'left' };

  return (
    <div className="edit-overlay" onPointerDown={e => e.stopPropagation()} onPointerUp={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="edit-panel" style={{ maxWidth: 700, width: '95vw' }}>
        <div className="edit-panel-inner">
          <div className="edit-panel-header">
            <h3>{icon} {title}</h3>
            <button className="edit-panel-close" onClick={onClose}>✕</button>
          </div>

          {loading && <p style={{ color: 'var(--header-bg)', padding: '24px 0', textAlign: 'center' }}>Loading…</p>}
          {error   && <p style={{ color: '#ff9090',          padding: '24px 0', textAlign: 'center' }}>Error: {error}</p>}

          {events && (
            <>
              <p style={{ color: 'var(--header-bg)', fontSize: 12, marginBottom: 14 }}>
                {events.length} event{events.length !== 1 ? 's' : ''} · append-only audit log · newest first
              </p>
              {events.length === 0 ? (
                <p style={{ color: 'var(--header-bg)', textAlign: 'center', padding: '32px 0' }}>No events recorded yet.</p>
              ) : (
                <div style={{ overflowX: 'auto', maxHeight: '55vh', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ ...TH, textAlign: 'right', width: 36 }}>#</th>
                        <th style={TH}>Time</th>
                        <th style={TH}>Boat #</th>
                        <th style={TH}>Name</th>
                        {showValue && <th style={TH}>{valueLabel}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((ev, i) => (
                        <tr key={ev.id} style={{ borderBottom: '1px solid rgba(139,180,225,0.08)' }}>
                          <td style={{ padding: '7px 10px', color: 'var(--header-bg)', textAlign: 'right', fontWeight: 600 }}>{i + 1}</td>
                          <td style={{ padding: '7px 10px', color: 'var(--gold-light)', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtTime(ev.createdAt)}</td>
                          <td style={{ padding: '7px 10px', fontWeight: 700 }}>{ev.boatNo ? `#${ev.boatNo}` : '—'}</td>
                          <td style={{ padding: '7px 10px' }}>{ev.boaterName || '—'}</td>
                          {showValue && (
                            <td style={{ padding: '7px 10px', color: ev.value === 'returned to water' ? '#ffb450' : ev.value === 'checked out' ? '#4CAF50' : 'var(--white)' }}>
                              {ev.value || '—'}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button className="btn btn-outline btn-lg" onClick={handleExport} disabled={!events?.length}>💾 Export CSV</button>
            <button className="btn btn-danger btn-lg" onClick={handleClear} disabled={!events?.length}>🗑️ Clear Log</button>
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
  const timePart = ampmMatch ? s.slice(0, -ampmMatch[0].length).trim() : s;
  const digits = timePart.replace(/\D/g, '');
  if (!digits) return s;
  let h, m;
  if      (digits.length <= 2) { h = parseInt(digits);            m = 0; }
  else if (digits.length === 3) { h = parseInt(digits[0]);         m = parseInt(digits.slice(1)); }
  else if (digits.length === 4) { h = parseInt(digits.slice(0, 2)); m = parseInt(digits.slice(2)); }
  else return s;
  if (isNaN(h) || isNaN(m) || m > 59 || h > 23) return s;
  // Always include AM/PM: use explicit input, or infer from 24-hour value
  let ampm;
  if (ampmMatch) {
    ampm = ' ' + ampmMatch[1].toUpperCase();
  } else {
    ampm = h < 12 ? ' AM' : ' PM';
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
  }
  return `${h}:${String(m).padStart(2, '0')}${ampm}`;
}

function FlightForm({ draft, onChange, onSave, onCancel, error, isNew }) {
  function evalBoat(val) {
    const result = evalMath(String(val ?? ''));
    return isNaN(result) || result < 1 ? (parseInt(val) || '') : Math.round(result);
  }

  function handleBoatKeyDown(e, field) {
    if (e.key === 'Enter') {
      e.preventDefault();
      onChange(prev => ({ ...prev, [field]: evalBoat(prev[field]) }));
      onSave();
    }
  }

  return (
    <div style={{ width: '100%' }}>
      {isNew && (
        <div style={{ marginBottom: 10, fontSize: 13, color: 'var(--gold-light)', fontWeight: 600 }}>
          Boats #{draft.boatStart}+ (auto-assigned)
        </div>
      )}
      <div className="edit-grid-2" style={{ marginBottom: 8 }}>
        <div className="form-field">
          <label htmlFor="ff-launch-time">Launch Time</label>
          <input id="ff-launch-time" name="launchTime" type="text" value={draft.launchTime} placeholder="e.g. 715 AM"
                 onChange={e => onChange(prev => ({ ...prev, launchTime: e.target.value }))}
                 onBlur={e => onChange(prev => ({ ...prev, launchTime: formatTime(e.target.value) }))}
                 onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onChange(prev => ({ ...prev, launchTime: formatTime(prev.launchTime) })); onSave(); } }} />
        </div>
        <div className="form-field">
          <label htmlFor="ff-check-in-time">Check-In Time</label>
          <input id="ff-check-in-time" name="checkInTime" type="text" value={draft.checkInTime} placeholder="e.g. 315 PM"
                 onChange={e => onChange(prev => ({ ...prev, checkInTime: e.target.value }))}
                 onBlur={e => onChange(prev => ({ ...prev, checkInTime: formatTime(e.target.value) }))}
                 onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onChange(prev => ({ ...prev, checkInTime: formatTime(prev.checkInTime) })); onSave(); } }} />
        </div>
        {!isNew && (
          <>
            <div className="form-field">
              <label htmlFor="ff-boat-start">Boat # Start</label>
              <input id="ff-boat-start" name="boatStart" type="text" inputMode="numeric" value={draft.boatStart} placeholder="e.g. 31+1"
                     onChange={e => onChange(prev => ({ ...prev, boatStart: e.target.value }))}
                     onBlur={e => onChange(prev => ({ ...prev, boatStart: evalBoat(e.target.value) }))}
                     onKeyDown={e => handleBoatKeyDown(e, 'boatStart')} />
            </div>
            <div className="form-field">
              <label htmlFor="ff-boat-end">Boat # End</label>
              <input id="ff-boat-end" name="boatEnd" type="text" inputMode="numeric" value={draft.boatEnd} placeholder="leave blank for unbounded"
                     onChange={e => onChange(prev => ({ ...prev, boatEnd: e.target.value }))}
                     onBlur={e => onChange(prev => ({ ...prev, boatEnd: evalBoat(e.target.value) }))}
                     onKeyDown={e => handleBoatKeyDown(e, 'boatEnd')} />
            </div>
          </>
        )}
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
