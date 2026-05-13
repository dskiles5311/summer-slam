import { useState, useEffect, useMemo, useRef } from 'react';
import { importCSV, exportCSV } from '../utils/csv';
import { exportHTML } from '../utils/exportHtml';
import ConfirmActionModal from './ConfirmActionModal';

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


export default function RosterTab({ entries, settings, isUnlocked, buyInBlurred, onEdit, onAdd, onDelete, onClearAll, onImport, onToggleOffWater, onToggleField, onUpdateInlineField, onClearDeductions, onArchive, onBackfillInfo, onNormalizePhones }) {
  const entryFee = parseFloat(settings.fees?.entryFee) || 249;
  const offWater = settings.offWater || {};
  const [sortKey, setSortKey] = useState(() => localStorage.getItem('ss_roster_sort_key') || '_rank');
  const [sortDir, setSortDir] = useState(() => localStorage.getItem('ss_roster_sort_dir') || 'asc');
  const [filter, setFilter]     = useState('');
  const [regFilter, setRegFilter] = useState('all'); // 'all' | 'registered' | 'unregistered'
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [penaltyPopup, setPenaltyPopup] = useState(null); // { row, x, y }
  const [confirmAction, setConfirmAction] = useState(null); // { label, action }
  const fileInputRef = useRef(null);

  function confirmed(label, action) {
    setConfirmAction({ label, action });
  }

  useEffect(() => { localStorage.setItem('ss_roster_sort_key', sortKey); }, [sortKey]);
  useEffect(() => { localStorage.setItem('ss_roster_sort_dir', sortDir); }, [sortDir]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const sorted = useMemo(() => sortEntries(entries, { field: sortKey, dir: sortDir }), [entries, sortKey, sortDir]);

  const isRegistered = e => (e.paid === 1 || e.paid === '1') && (e.appSigned === 1 || e.appSigned === '1');

  const displayed = useMemo(() => {
    let base = sorted;
    if (regFilter === 'registered')   base = sorted.filter(isRegistered);
    if (regFilter === 'unregistered') base = sorted.filter(e => !isRegistered(e));
    if (!filter) return base;
    const q = filter.toLowerCase();
    return base.filter(e =>
      `${e.boaterFirst} ${e.boaterLast} ${e.coAnglerFirst} ${e.coAnglerLast} ${e.boatNo}`.toLowerCase().includes(q)
    );
  }, [sorted, filter, regFilter]);

  const registeredCount = useMemo(() =>
    entries.filter(e => (e.paid === 1 || e.paid === '1') && (e.appSigned === 1 || e.appSigned === '1')).length
  , [entries]);

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

  if (!isUnlocked) {
    const lockedSorted = [...entries].sort((a, b) => {
      const fa = (a.boaterFirst || '').toLowerCase();
      const fb = (b.boaterFirst || '').toLowerCase();
      if (fa < fb) return -1;
      if (fa > fb) return 1;
      return 0;
    });
    return (
      <div className="tab-panel active" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div className="table-wrapper" style={{ flex: 1, minHeight: 0, maxHeight: 'none' }}>
          <table style={{ tableLayout: 'fixed', minWidth: 480 }}>
            <colgroup>
              <col style={{ width: '25%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '25%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Boater First</th>
                <th>Boater Last</th>
                <th>Co-Angler First</th>
                <th>Co-Angler Last</th>
              </tr>
            </thead>
            <tbody>
              {lockedSorted.map(row => (
                <tr key={row.id}>
                  <td className="td-name">{row.boaterFirst}</td>
                  <td className="td-name">{row.boaterLast}</td>
                  <td className="td-name">{row.coAnglerFirst}</td>
                  <td className="td-name">{row.coAnglerLast}</td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--header-bg)', padding: 40 }}>
                    No entries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-panel active" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="toolbar" style={{ flexShrink: 0 }}>
        {isUnlocked && <button className="btn btn-gold" onClick={onAdd}>+ Add Entry</button>}

        <button
          className="btn btn-outline"
          title="Click to cycle: All → Registered → Not Registered"
          onClick={() => setRegFilter(f => f === 'all' ? 'registered' : f === 'registered' ? 'unregistered' : 'all')}
          style={{
            fontSize: 12,
            borderColor: regFilter === 'registered' ? 'rgba(76,175,80,0.5)' : regFilter === 'unregistered' ? 'rgba(255,107,107,0.5)' : undefined,
            color:       regFilter === 'registered' ? '#4CAF50'              : regFilter === 'unregistered' ? '#ff9090'               : undefined,
          }}
        >
          {regFilter === 'all'          && `All ${entries.length} entries`}
          {regFilter === 'registered'   && `${registeredCount} / ${entries.length} registered`}
          {regFilter === 'unregistered' && `${entries.length - registeredCount} / ${entries.length} not registered`}
          {filter && <span style={{ opacity: 0.65 }}>{` (${displayed.length} shown)`}</span>}
        </button>

        <div style={{ flex: 1 }} />

        <input
          type="search"
          placeholder="Filter by name, boat #…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(139,180,225,0.3)',
            borderRadius: 8,
            color: 'var(--white)',
            fontSize: 14,
            padding: '7px 12px',
            flex: '1 1 120px',
            maxWidth: 220,
            minWidth: 0,
            outline: 'none',
          }}
        />

        {isUnlocked && onBackfillInfo && (
          <button className="btn btn-outline"
                  title="Fill in missing phones and emails from saved contacts (matched by name)"
                  onClick={() => confirmed('backfill phones and emails from contacts', onBackfillInfo)}>
            📋 Backfill info
          </button>
        )}
        {isUnlocked && onNormalizePhones && (
          <button className="btn btn-outline"
                  title="Reformat all phone numbers to xxx-xxx-xxxx"
                  onClick={() => confirmed('normalize all phone numbers to xxx-xxx-xxxx', onNormalizePhones)}>
            📞 Format phone #'s
          </button>
        )}

        <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }}
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

        {isUnlocked && (
          <button className="btn btn-outline"
                  onClick={() => confirmed('import CSV', () => fileInputRef.current?.click())}>
            📂 Import CSV
          </button>
        )}
        <button className="btn btn-primary"
                onClick={() => confirmed('export CSV', () => exportCSV(entries, settings.payoutSettings))}>
          💾 Export CSV
        </button>
        <button className="btn btn-outline"
                onClick={() => confirmed('export HTML', () => exportHTML(sorted, 'Summer Slam Roster'))}>
          📄 Export HTML
        </button>
        {isUnlocked && (
          <button className="btn btn-outline"
                  onClick={() => confirmed('archive year', onArchive)}>
            🗂️ Archive Year
          </button>
        )}
        {isUnlocked && (
          <button className="btn btn-danger"
                  onClick={() => confirmed('clear all entries', onClearAll)}>
            🗑️ Clear All
          </button>
        )}
      </div>

      <div className="table-wrapper" style={{ flex: 1, minHeight: 0, maxHeight: 'none' }}>
        <table className="roster-table" style={{ tableLayout: 'fixed', minWidth: isUnlocked ? 1340 : 1230 }}>
          <colgroup>
            <col style={{ width: 52 }} />   {/* Place      */}
            <col style={{ width: 100 }} />  {/* Boater First */}
            <col style={{ width: 100 }} />  {/* Boater Last  */}
            <col style={{ width: 100 }} />  {/* Co-Angler First */}
            <col style={{ width: 100 }} />  {/* Co-Angler Last  */}
            <col style={{ width: 68 }} />   {/* Boat #      */}
            <col style={{ width: 58 }} />   {/* # Fish      */}
            <col style={{ width: 90 }} />   {/* Lunker lbs  */}
            <col style={{ width: 110 }} />  {/* Total Wt    */}
            <col style={{ width: 68 }} />   {/* Lunker tog  */}
            <col style={{ width: 68 }} />   {/* Option tog  */}
            <col style={{ width: 58 }} />   {/* Paid        */}
            <col style={{ width: 90 }} />   {/* App Signed  */}
            <col style={{ width: 82 }} />   {/* ⚓ Checked   */}
            <col style={{ width: 82 }} />   {/* Buy-In      */}
            {isUnlocked && <col style={{ width: 108 }} />}  {/* Actions */}
          </colgroup>
          <thead>
            <tr>
              {[
                { key: '_rank',        label: 'Place',          align: 'left'   },
                { key: 'boaterFirst',  label: 'Boater First',   align: 'left'   },
                { key: 'boaterLast',   label: 'Boater Last',    align: 'left'   },
                { key: 'coAnglerFirst',label: 'Co-Angler First',align: 'left'   },
                { key: 'coAnglerLast', label: 'Co-Angler Last', align: 'left'   },
                { key: 'boatNo',       label: 'Boat #',         align: 'left'   },
                { key: 'numFish',      label: '# Fish',         align: 'center' },
                { key: 'lunkerWeight', label: 'Lunker (lbs)',   align: 'right'  },
                { key: 'totalWeight',  label: 'Total Wt (lbs)', align: 'right'  },
              ].map(({ key, label, align }) => (
                <th key={key} style={{ textAlign: align, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    onClick={() => toggleSort(key)}>
                  {label}
                  <span style={{ marginLeft: 4, opacity: sortKey === key ? 1 : 0.3, fontSize: 11 }}>
                    {sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : '▲'}
                  </span>
                </th>
              ))}
              <th style={{ textAlign: 'center' }}>Lunker</th>
              <th style={{ textAlign: 'center' }}>Option</th>
              <th style={{ textAlign: 'center' }}>Paid</th>
              <th style={{ textAlign: 'center' }}>App Signed</th>
              <th style={{ textAlign: 'center' }}>Off Water</th>
              <th style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => toggleSort('buyIn')}>
                Buy-In
                <span style={{ marginLeft: 4, opacity: sortKey === 'buyIn' ? 1 : 0.3, fontSize: 11 }}>
                  {sortKey === 'buyIn' ? (sortDir === 'asc' ? '▲' : '▼') : '▲'}
                </span>
              </th>
              {isUnlocked && <th style={{ textAlign: 'center' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {displayed.map(row => {
              const rank = row._rank;
              const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';
              const buyIn = parseFloat(row.buyIn) || 0;
              const buyInClass = buyIn > 0 && buyIn < entryFee ? 'cell-red' : buyIn >= entryFee ? 'cell-green' : 'cell-neutral';

              const flagged = row.needsAttention;
              return (
                <tr
                  key={row.id}
                  style={{ ...(flagged ? { background: 'rgba(255,180,80,0.08)' } : {}) }}
                >
                  <td className={`rank-cell ${rankClass}`}>{rank || ''}</td>
                  <td className="td-name" title={`${row.boaterFirst} ${row.boaterLast}`.trim()}>{flagged && <span style={{ color: '#ffb450', marginRight: 4 }}>⚠️</span>}{row.boaterFirst}</td>
                  <td className="td-name" title={`${row.boaterFirst} ${row.boaterLast}`.trim()}>{row.boaterLast}</td>
                  <td className="td-name" title={`${row.coAnglerFirst} ${row.coAnglerLast}`.trim()}>{row.coAnglerFirst}</td>
                  <td className="td-name" title={`${row.coAnglerFirst} ${row.coAnglerLast}`.trim()}>{row.coAnglerLast}</td>
                  <td
                    onClick={e => { e.stopPropagation(); isUnlocked && handleStartEdit(row, 'boatNo'); }}
                    style={editingId === row.id && editValues.hasOwnProperty('boatNo')
                      ? { padding: 0 }
                      : isUnlocked ? { cursor: 'pointer', padding: '8px 0' } : undefined}
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
                        style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', color: 'inherit', fontSize: 'inherit', lineHeight: 'inherit', boxSizing: 'border-box' }}
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
                    style={{ textAlign: 'center', cursor: isUnlocked ? 'pointer' : undefined, padding: (editingId === row.id && editValues.hasOwnProperty('numFish')) ? 0 : undefined }}
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
                        style={{ display: 'block', width: '100%', padding: '8px 10px', border: 'none', background: 'transparent', color: 'inherit', fontSize: 'inherit', lineHeight: 'inherit', textAlign: 'center', boxSizing: 'border-box' }}
                      />
                    ) : (
                      row.numFish > 0 ? row.numFish : '—'
                    )}
                  </td>
                  <td
                    style={{ textAlign: 'right', fontWeight: 600, cursor: isUnlocked ? 'pointer' : undefined, padding: (editingId === row.id && editValues.hasOwnProperty('lunkerWeight')) ? 0 : undefined }}
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
                        style={{ display: 'block', width: '100%', padding: '8px 10px', border: 'none', background: 'transparent', color: 'inherit', fontSize: 'inherit', lineHeight: 'inherit', textAlign: 'right', boxSizing: 'border-box' }}
                      />
                    ) : (
                      parseFloat(row.lunkerWeight) > 0 ? parseFloat(row.lunkerWeight).toFixed(2) : '—'
                    )}
                  </td>
                  <td
                    style={{ textAlign: 'right', fontWeight: 700, color: '#e8c876', cursor: isUnlocked ? 'pointer' : undefined, padding: (editingId === row.id && editValues.hasOwnProperty('totalWeight')) ? 0 : undefined }}
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
                        style={{ display: 'block', width: '100%', padding: '8px 10px', border: 'none', background: 'transparent', color: 'inherit', fontSize: 'inherit', lineHeight: 'inherit', textAlign: 'right', boxSizing: 'border-box' }}
                      />
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {row._isDQ
                          ? <span style={{ fontSize: 12, background: 'rgba(255,107,107,0.3)', color: '#ff6b6b', borderRadius: 4, padding: '1px 6px', fontWeight: 800 }}>DQ</span>
                          : (parseFloat(row.totalWeight) > 0 ? parseFloat(row.totalWeight).toFixed(2) : '—')
                        }
                        {row.rawWeight > 0 && (
                          <span
                            title="Deductions applied — click for details"
                            onClick={e => { e.stopPropagation(); setPenaltyPopup(p => p?.row?.id === row.id ? null : { row, x: e.clientX, y: e.clientY }); }}
                            style={{ fontSize: 11, background: 'rgba(255,107,107,0.25)', color: '#ff9090', borderRadius: 4, padding: '1px 5px', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}
                          >
                            −{(row.rawWeight - parseFloat(row.totalWeight)).toFixed(2)}
                          </span>
                        )}
                        {row._isDQ && (
                          <span
                            title="Disqualified — late check-in — click for details"
                            onClick={e => { e.stopPropagation(); setPenaltyPopup(p => p?.row?.id === row.id ? null : { row, x: e.clientX, y: e.clientY }); }}
                            style={{ fontSize: 11, background: 'rgba(255,107,107,0.25)', color: '#ff9090', borderRadius: 4, padding: '1px 5px', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}
                          >
                            {row._minsLate}m late
                          </span>
                        )}
                        {!row._isDQ && row._latePenalty > 0 && (
                          <span
                            title="Late penalty applied — click for details"
                            onClick={e => { e.stopPropagation(); setPenaltyPopup(p => p?.row?.id === row.id ? null : { row, x: e.clientX, y: e.clientY }); }}
                            style={{ fontSize: 11, background: 'rgba(255,165,0,0.25)', color: '#ffb450', borderRadius: 4, padding: '1px 5px', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}
                          >
                            −{row._latePenalty.toFixed(2)} late
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
                    onClick={e => { e.stopPropagation(); isUnlocked && onToggleOffWater(row.id); }}
                  >
                    <span style={{
                      display: 'inline-block',
                      width: 24,
                      height: 24,
                      lineHeight: '24px',
                      borderRadius: '50%',
                      fontSize: 13,
                      fontWeight: 700,
                      background: offWater[row.id] ? 'rgba(120,200,255,0.2)' : 'rgba(168,200,160,0.1)',
                      border: `2px solid ${offWater[row.id] ? '#78c8ff' : 'rgba(168,200,160,0.55)'}`,
                      color: offWater[row.id] ? '#78c8ff' : 'var(--header-bg)',
                    }}>
                      {offWater[row.id] ? '✓' : '○'}
                    </span>
                  </td>
                  <td className={buyInBlurred ? 'buyin-blurred' : ''} style={{ textAlign: 'right' }}>
                    <span className={`buyin-val ${buyInClass}`}>${buyIn.toFixed(2)}</span>
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
        const pen = settings?.penalties || {};
        const deadRate  = parseFloat(pen.deadFishPenalty)       || 0.5;
        const shortRate = parseFloat(pen.shortFishPenalty)      || 1.0;
        const countRate = parseInt(pen.shortFishCountPenalty)   ?? 1;
        const overRate  = parseFloat(pen.overLimitPenalty)      || 3.0;
        const maxFish   = parseInt(pen.maxFish)                 || 5;
        const dead = parseInt(r.deadFish)  || 0;
        const shrt = parseInt(r.shortFish) || 0;
        const adjFish = Math.max(0, parseInt(r.numFish) || 0);
        const rawFish = adjFish + shrt * countRate;
        const over = Math.max(0, rawFish - maxFish);
        const deadPen  = dead * deadRate;
        const shortPen = shrt * shortRate;
        const overPen  = over * overRate;
        const totalPen = deadPen + shortPen + overPen;
        const left = Math.min(penaltyPopup.x, window.innerWidth - 260);
        const top  = penaltyPopup.y + 12;
        return (
          <>
            <div onClick={() => setPenaltyPopup(null)} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
            <div style={{
              position: 'fixed', left, top, zIndex: 1000, minWidth: 240,
              background: '#1a2a3a', border: '1px solid rgba(255,107,107,0.4)',
              borderRadius: 10, padding: '14px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              fontSize: 13, color: '#e0e8f0',
            }}>
              <div style={{ fontWeight: 800, color: '#ff9090', marginBottom: 10 }}>Deduction Details</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>Scale weight</span>
                <span style={{ fontWeight: 700 }}>{parseFloat(r.rawWeight ?? r.totalWeight).toFixed(2)} lbs</span>
              </div>
              {dead > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#ff9090' }}>
                <span>Dead fish ({dead} × {deadRate.toFixed(2)})</span><span>−{deadPen.toFixed(2)} lbs</span>
              </div>}
              {shrt > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#ff9090' }}>
                <span>Short fish ({shrt} × {shortRate.toFixed(2)}, fish {rawFish}→{adjFish})</span><span>−{shortPen.toFixed(2)} lbs</span>
              </div>}
              {over > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#ff9090' }}>
                <span>Over limit ({over} × {overRate.toFixed(2)})</span><span>−{overPen.toFixed(2)} lbs</span>
              </div>}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 800, marginBottom: (r._isDQ || r._latePenalty > 0) ? 8 : 0 }}>
                <span style={{ color: '#e8c876' }}>After fish penalties</span>
                <span style={{ color: '#e8c876' }}>{parseFloat(r.totalWeight).toFixed(2)} lbs</span>
              </div>
              {r._isDQ && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#ff6b6b', fontWeight: 800 }}>
                  <span>⛔ DQ — {r._minsLate} min late (≥{settings?.penalties?.latePenaltyDQMin ?? 15} min)</span>
                  <span>DQ</span>
                </div>
              )}
              {!r._isDQ && r._latePenalty > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#ffb450' }}>
                  <span>Late ({r._minsLate} min × {parseFloat(settings?.penalties?.latePenaltyPerMin ?? 1).toFixed(2)})</span>
                  <span>−{r._latePenalty.toFixed(2)} lbs</span>
                </div>
              )}
              {(r._isDQ || r._latePenalty > 0) && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                  <span style={{ color: '#e8c876' }}>Final weight</span>
                  <span style={{ color: r._isDQ ? '#ff6b6b' : '#e8c876' }}>
                    {r._isDQ ? 'DQ' : `${(r._effectiveWeight ?? 0).toFixed(2)} lbs`}
                  </span>
                </div>
              )}
              {isUnlocked && (
                <button
                  className="btn btn-danger btn-sm"
                  style={{ marginTop: 12, width: '100%' }}
                  onClick={() => { onClearDeductions(r.id); setPenaltyPopup(null); }}
                >
                  ✕ Clear Deductions
                </button>
              )}
            </div>
          </>
        );
      })()}

      {confirmAction && (
        <ConfirmActionModal
          label={confirmAction.label}
          onConfirm={() => { confirmAction.action(); setConfirmAction(null); }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
