import { useMemo } from 'react';

export default function BoatCheckTab({ entries, settings, isUnlocked, onToggleOffWater, onReset }) {
  const offWater = settings.offWater || {};
  const boatedEntries = entries.filter(e => e.boatNo !== '' && e.boatNo != null);
  const offWaterCount = boatedEntries.filter(e => offWater[e.id]).length;
  const allClear = boatedEntries.length > 0 && offWaterCount === boatedEntries.length;

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

  return (
    <div className="tab-panel active">
      <div className="toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: allClear ? '#4CAF50' : '#78c8ff' }}>
              {offWaterCount} / {boatedEntries.length}
            </span>
            <span style={{ color: 'var(--header-bg)', fontSize: 13 }}>off water</span>
            {allClear && <span style={{ color: '#4CAF50', fontWeight: 700, fontSize: 14 }}>✔ All Clear!</span>}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {isUnlocked && offWaterCount > 0 && (
          <button className="btn btn-outline" onClick={onReset}>↺ Reset All</button>
        )}
      </div>

      {!isUnlocked && (
        <div style={{ background: 'rgba(255,180,80,0.1)', border: '1px solid rgba(255,180,80,0.3)', borderRadius: 8, padding: '10px 16px', margin: '0 0 16px 0', fontSize: 13, color: 'rgba(255,180,80,0.9)' }}>
          🔒 Off water check is locked. Click <strong>Locked</strong> in the header to unlock.
        </div>
      )}

      <div className="table-wrapper">
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
            {sorted.map(row => {
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
                    {row.boaterFirst} {row.boaterLast}
                  </td>
                  <td style={{ color: 'var(--header-bg)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {row.coAnglerFirst} {row.coAnglerLast}
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
