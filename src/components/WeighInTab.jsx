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
  const deadRate  = parseFloat(penalties.deadFishPenalty)  || 0.5;
  const shortRate = parseFloat(penalties.shortFishPenalty) || 1.0;
  const overRate  = parseFloat(penalties.overLimitPenalty) || 3.0;
  const maxFish   = parseInt(penalties.maxFish)            || 5;
  const nf   = Math.max(0, parseInt(numFish)   || 0);
  const dead = Math.max(0, parseInt(deadFish)  || 0);
  const shrt = Math.max(0, parseInt(shortFish) || 0);
  const over = Math.max(0, nf - maxFish);
  return {
    dead,
    shrt,
    over,
    deadPenalty:  dead * deadRate,
    shortPenalty: shrt * shortRate,
    overPenalty:  over * overRate,
    total:        dead * deadRate + shrt * shortRate + over * overRate,
  };
}

export default function WeighInTab({ entries, settings, onWeighIn, onAddEntry }) {
  const [boatNo, setBoatNo]           = useState('');
  const [numFish, setNumFish]         = useState('');
  const [deadFish, setDeadFish]       = useState('');
  const [shortFish, setShortFish]     = useState('');
  const [lunkerWeight, setLunkerWeight] = useState('');
  const [totalWeight, setTotalWeight] = useState('');
  const [status, setStatus]           = useState(null);
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

    const adjustedNumFish = Math.max(0, nf - pen.shrt);

    setSubmitting(true);
    let ok, histName;
    if (entry) {
      ok = await onWeighIn(entry.id, { numFish: adjustedNumFish, lunkerWeight: lw, totalWeight: adjustedWeight, ...penaltyData });
      histName = [entry.boaterFirst, entry.boaterLast].filter(Boolean).join(' ');
    } else {
      ok = await onAddEntry(no, { numFish: adjustedNumFish, lunkerWeight: lw, totalWeight: adjustedWeight, ...penaltyData });
      histName = '⚠️ Needs attention';
    }
    setSubmitting(false);

    if (ok) {
      const name = histName;
      setHistory(prev => [{ boatNo: no, name, nf: adjustedNumFish, lw, raw: rawTw, adj: adjustedWeight, pen: pen.total }, ...prev].slice(0, 10));
      reset();
    }
  }

  function reset() {
    setBoatNo(''); setNumFish(''); setDeadFish(''); setShortFish('');
    setLunkerWeight(''); setTotalWeight(''); setStatus(null);
    boatRef.current?.focus();
  }

  const statusColors = { ok: '#4CAF50', warning: '#ffb450', error: '#ff6b6b', notfound: '#ff6b6b', adding: '#ffb450' };
  const hasPenalty = pen.total > 0;

  return (
    <div className="tab-panel active" style={{ maxWidth: 520, margin: '0 auto', padding: '8px 0' }}>
      <h2 style={{ color: 'var(--gold-light)', fontSize: 18, marginBottom: 20, fontWeight: 800 }}>🎣 Weigh In</h2>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Boat number */}
        <div>
          <label style={LABEL}>Boat Number</label>
          <input
            ref={boatRef}
            type="number" inputMode="numeric"
            value={boatNo}
            onChange={e => { setBoatNo(e.target.value); setStatus(null); }}
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
          </div>
        )}

        {/* Fish count + penalties row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={LABEL}># Fish</label>
            <input ref={fishRef} type="number" inputMode="numeric" min="0" max="20"
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
            <label style={LABEL}>Dead Fish</label>
            <input ref={deadRef} type="number" inputMode="numeric" min="0"
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
            <label style={LABEL}>Short Fish</label>
            <input ref={shortRef} type="number" inputMode="numeric" min="0"
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
            <label style={LABEL}>Lunker Wt (lbs)</label>
            <input ref={lunkerRef} type="number" inputMode="decimal" step="0.01" min="0"
              value={lunkerWeight} onChange={e => setLunkerWeight(e.target.value)}
              onKeyDown={e => advance(e, totalRef)}
              placeholder="0.00" style={FIELD} />
          </div>
          <div>
            <label style={LABEL}>Total Wt — Scale (lbs)</label>
            <input ref={totalRef} type="number" inputMode="decimal" step="0.01" min="0"
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
          <button type="submit" className="btn btn-primary" disabled={submitting || !boatNo.trim()}
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
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                <span style={{ fontWeight: 700, color: 'var(--gold-light)', minWidth: 50 }}>#{h.boatNo}</span>
                <span style={{ flex: 1, color: 'var(--white)' }}>{h.name}</span>
                <span style={{ color: 'var(--header-bg)', fontSize: 12 }}>
                  {h.nf} fish &nbsp;/&nbsp;
                  {h.pen > 0
                    ? <><span style={{ textDecoration: 'line-through', opacity: 0.5 }}>{h.raw.toFixed(2)}</span> {h.adj.toFixed(2)} lbs</>
                    : <>{h.adj.toFixed(2)} lbs</>
                  }
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
