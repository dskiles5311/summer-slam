import { useMemo, useRef, useState } from 'react';

export default function BoatCheckTab({ entries, settings, isUnlocked, onToggleOffWater, onReset }) {
  const offWater = settings.offWater || {};
  const boatedEntries = entries.filter(e => e.boatNo !== '' && e.boatNo != null);
  const offWaterCount = boatedEntries.filter(e => offWater[e.id]).length;
  const allClear = boatedEntries.length > 0 && offWaterCount === boatedEntries.length;

  const [boatInput, setBoatInput]   = useState('');
  const [flashMsg, setFlashMsg]     = useState(null);
  const [listFilter, setListFilter] = useState('all');
  const inputRef = useRef(null);

  const FILTERS = ['all', 'pending', 'done'];
  function cycleFilter() {
    setListFilter(f => FILTERS[(FILTERS.indexOf(f) + 1) % FILTERS.length]);
  }

  const previewEntry = boatInput.trim()
    ? entries.find(en => String(en.boatNo) === boatInput.trim()) ?? null
    : null;

  function handleQuickCheckOut(e) {
    e.preventDefault();
    const val = boatInput.trim();
    if (!val) return;
    const match = entries.find(en => String(en.boatNo) === val);
    const boaterName = match ? `${match.boaterFirst} ${match.boaterLast}`.trim() : '';
    if (!match) {
      setFlashMsg({ type: 'error', text: `Boat #${val} not found` });
    } else if (offWater[match.id]) {
      setFlashMsg({ type: 'warn', text: `Boat #${val} (${boaterName}) already checked out` });
    } else {
      onToggleOffWater(match.id);
      setFlashMsg({ type: 'ok', text: `Boat #${val} — ${boaterName} checked out` });
    }
    setBoatInput('');
    setTimeout(() => { setFlashMsg(null); inputRef.current?.focus(); }, 1800);
  }

  const sorted = useMemo(() =>
    [...entries].filter(e => e.boatNo !== '' && e.boatNo != null).sort((a, b) => {
      const an = parseInt(a.boatNo);
      const bn = parseInt(b.boatNo);
      const aValid = !isNaN(an) && a.boatNo !== '' && a.boatNo != null;
      const bValid = !isNaN(bn) && b.boatNo !== '' && b.boatNo != null;
      if (aValid && bValid) return an !== bn ? an - bn : String(a.boaterLast).localeCompare(String(b.boaterLast));
      if (aValid) return -1;
      if (bValid) return 1;
      return String(a.boaterLast).localeCompare(String(b.boaterLast));
    }),
  [entries]);

  const visibleRows = useMemo(() => {
    if (listFilter === 'pending') return sorted.filter(e => !offWater[e.id]);
    if (listFilter === 'done')    return sorted.filter(e =>  offWater[e.id]);
    return sorted;
  }, [sorted, listFilter, offWater]);

  return (
    <div className="tab-panel active" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button
            onClick={cycleFilter}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, background: 'none',
              border: '1px solid rgba(139,180,225,0.25)', borderRadius: 8,
              padding: '4px 12px', cursor: 'pointer', userSelect: 'none',
            }}
            title="Click to filter list"
          >
            <span style={{ fontSize: 22, fontWeight: 700, color: allClear ? '#4CAF50' : '#78c8ff' }}>
              {offWaterCount} / {boatedEntries.length}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
              <span style={{ color: 'var(--header-bg)', fontSize: 12 }}>off water</span>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                color: listFilter === 'all' ? 'var(--header-bg)' : listFilter === 'pending' ? '#ffb450' : '#78c8ff' }}>
                {listFilter === 'all' ? 'All' : listFilter === 'pending' ? 'Not Out' : 'Off Water'}
              </span>
            </div>
            {allClear && <span style={{ color: '#4CAF50', fontWeight: 700, fontSize: 13 }}>✔ All Clear!</span>}
          </button>
        </div>
        <div style={{ flex: 1 }} />
        {isUnlocked && (
          <form onSubmit={handleQuickCheckOut} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 160px', minWidth: 0 }}>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Boat #…"
              value={boatInput}
              onChange={e => setBoatInput(e.target.value)}
              style={{
                width: '100%', maxWidth: 100, padding: '6px 10px', borderRadius: 6,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(139,180,225,0.28)',
                color: 'var(--white)', fontSize: 14, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <button type="submit" className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap', minHeight: 36 }}>
              Check Out
            </button>
          </form>
        )}
        {isUnlocked && offWaterCount > 0 && (
          <button className="btn btn-outline" onClick={onReset}>↺ Reset All</button>
        )}

        {previewEntry && !flashMsg && (
          <div style={{
            flex: '0 0 100%', padding: '7px 14px', borderRadius: 6, fontSize: 13,
            background: offWater[previewEntry.id] ? 'rgba(255,180,80,0.1)' : 'rgba(120,200,255,0.08)',
            border: `1px solid ${offWater[previewEntry.id] ? 'rgba(255,180,80,0.35)' : 'rgba(120,200,255,0.3)'}`,
            color: offWater[previewEntry.id] ? 'rgba(255,180,80,0.9)' : 'var(--white)',
          }}>
            <span style={{ fontWeight: 700 }}>Boat #{previewEntry.boatNo}</span>
            {' — '}
            {previewEntry.boaterFirst} {previewEntry.boaterLast}
            {previewEntry.coAnglerFirst && (
              <span style={{ color: 'var(--header-bg)' }}> / {previewEntry.coAnglerFirst} {previewEntry.coAnglerLast}</span>
            )}
            {offWater[previewEntry.id] && <span style={{ marginLeft: 8, fontWeight: 700 }}>· already off water</span>}
          </div>
        )}

        {flashMsg && (
          <div style={{
            flex: '0 0 100%', padding: '7px 14px', borderRadius: 6, fontSize: 13, fontWeight: 700,
            background: flashMsg.type === 'ok' ? 'rgba(76,175,80,0.15)' : 'rgba(255,107,107,0.15)',
            border: `1px solid ${flashMsg.type === 'ok' ? 'rgba(76,175,80,0.4)' : 'rgba(255,107,107,0.4)'}`,
            color: flashMsg.type === 'ok' ? '#4CAF50' : '#ff9090',
          }}>
            {flashMsg.type === 'ok' ? '✓' : '⚠️'} {flashMsg.text}
          </div>
        )}

        {!isUnlocked && (
          <div style={{ flex: '0 0 100%', background: 'rgba(255,180,80,0.1)', border: '1px solid rgba(255,180,80,0.3)', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: 'rgba(255,180,80,0.9)' }}>
            🔒 Off water check is locked. Click <strong>Locked</strong> in the header to unlock.
          </div>
        )}
      </div>

      <div className="table-wrapper" style={{ flex: 1, minHeight: 0, maxHeight: 'none' }}>
        <table style={{ tableLayout: 'fixed', minWidth: 360 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'center', width: 76 }}>Off Water</th>
              <th style={{ width: 62 }}>Boat #</th>
              <th style={{ width: '42%' }}>Boater</th>
              <th style={{ width: '35%' }}>Co-Angler</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(row => {
              const isOffWater = !!offWater[row.id];
              return (
                <tr
                  key={row.id}
                  style={{
                    background: isOffWater ? 'rgba(120,200,255,0.06)' : undefined,
                    transition: 'background 0.15s',
                  }}
                >
                  <td style={{ textAlign: 'center', cursor: isUnlocked ? 'pointer' : undefined }}
                      onClick={() => isUnlocked && onToggleOffWater(row.id)}>
                    <span style={{
                      display: 'inline-block',
                      width: 28,
                      height: 28,
                      lineHeight: '28px',
                      borderRadius: '50%',
                      fontSize: 16,
                      fontWeight: 700,
                      background: isOffWater ? 'rgba(120,200,255,0.2)' : 'rgba(168,200,160,0.1)',
                      border: `2px solid ${isOffWater ? '#78c8ff' : 'rgba(168,200,160,0.55)'}`,
                      color: isOffWater ? '#78c8ff' : 'var(--header-bg)',
                    }}>
                      {isOffWater ? '✓' : '○'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, fontSize: 16 }}>{row.boatNo || '—'}</td>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {row.boaterPhone
                      ? <a href={`tel:${row.boaterPhone}`} style={{ color: 'inherit', textDecoration: 'none' }}>{row.boaterFirst} {row.boaterLast}</a>
                      : <>{row.boaterFirst} {row.boaterLast}</>}
                  </td>
                  <td style={{ color: 'var(--header-bg)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {row.coAnglerFirst && row.coAnglerPhone
                      ? <a href={`tel:${row.coAnglerPhone}`} style={{ color: 'inherit', textDecoration: 'none' }}>{row.coAnglerFirst} {row.coAnglerLast}</a>
                      : <>{row.coAnglerFirst} {row.coAnglerLast}</>}
                  </td>
                </tr>
              );
            })}
            {entries.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: 'var(--header-bg)', padding: 40 }}>
                  No entries yet. Add anglers in the Roster tab.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
