import { useState, useRef, useEffect } from 'react';

const FIELD = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(139,180,225,0.3)',
  borderRadius: 8,
  color: 'var(--white)',
  fontSize: 22,
  fontWeight: 700,
  padding: '10px 14px',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
};

const LABEL = { fontSize: 12, fontWeight: 700, color: 'var(--header-bg)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5, display: 'block' };

function calcPenalties(numFish, deadFish, shortFish, penalties = {}) {
  const deadRate       = parseFloat(penalties.deadFishPenalty)     || 0.5;
  const shortRate      = parseFloat(penalties.shortFishPenalty)    || 1.0;
  const shortCountRate = parseInt(penalties.shortFishCountPenalty) ?? 1;
  const overRate       = parseFloat(penalties.overLimitPenalty)    || 3.0;
  const maxFish        = parseInt(penalties.maxFish)               || 5;
  const nf   = Math.max(0, parseInt(numFish)   || 0);
  const dead = Math.max(0, parseInt(deadFish)  || 0);
  const shrt = Math.max(0, parseInt(shortFish) || 0);
  const over = Math.max(0, nf - maxFish);
  return {
    dead,
    shrt,
    shrtFishDed:  shrt * shortCountRate,
    over,
    deadPenalty:  dead * deadRate,
    shortPenalty: shrt * shortRate,
    overPenalty:  over * overRate,
    total:        dead * deadRate + shrt * shortRate + over * overRate,
  };
}

export default function WeighInTab({ entries, settings, onWeighIn, onAddEntry, onSetCurrentlyWeighing }) {
  const [boatNo, setBoatNo]           = useState('');
  const [numFish, setNumFish]         = useState('');
  const [deadFish, setDeadFish]       = useState('');
  const [shortFish, setShortFish]     = useState('');
  const [lunkerWeight, setLunkerWeight] = useState('');
  const [totalWeight, setTotalWeight] = useState('');
  const [status, setStatus]           = useState(null);
  const [overwriteConfirmed, setOverwriteConfirmed] = useState(false);
  const [history, setHistory]         = useState([]);
  const [submitting, setSubmitting]   = useState(false);

  const boatRef   = useRef();
  const fishRef   = useRef();
  const deadRef   = useRef();
  const shortRef  = useRef();
  const lunkerRef = useRef();
  const totalRef  = useRef();

  useEffect(() => { boatRef.current?.focus(); }, []);

  const pen = calcPenalties(numFish, deadFish, shortFish, settings?.penalties);
  const rawTw = parseFloat(totalWeight) || 0;
  const adjustedWeight = Math.max(0, rawTw - pen.total);

  function lookupBoat(val) {
    const no = String(val).trim();
    if (!no) { setStatus(null); return; }
    const entry = entries.find(e => String(e.boatNo) === no);
    if (!entry) {
      setStatus({ type: 'notfound', message: `Boat #${no} is not in the roster.` });
      return;
    }
    const tw = parseFloat(entry.totalWeight) || 0;
    const nf = parseInt(entry.numFish) || 0;
    const name = [entry.boaterFirst, entry.boaterLast].filter(Boolean).join(' ');
    if (tw > 0 || nf > 0) {
      setStatus({
        type: 'warning',
        message: `Boat #${no} (${name}) already has ${nf} fish / ${tw.toFixed(2)} lbs. Submitting will overwrite.`,
        entry,
      });
    } else {
      setStatus({ type: 'ok', message: `Boat #${no} — ${name}`, entry });
    }
    onSetCurrentlyWeighing?.({
      boatNo: entry.boatNo,
      boaterFirst: entry.boaterFirst,
      boaterLast: entry.boaterLast,
      coAnglerFirst: entry.coAnglerFirst,
      coAnglerLast: entry.coAnglerLast,
      setAt: Date.now(),
    });
  }

  function handleBoatKeyDown(e) {
    if (e.key === 'Enter' && boatNo.trim()) {
      e.preventDefault();
      lookupBoat(boatNo);
      fishRef.current?.focus();
    }
  }

  function advance(e, next) {
    if (e.key === 'Enter') { e.preventDefault(); next?.current?.focus(); }
  }

  async function handleSubmit(e) {
    e?.preventDefault();
    const no = String(boatNo).trim();
    if (!no) return;

    const entry = entries.find(e => String(e.boatNo) === no);
    if (!entry) {
      if (status?.type === 'adding') {
        // confirmed add path — fall through below
      } else {
        setStatus({ type: 'notfound', message: `Boat #${no} is not in the roster.` });
        boatRef.current?.focus();
        return;
      }
    }

    const lw = parseFloat(lunkerWeight) || 0;
    const nf = Math.max(0, parseInt(numFish) || 0);

    if (lw > 0 && rawTw === 0) {
      setStatus({ type: 'error', message: 'Enter total weight before setting lunker weight.' });
      totalRef.current?.focus();
      return;
    }
    if (lw > adjustedWeight && adjustedWeight > 0) {
      setStatus({ type: 'error', message: 'Lunker weight cannot exceed adjusted total weight.' });
      lunkerRef.current?.focus();
      return;
    }

    const penaltyData = pen.total > 0
      ? { rawWeight: rawTw, deadFish: pen.dead, shortFish: pen.shrt }
      : { rawWeight: null, deadFish: 0, shortFish: 0 };

    const adjustedNumFish = Math.max(0, nf - pen.shrtFishDed);
    const weighedAt = new Date().toISOString();

    setSubmitting(true);
    let ok, histName;
    if (entry) {
      ok = await onWeighIn(entry.id, { numFish: adjustedNumFish, lunkerWeight: lw, totalWeight: adjustedWeight, weighedAt, ...penaltyData });
      histName = [entry.boaterFirst, entry.boaterLast].filter(Boolean).join(' ');
    } else {
      ok = await onAddEntry(no, { numFish: adjustedNumFish, lunkerWeight: lw, totalWeight: adjustedWeight, weighedAt, ...penaltyData });
      histName = '⚠️ Needs attention';
    }
    setSubmitting(false);

    if (ok) {
      const name = histName;
      setHistory(prev => [{ boatNo: no, name, nf: adjustedNumFish, origNumFish: nf, deadFish: pen.dead, shortFish: pen.shrt, lw, raw: rawTw, adj: adjustedWeight, pen: pen.total }, ...prev].slice(0, 10));
      reset();
    }
  }

  function reset() {
    setBoatNo(''); setNumFish(''); setDeadFish(''); setShortFish('');
    setLunkerWeight(''); setTotalWeight(''); setStatus(null); setOverwriteConfirmed(false);
    boatRef.current?.focus();
  }

  function loadHistory(h) {
    setBoatNo(String(h.boatNo));
    setNumFish(String(h.origNumFish));
    setDeadFish(String(h.deadFish));
    setShortFish(String(h.shortFish));
    setLunkerWeight(h.lw > 0 ? String(h.lw) : '');
    setTotalWeight(String(h.raw));
    setOverwriteConfirmed(true);
    lookupBoat(String(h.boatNo));
    fishRef.current?.focus();
  }

  const statusColors = { ok: '#4CAF50', warning: '#ffb450', error: '#ff6b6b', notfound: '#ff6b6b', adding: '#ffb450' };
  const hasPenalty = pen.total > 0;

  return (
    <div className="tab-panel active">
      <div className="tab-scroll">
      <div className="toolbar">
        <h2 style={{ color: 'var(--gold-light)', fontSize: 18, fontWeight: 800 }}>🎣 Weigh In</h2>
      </div>
      <div style={{ maxWidth: 520, margin: '0 auto', paddingTop: 16 }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Boat number */}
        <div>
          <label htmlFor="wi-boat-no" style={LABEL}>Boat Number</label>
          <input
            ref={boatRef}
            id="wi-boat-no" name="boatNo"
            type="number" inputMode="numeric"
            value={boatNo}
            onChange={e => { setBoatNo(e.target.value); setStatus(null); setOverwriteConfirmed(false); }}
            onBlur={() => lookupBoat(boatNo)}
            onKeyDown={handleBoatKeyDown}
            placeholder="Enter boat #"
            style={{ ...FIELD, fontSize: 28, borderColor: status ? statusColors[status.type] : 'rgba(139,180,225,0.3)' }}
          />
        </div>

        {/* Status banner */}
        {status && (
          <div style={{
            background: ['ok'].includes(status.type) ? 'rgba(76,175,80,0.12)' : ['warning','adding'].includes(status.type) ? 'rgba(255,180,80,0.12)' : 'rgba(255,107,107,0.12)',
            border: `1px solid ${statusColors[status.type]}44`,
            borderLeft: `4px solid ${statusColors[status.type]}`,
            borderRadius: 8, padding: '10px 14px', fontSize: 13,
            color: statusColors[status.type], fontWeight: 600,
          }}>
            <div>
              {status.type === 'warning' ? '⚠️ ' : status.type === 'error' || status.type === 'notfound' ? '✖ ' : status.type === 'adding' ? '⚠️ ' : '✔ '}
              {status.message}
            </div>
            {status.type === 'notfound' && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setStatus({ type: 'adding', message: `Boat #${boatNo} will be added to the roster and flagged for attention.` })}
                style={{ marginTop: 8, borderColor: '#ffb450', color: '#ffb450' }}
              >
                ➕ Add to roster & flag for attention
              </button>
            )}
            {status.type === 'warning' && !overwriteConfirmed && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setOverwriteConfirmed(true)}
                style={{ marginTop: 8, borderColor: '#ffb450', color: '#ffb450' }}
              >
                ✔ Yes, overwrite existing weight
              </button>
            )}
            {status.type === 'warning' && overwriteConfirmed && (
              <div style={{ marginTop: 6, fontSize: 12, color: '#4CAF50', fontWeight: 700 }}>
                ✔ Overwrite confirmed — fill in data and save
              </div>
            )}
          </div>
        )}

        {/* Fish count + penalties row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label htmlFor="wi-num-fish" style={LABEL}># Fish</label>
            <input ref={fishRef} id="wi-num-fish" name="numFish" type="number" inputMode="numeric" min="0" max="20"
              value={numFish} onChange={e => setNumFish(e.target.value)}
              onKeyDown={e => advance(e, deadRef)}
              placeholder="0" style={FIELD} />
            {pen.over > 0 && (
              <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 4 }}>
                {pen.over} over limit (−{pen.overPenalty.toFixed(2)} lbs)
              </div>
            )}
          </div>
          <div>
            <label htmlFor="wi-dead-fish" style={LABEL}>Dead Fish</label>
            <input ref={deadRef} id="wi-dead-fish" name="deadFish" type="number" inputMode="numeric" min="0"
              value={deadFish} onChange={e => setDeadFish(e.target.value)}
              onKeyDown={e => advance(e, shortRef)}
              placeholder="0" style={{ ...FIELD, borderColor: pen.dead > 0 ? '#ff6b6b' : undefined }} />
            {pen.dead > 0 && (
              <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 4 }}>
                −{pen.deadPenalty.toFixed(2)} lbs
              </div>
            )}
          </div>
          <div>
            <label htmlFor="wi-short-fish" style={LABEL}>Short Fish</label>
            <input ref={shortRef} id="wi-short-fish" name="shortFish" type="number" inputMode="numeric" min="0"
              value={shortFish} onChange={e => setShortFish(e.target.value)}
              onKeyDown={e => advance(e, lunkerRef)}
              placeholder="0" style={{ ...FIELD, borderColor: pen.shrt > 0 ? '#ff6b6b' : undefined }} />
            {pen.shrt > 0 && (
              <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 4 }}>
                −{pen.shortPenalty.toFixed(2)} lbs
              </div>
            )}
          </div>
        </div>

        {/* Weights row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label htmlFor="wi-lunker-wt" style={LABEL}>Lunker Wt (lbs)</label>
            <input ref={lunkerRef} id="wi-lunker-wt" name="lunkerWeight" type="number" inputMode="decimal" step="0.01" min="0"
              value={lunkerWeight} onChange={e => setLunkerWeight(e.target.value)}
              onKeyDown={e => advance(e, totalRef)}
              placeholder="0.00" style={FIELD} />
          </div>
          <div>
            <label htmlFor="wi-total-wt" style={LABEL}>Total Wt — Scale (lbs)</label>
            <input ref={totalRef} id="wi-total-wt" name="totalWeight" type="number" inputMode="decimal" step="0.01" min="0"
              value={totalWeight} onChange={e => setTotalWeight(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } }}
              placeholder="0.00" style={FIELD} />
          </div>
        </div>

        {/* Penalty summary + adjusted weight */}
        {(hasPenalty || rawTw > 0) && (
          <div style={{
            background: hasPenalty ? 'rgba(255,107,107,0.08)' : 'rgba(76,175,80,0.08)',
            border: `1px solid ${hasPenalty ? 'rgba(255,107,107,0.3)' : 'rgba(76,175,80,0.3)'}`,
            borderRadius: 10, padding: '12px 16px',
          }}>
            {hasPenalty && (
              <div style={{ fontSize: 12, color: '#ff6b6b', marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                {pen.deadPenalty  > 0 && <span>Dead fish: −{pen.deadPenalty.toFixed(2)} lbs</span>}
                {pen.shortPenalty > 0 && <span>Short fish: −{pen.shortPenalty.toFixed(2)} lbs</span>}
                {pen.overPenalty  > 0 && <span>Over limit: −{pen.overPenalty.toFixed(2)} lbs</span>}
                <span style={{ fontWeight: 700 }}>Total penalty: −{pen.total.toFixed(2)} lbs</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--header-bg)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Adjusted Weight:</span>
              <span style={{ fontSize: 28, fontWeight: 800, color: hasPenalty ? '#ffb450' : '#4CAF50' }}>
                {adjustedWeight.toFixed(2)} lbs
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="btn btn-primary"
            disabled={submitting || !boatNo.trim() || (status?.type === 'warning' && !overwriteConfirmed)}
            style={{ flex: 1, fontSize: 16, padding: '12px 0' }}>
            {submitting ? 'Saving…' : '✔ Save & Next'}
          </button>
          <button type="button" className="btn btn-outline" onClick={reset} style={{ padding: '12px 20px' }}>
            Clear
          </button>
        </div>
      </form>

      {/* Recent weigh-ins */}
      {history.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h3 style={{ color: 'var(--header-bg)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Recent</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {history.map((h, i) => (
              <div key={i} onClick={() => loadHistory(h)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 12px', fontSize: 13, cursor: 'pointer', userSelect: 'none' }}
                title="Click to reload and edit">
                <span style={{ fontWeight: 700, color: 'var(--gold-light)', minWidth: 50 }}>#{h.boatNo}</span>
                <span style={{ flex: 1, color: 'var(--white)' }}>{h.name}</span>
                <span style={{ color: 'var(--header-bg)', fontSize: 12 }}>
                  {h.nf} fish &nbsp;/&nbsp;
                  {h.pen > 0
                    ? <><span style={{ textDecoration: 'line-through', opacity: 0.5 }}>{h.raw.toFixed(2)}</span> {h.adj.toFixed(2)} lbs</>
                    : <>{h.adj.toFixed(2)} lbs</>
                  }
                </span>
                <span style={{ color: 'var(--header-bg)', fontSize: 11, marginLeft: 10 }}>✏️</span>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
      </div>
    </div>
  );
}
