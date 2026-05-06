import { useMemo } from 'react';

export default function BoatCheckTab({ entries, settings, isUnlocked, onToggle, onToggleOffWater, onReset }) {
  const boatCheck = settings.boatCheck || {};
  const offWater = settings.offWater || {};
  const checkedCount = entries.filter(e => boatCheck[e.id]).length;
  const offWaterCount = entries.filter(e => offWater[e.id]).length;
  const allClear = entries.length > 0 && checkedCount === entries.length;

  const sorted = useMemo(() =>
    [...entries].sort((a, b) => {
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
            <span style={{ fontSize: 22, fontWeight: 700, color: allClear ? '#4CAF50' : 'var(--gold-light)' }}>
              {checkedCount} / {entries.length}
            </span>
            <span style={{ color: 'var(--header-bg)', fontSize: 13 }}>checked in</span>
            {allClear && <span style={{ color: '#4CAF50', fontWeight: 700, fontSize: 14 }}>✔ All Clear!</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: offWaterCount === entries.length && entries.length > 0 ? '#4CAF50' : '#78c8ff' }}>
              {offWaterCount} / {entries.length}
            </span>
            <span style={{ color: 'var(--header-bg)', fontSize: 13 }}>off water</span>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {isUnlocked && checkedCount > 0 && (
          <button className="btn btn-outline" onClick={onReset}>↺ Reset All</button>
        )}
      </div>

      {!isUnlocked && (
        <div style={{ background: 'rgba(255,180,80,0.1)', border: '1px solid rgba(255,180,80,0.3)', borderRadius: 8, padding: '10px 16px', margin: '0 0 16px 0', fontSize: 13, color: 'rgba(255,180,80,0.9)' }}>
          🔒 Boat check is locked. Click <strong>Locked</strong> in the header to unlock.
        </div>
      )}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: 'center', width: 80 }}>Checked In</th>
              <th style={{ textAlign: 'center', width: 80 }}>Off Water</th>
              <th style={{ width: 80 }}>Boat #</th>
              <th>Boater</th>
              <th>Co-Angler</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => {
              const checked = !!boatCheck[row.id];
              const isOffWater = !!offWater[row.id];
              return (
                <tr
                  key={row.id}
                  style={{
                    background: isOffWater ? 'rgba(120,200,255,0.06)' : checked ? 'rgba(76,175,80,0.08)' : undefined,
                    transition: 'background 0.15s',
                  }}
                >
                  <td style={{ textAlign: 'center', cursor: isUnlocked ? 'pointer' : undefined }}
                      onClick={() => isUnlocked && onToggle(row.id)}>
                    <span style={{
                      display: 'inline-block',
                      width: 28,
                      height: 28,
                      lineHeight: '28px',
                      borderRadius: '50%',
                      fontSize: 16,
                      fontWeight: 700,
                      background: checked ? 'rgba(76,175,80,0.2)' : 'rgba(255,255,255,0.06)',
                      border: `2px solid ${checked ? '#4CAF50' : 'rgba(255,255,255,0.15)'}`,
                      color: checked ? '#4CAF50' : 'rgba(255,255,255,0.3)',
                    }}>
                      {checked ? '✓' : ''}
                    </span>
                  </td>
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
                      background: isOffWater ? 'rgba(120,200,255,0.2)' : 'rgba(255,255,255,0.06)',
                      border: `2px solid ${isOffWater ? '#78c8ff' : 'rgba(255,255,255,0.15)'}`,
                      color: isOffWater ? '#78c8ff' : 'rgba(255,255,255,0.3)',
                    }}>
                      {isOffWater ? '✓' : ''}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, fontSize: 16 }}>{row.boatNo || '—'}</td>
                  <td>{row.boaterFirst} {row.boaterLast}</td>
                  <td style={{ color: 'var(--header-bg)' }}>{row.coAnglerFirst} {row.coAnglerLast}</td>
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
