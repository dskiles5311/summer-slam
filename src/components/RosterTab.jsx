import { useState, useMemo } from 'react';
import { importCSV, exportCSV } from '../utils/csv';

function StatusCell({ val }) {
  if (val === 1 || val === '1') return <span className="cell-green">YES</span>;
  if (val === 0 || val === '0') return <span className="cell-red">NO</span>;
  return <span className="cell-neutral">—</span>;
}

const NUMERIC = ['totalWeight', 'lunkerWeight', 'numFish', 'boatNo', 'buyIn', '_rank'];

function sortEntries(entries, { field, dir }) {
  return [...entries].sort((a, b) => {
    let va = a[field], vb = b[field];
    if (NUMERIC.includes(field)) {
      va = parseFloat(va) || 0;
      vb = parseFloat(vb) || 0;
    } else {
      va = (va || '').toLowerCase();
      vb = (vb || '').toLowerCase();
    }
    if (va < vb) return dir === 'asc' ? -1 : 1;
    if (va > vb) return dir === 'asc' ? 1 : -1;
    return 0;
  });
}

const SORT_BUTTONS = [
  { label: '🏆 Rank',      field: '_rank',        dir: 'asc'  },
  { label: 'Boater ↑',     field: 'boaterLast',   dir: 'asc'  },
  { label: 'Co-Angler ↑',  field: 'coAnglerLast', dir: 'asc'  },
  { label: 'Boat # ↑',     field: 'boatNo',       dir: 'asc'  },
  { label: 'Fish ↓',       field: 'numFish',      dir: 'desc' },
  { label: 'Lunker ↓',     field: 'lunkerWeight', dir: 'desc' },
  { label: 'Weight ↓',     field: 'totalWeight',  dir: 'desc' },
];

export default function RosterTab({ entries, settings, isUnlocked, onEdit, onAdd, onDelete, onClearAll, onImport, onToggleBoatCheck, onToggleField }) {
  const entryFee = parseFloat(settings.fees?.entryFee) || 249;
  const boatCheck = settings.boatCheck || {};
  const [sortConfig, setSortConfig] = useState({ field: '_rank', dir: 'asc' });

  const sorted = useMemo(() => sortEntries(entries, sortConfig), [entries, sortConfig]);

  const duplicateBoatNos = useMemo(() => {
    const counts = {};
    entries.forEach(e => { if (e.boatNo) counts[e.boatNo] = (counts[e.boatNo] || 0) + 1; });
    return new Set(Object.keys(counts).filter(k => counts[k] > 1));
  }, [entries]);

  return (
    <div className="tab-panel active">
      <div className="toolbar">
        {isUnlocked && <button className="btn btn-gold" onClick={onAdd}>+ Add Entry</button>}
        <div className="sort-group">
          <label>Sort:</label>
          {SORT_BUTTONS.map(({ label, field, dir }) => (
            <button
              key={label}
              className={`btn btn-outline btn-sm${sortConfig.field === field ? ' active' : ''}`}
              onClick={() => setSortConfig({ field, dir })}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
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
        <button className="btn btn-primary" onClick={() => exportCSV(entries)}>💾 Export CSV</button>
        {isUnlocked && <button className="btn btn-danger" onClick={onClearAll}>🗑️ Clear All</button>}
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Place</th>
              <th>Boater First</th>
              <th>Boater Last</th>
              <th>Co-Angler First</th>
              <th>Co-Angler Last</th>
              <th>Boat #</th>
              <th style={{ textAlign: 'center' }}># Fish</th>
              <th style={{ textAlign: 'right' }}>Lunker (lbs)</th>
              <th style={{ textAlign: 'right' }}>Total Wt (lbs)</th>
              <th style={{ textAlign: 'center' }}>Lunker</th>
              <th style={{ textAlign: 'center' }}>Option</th>
              <th style={{ textAlign: 'center' }}>Paid</th>
              <th style={{ textAlign: 'center' }}>App Signed</th>
              <th style={{ textAlign: 'center' }}>⚓ Checked</th>
              <th style={{ textAlign: 'right' }}>Buy-In</th>
              {isUnlocked && <th style={{ textAlign: 'center' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => {
              const rank = row._rank;
              const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';
              const buyIn = parseFloat(row.buyIn) || 0;
              const buyInClass = buyIn > 0 && buyIn < entryFee ? 'cell-red' : buyIn >= entryFee ? 'cell-green' : 'cell-neutral';

              return (
                <tr
                  key={row.id}
                  onClick={() => isUnlocked && onEdit(row)}
                  style={isUnlocked ? { cursor: 'pointer' } : undefined}
                >
                  <td className={`rank-cell ${rankClass}`}>{rank || ''}</td>
                  <td>{row.boaterFirst}</td>
                  <td>{row.boaterLast}</td>
                  <td>{row.coAnglerFirst}</td>
                  <td>{row.coAnglerLast}</td>
                  <td>
                    {row.boatNo}
                    {duplicateBoatNos.has(String(row.boatNo)) && (
                      <span title="Duplicate boat number" style={{ marginLeft: 4, color: '#ffb450', fontWeight: 700 }}>!</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {row.numFish > 0 ? row.numFish : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {parseFloat(row.lunkerWeight) > 0 ? parseFloat(row.lunkerWeight).toFixed(2) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#e8c876' }}>
                    {parseFloat(row.totalWeight) > 0 ? parseFloat(row.totalWeight).toFixed(2) : '—'}
                  </td>
                  {['lunker', 'option', 'paid', 'appSigned'].map(field => (
                    <td
                      key={field}
                      style={{ textAlign: 'center', cursor: isUnlocked ? 'pointer' : undefined }}
                      onClick={e => { e.stopPropagation(); isUnlocked && onToggleField(row.id, field); }}
                    >
                      <StatusCell val={row[field]} />
                    </td>
                  ))}
                  <td
                    style={{ textAlign: 'center', cursor: isUnlocked ? 'pointer' : undefined }}
                    onClick={e => { e.stopPropagation(); isUnlocked && onToggleBoatCheck(row.id); }}
                  >
                    <span style={{
                      display: 'inline-block',
                      width: 24,
                      height: 24,
                      lineHeight: '24px',
                      borderRadius: '50%',
                      fontSize: 13,
                      fontWeight: 700,
                      background: boatCheck[row.id] ? 'rgba(76,175,80,0.2)' : 'rgba(255,255,255,0.06)',
                      border: `2px solid ${boatCheck[row.id] ? '#4CAF50' : 'rgba(255,255,255,0.15)'}`,
                      color: boatCheck[row.id] ? '#4CAF50' : 'rgba(255,255,255,0.3)',
                    }}>
                      {boatCheck[row.id] ? '✓' : ''}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={buyInClass}>${buyIn.toFixed(2)}</span>
                  </td>
                  {isUnlocked && (
                    <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <button className="btn btn-outline btn-sm" onClick={() => onEdit(row)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => onDelete(row.id)} style={{ marginLeft: 4 }}>Del</button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {isUnlocked && <button className="add-row-btn" onClick={onAdd}>＋ Add New Entry</button>}
      </div>
    </div>
  );
}
