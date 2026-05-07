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
    // needsAttention entries always float to the top
    if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1;

    let va = a[field], vb = b[field];
    if (NUMERIC.includes(field)) {
      if (field === '_rank') {
        va = va != null ? parseFloat(va) : Infinity;
        vb = vb != null ? parseFloat(vb) : Infinity;
      } else if (field === 'boatNo') {
        va = va ? parseFloat(va) || 0 : Infinity;
        vb = vb ? parseFloat(vb) || 0 : Infinity;
      } else {
        va = parseFloat(va) || 0;
        vb = parseFloat(vb) || 0;
      }
    } else {
      va = (va || '').toLowerCase().trim();
      vb = (vb || '').toLowerCase().trim();
      if (!va && vb) return 1;
      if (!vb && va) return -1;
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

export default function RosterTab({ entries, settings, isUnlocked, onEdit, onAdd, onDelete, onClearAll, onImport, onToggleBoatCheck, onToggleField, onUpdateInlineField }) {
  const entryFee = parseFloat(settings.fees?.entryFee) || 249;
  const boatCheck = settings.boatCheck || {};
  const [sortConfig, setSortConfig] = useState({ field: '_rank', dir: 'asc' });
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [penaltyPopup, setPenaltyPopup] = useState(null); // { row, x, y }

  const sorted = useMemo(() => sortEntries(entries, sortConfig), [entries, sortConfig]);

  const duplicateBoatNos = useMemo(() => {
    const counts = {};
    entries.forEach(e => { if (e.boatNo) counts[e.boatNo] = (counts[e.boatNo] || 0) + 1; });
    return new Set(Object.keys(counts).filter(k => counts[k] > 1));
  }, [entries]);

  function handleStartEdit(row, field) {
    setEditingId(row.id);
    setEditValues({ [field]: row[field] || '' });
  }

  function handleSaveInline(rowId, field) {
    const value = editValues[field];
    if (onUpdateInlineField) {
      onUpdateInlineField(rowId, field, value);
    }
    setEditingId(null);
    setEditValues({});
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditValues({});
  }

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
                     if (f) {
                       importCSV(f).then(onImport).catch(err => {
                         console.error('Import failed:', err);
                         alert(`Import error: ${err.message}`);
                       });
                     }
                     e.target.value = '';
                   }} />
          </label>
        )}
        <button className="btn btn-primary" onClick={() => exportCSV(entries, settings.payoutSettings)}>💾 Export CSV</button>
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

              const flagged = row.needsAttention;
              return (
                <tr
                  key={row.id}
                  onClick={() => isUnlocked && onEdit(row)}
                  style={{ ...(isUnlocked ? { cursor: 'pointer' } : {}), ...(flagged ? { background: 'rgba(255,180,80,0.08)' } : {}) }}
                >
                  <td className={`rank-cell ${rankClass}`}>{rank || ''}</td>
                  <td>{flagged && <span title="Needs attention" style={{ color: '#ffb450', marginRight: 4 }}>⚠️</span>}{row.boaterFirst}</td>
                  <td>{row.boaterLast}</td>
                  <td>{row.coAnglerFirst}</td>
                  <td>{row.coAnglerLast}</td>
                  <td
                    onClick={e => { e.stopPropagation(); isUnlocked && handleStartEdit(row, 'boatNo'); }}
                    style={isUnlocked ? { cursor: 'pointer', padding: '8px 0' } : undefined}
                  >
                    {editingId === row.id && editValues.hasOwnProperty('boatNo') ? (
                      <input
                        type="text"
                        value={editValues.boatNo}
                        onChange={e => setEditValues({ ...editValues, boatNo: e.target.value })}
                        onBlur={() => handleSaveInline(row.id, 'boatNo')}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveInline(row.id, 'boatNo');
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        onClick={e => e.stopPropagation()}
                        autoFocus
                        style={{ width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', color: 'inherit', fontSize: 'inherit', boxSizing: 'border-box' }}
                      />
                    ) : (
                      <div style={{ padding: '0 12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {row.boatNo}
                        {duplicateBoatNos.has(String(row.boatNo)) && (
                          <span title="Duplicate boat number" style={{ marginLeft: 4, color: '#ffb450', fontWeight: 700 }}>!</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td
                    style={{ textAlign: 'center', cursor: isUnlocked ? 'pointer' : undefined }}
                    onClick={e => { e.stopPropagation(); isUnlocked && handleStartEdit(row, 'numFish'); }}
                  >
                    {editingId === row.id && editValues.hasOwnProperty('numFish') ? (
                      <input
                        type="number"
                        value={editValues.numFish}
                        onChange={e => setEditValues({ ...editValues, numFish: e.target.value })}
                        onBlur={() => handleSaveInline(row.id, 'numFish')}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveInline(row.id, 'numFish');
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        onClick={e => e.stopPropagation()}
                        autoFocus
                        style={{ width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', color: 'inherit', fontSize: 'inherit', textAlign: 'center', boxSizing: 'border-box' }}
                      />
                    ) : (
                      row.numFish > 0 ? row.numFish : '—'
                    )}
                  </td>
                  <td
                    style={{ textAlign: 'right', fontWeight: 600, cursor: isUnlocked ? 'pointer' : undefined }}
                    onClick={e => { e.stopPropagation(); isUnlocked && handleStartEdit(row, 'lunkerWeight'); }}
                  >
                    {editingId === row.id && editValues.hasOwnProperty('lunkerWeight') ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editValues.lunkerWeight}
                        onChange={e => setEditValues({ ...editValues, lunkerWeight: e.target.value })}
                        onBlur={() => handleSaveInline(row.id, 'lunkerWeight')}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveInline(row.id, 'lunkerWeight');
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        onClick={e => e.stopPropagation()}
                        autoFocus
                        style={{ width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', color: 'inherit', fontSize: 'inherit', textAlign: 'right', boxSizing: 'border-box' }}
                      />
                    ) : (
                      parseFloat(row.lunkerWeight) > 0 ? parseFloat(row.lunkerWeight).toFixed(2) : '—'
                    )}
                  </td>
                  <td
                    style={{ textAlign: 'right', fontWeight: 700, color: '#e8c876', cursor: isUnlocked ? 'pointer' : undefined }}
                    onClick={e => { e.stopPropagation(); isUnlocked && handleStartEdit(row, 'totalWeight'); }}
                  >
                    {editingId === row.id && editValues.hasOwnProperty('totalWeight') ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editValues.totalWeight}
                        onChange={e => setEditValues({ ...editValues, totalWeight: e.target.value })}
                        onBlur={() => handleSaveInline(row.id, 'totalWeight')}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveInline(row.id, 'totalWeight');
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        onClick={e => e.stopPropagation()}
                        autoFocus
                        style={{ width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', color: 'inherit', fontSize: 'inherit', textAlign: 'right', boxSizing: 'border-box' }}
                      />
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                        {parseFloat(row.totalWeight) > 0 ? parseFloat(row.totalWeight).toFixed(2) : '—'}
                        {row.rawWeight > 0 && (
                          <span
                            title="Deductions applied — click for details"
                            onClick={e => { e.stopPropagation(); setPenaltyPopup(p => p?.row?.id === row.id ? null : { row, x: e.clientX, y: e.clientY }); }}
                            style={{ fontSize: 11, background: 'rgba(255,107,107,0.25)', color: '#ff9090', borderRadius: 4, padding: '1px 5px', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}
                          >
                            −{(row.rawWeight - parseFloat(row.totalWeight)).toFixed(2)}
                          </span>
                        )}
                      </span>
                    )}
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

      {penaltyPopup && (() => {
        const r = penaltyPopup.row;
        const nf = parseInt(r.numFish) || 0;
        const dead = parseInt(r.deadFish) || 0;
        const shrt = parseInt(r.shortFish) || 0;
        const over = Math.max(0, nf - 5);
        const deadPen  = dead * 0.5;
        const shortPen = shrt * 1.0;
        const overPen  = over * 3.0;
        const totalPen = deadPen + shortPen + overPen;
        const left = Math.min(penaltyPopup.x, window.innerWidth - 260);
        const top  = penaltyPopup.y + 12;
        return (
          <>
            <div onClick={() => setPenaltyPopup(null)} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
            <div style={{
              position: 'fixed', left, top, zIndex: 1000, minWidth: 240,
              background: 'var(--modal-bg, #1a2a3a)', border: '1px solid rgba(255,107,107,0.4)',
              borderRadius: 10, padding: '14px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              fontSize: 13,
            }}>
              <div style={{ fontWeight: 800, color: '#ff9090', marginBottom: 10 }}>Deduction Details</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: 'var(--white, #fff)' }}>
                <span>Scale weight</span>
                <span style={{ fontWeight: 700 }}>{parseFloat(r.rawWeight).toFixed(2)} lbs</span>
              </div>
              {dead > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#ff9090' }}>
                <span>Dead fish ({dead} × 0.50)</span><span>−{deadPen.toFixed(2)} lbs</span>
              </div>}
              {shrt > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#ff9090' }}>
                <span>Short fish ({shrt} × 1.00)</span><span>−{shortPen.toFixed(2)} lbs</span>
              </div>}
              {over > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#ff9090' }}>
                <span>Over limit ({over} × 3.00)</span><span>−{overPen.toFixed(2)} lbs</span>
              </div>}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                <span style={{ color: 'var(--gold-light, #e8c876)' }}>Adjusted weight</span>
                <span style={{ color: 'var(--gold-light, #e8c876)' }}>{parseFloat(r.totalWeight).toFixed(2)} lbs</span>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
