import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { importCSV, exportCSV } from '../utils/csv';
import { exportHTML } from '../utils/exportHtml';
import ConfirmActionModal from './ConfirmActionModal';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusCell({ val }) {
  if (val === 1 || val === '1') return <span className="cell-green">YES</span>;
  if (val === 0 || val === '0') return <span className="cell-red">NO</span>;
  return <span className="cell-neutral">—</span>;
}

function withAttentionFirst(compareFn) {
  const fn = (rowA, rowB, columnId) => {
    if (rowA.original.needsAttention !== rowB.original.needsAttention) {
      return rowA.original.needsAttention ? -1 : 1;
    }
    return compareFn(rowA, rowB, columnId);
  };
  fn.autoRemove = () => false;
  return fn;
}

const rankSort = withAttentionFirst((a, b) => {
  const va = a.original._rank ?? Infinity;
  const vb = b.original._rank ?? Infinity;
  return va - vb;
});

const boatNoSort = withAttentionFirst((a, b) => {
  const va = a.original.boatNo ? (parseFloat(a.original.boatNo) || 0) : Infinity;
  const vb = b.original.boatNo ? (parseFloat(b.original.boatNo) || 0) : Infinity;
  return va - vb;
});

const numericSort = withAttentionFirst((a, b, id) =>
  (parseFloat(a.original[id]) || 0) - (parseFloat(b.original[id]) || 0)
);

const stringSort = withAttentionFirst((a, b, id) => {
  const va = (a.original[id] || '').toLowerCase().trim();
  const vb = (b.original[id] || '').toLowerCase().trim();
  if (!va && vb) return 1;
  if (!vb && va) return -1;
  return va < vb ? -1 : va > vb ? 1 : 0;
});

function rosterFilterFn(row, _columnId, filterValue) {
  const { text, regFilter } = filterValue || {};
  const r = row.original;
  const isPaid    = r.paid === 1 || r.paid === '1';
  const isSigned  = r.appSigned === 1 || r.appSigned === '1';
  if (regFilter === 'registered'   && !(isPaid && isSigned)) return false;
  if (regFilter === 'unregistered' && isPaid && isSigned)    return false;
  if (!text) return true;
  const q = text.toLowerCase();
  return `${r.boaterFirst} ${r.boaterLast} ${r.coAnglerFirst} ${r.coAnglerLast} ${r.boatNo}`.toLowerCase().includes(q);
}
rosterFilterFn.autoRemove = v => !v?.text && (!v?.regFilter || v.regFilter === 'all');

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const COL_WIDTHS = {
  _rank: 52, boaterFirst: 100, boaterLast: 100, coAnglerFirst: 100, coAnglerLast: 100,
  boatNo: 68, numFish: 58, lunkerWeight: 90, totalWeight: 110,
  lunker: 68, option: 68, paid: 58, appSigned: 90, offWater: 82, buyIn: 82, actions: 108,
  signedUpAt: 130,
};

export default function RosterTab({
  entries, settings, isUnlocked, buyInBlurred,
  onEdit, onAdd, onDelete, onClearAll, onImport,
  onToggleOffWater, onToggleField, onUpdateInlineField,
  onClearDeductions, onArchive, onBackfillInfo, onNormalizePhones,
}) {
  const entryFee = parseFloat(settings.fees?.entryFee) || 249;
  const offWater = settings.offWater || {};

  const [sorting, setSorting] = useState(() => {
    const key = localStorage.getItem('ss_roster_sort_key') || '_rank';
    const dir = localStorage.getItem('ss_roster_sort_dir') || 'asc';
    return [{ id: key, desc: dir === 'desc' }];
  });
  const [globalFilter, setGlobalFilter] = useState({ text: '', regFilter: 'all' });
  const [editingId, setEditingId]       = useState(null);
  const [editValues, setEditValues]     = useState({});
  const [penaltyPopup, setPenaltyPopup] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionsPos, setActionsPos]   = useState({ top: 0, right: 0, bottom: 'auto' });
  const fileInputRef      = useRef(null);
  const tableContainerRef = useRef(null);
  const actionsRef        = useRef(null);

  useEffect(() => {
    if (!actionsOpen) return;
    function handleClick(e) {
      if (actionsRef.current && !actionsRef.current.contains(e.target)) setActionsOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [actionsOpen]);

  function openActions() {
    if (actionsRef.current) {
      const rect = actionsRef.current.getBoundingClientRect();
      const right = window.innerWidth - rect.right;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceBelow >= 220 || spaceBelow >= spaceAbove) {
        setActionsPos({ top: rect.bottom + 6, bottom: 'auto', right });
      } else {
        setActionsPos({ top: 'auto', bottom: window.innerHeight - rect.top + 6, right });
      }
    }
    setActionsOpen(o => !o);
  }

  useEffect(() => {
    if (sorting[0]) {
      localStorage.setItem('ss_roster_sort_key', sorting[0].id);
      localStorage.setItem('ss_roster_sort_dir', sorting[0].desc ? 'desc' : 'asc');
    }
  }, [sorting]);

  const registeredCount = useMemo(() =>
    entries.filter(e => (e.paid === 1 || e.paid === '1') && (e.appSigned === 1 || e.appSigned === '1')).length,
  [entries]);

  const duplicateBoatNos = useMemo(() => {
    const counts = {};
    entries.forEach(e => { if (e.boatNo) counts[e.boatNo] = (counts[e.boatNo] || 0) + 1; });
    return new Set(Object.keys(counts).filter(k => counts[k] > 1));
  }, [entries]);

  function confirmed(label, action) { setConfirmAction({ label, action }); }
  function handleCancelEdit() { setEditingId(null); setEditValues({}); }
  function handleSaveInline(rowId, field) {
    onUpdateInlineField?.(rowId, field, editValues[field]);
    setEditingId(null);
    setEditValues({});
  }
  function startEdit(row, field) {
    setEditingId(row.id);
    setEditValues({ [field]: row[field] || '' });
  }

  // Inline edit input shared renderer
  function InlineInput({ rowId, field, type = 'text', step, align = 'left' }) {
    return (
      <input
        id={`roster-${rowId}-${field}`}
        name={field}
        type={type} step={step}
        value={editValues[field] ?? ''}
        onChange={e => setEditValues(v => ({ ...v, [field]: e.target.value }))}
        onBlur={() => handleSaveInline(rowId, field)}
        onKeyDown={e => {
          if (e.key === 'Enter') handleSaveInline(rowId, field);
          if (e.key === 'Escape') handleCancelEdit();
        }}
        onClick={e => e.stopPropagation()}
        autoFocus
        style={{
          display: 'block', width: '100%', padding: '8px 10px', border: 'none',
          background: 'transparent', color: 'inherit', fontSize: 'inherit',
          lineHeight: 'inherit', textAlign: align, boxSizing: 'border-box',
        }}
      />
    );
  }

  // Column definitions
  const columns = useMemo(() => {
    const isEditing = (rowId, field) => editingId === rowId && editValues.hasOwnProperty(field);

    return [
      {
        id: '_rank', accessorKey: '_rank', header: 'Place', size: COL_WIDTHS._rank,
        sortingFn: rankSort,
        meta: { getTdClassName: row => `rank-cell ${row._rank === 1 ? 'rank-1' : row._rank === 2 ? 'rank-2' : row._rank === 3 ? 'rank-3' : ''}` },
        cell: ({ row: { original: r } }) => r._rank || '',
      },
      {
        id: 'boaterFirst', accessorKey: 'boaterFirst', header: 'Boater First', size: COL_WIDTHS.boaterFirst,
        sortingFn: stringSort,
        meta: { tdClassName: 'td-name' },
        cell: ({ row: { original: r } }) => (
          <>
            {r.needsAttention && <span style={{ color: '#ffb450', marginRight: 4 }}>⚠️</span>}
            {r.boaterFirst}
          </>
        ),
      },
      {
        id: 'boaterLast', accessorKey: 'boaterLast', header: 'Boater Last', size: COL_WIDTHS.boaterLast,
        sortingFn: stringSort,
        meta: { tdClassName: 'td-name' },
        cell: ({ row: { original: r } }) => r.boaterLast,
      },
      {
        id: 'coAnglerFirst', accessorKey: 'coAnglerFirst', header: 'Co-Angler First', size: COL_WIDTHS.coAnglerFirst,
        sortingFn: stringSort,
        meta: { tdClassName: 'td-name' },
        cell: ({ row: { original: r } }) => r.coAnglerFirst,
      },
      {
        id: 'coAnglerLast', accessorKey: 'coAnglerLast', header: 'Co-Angler Last', size: COL_WIDTHS.coAnglerLast,
        sortingFn: stringSort,
        meta: { tdClassName: 'td-name' },
        cell: ({ row: { original: r } }) => r.coAnglerLast,
      },
      {
        id: 'boatNo', accessorKey: 'boatNo', header: 'Boat #', size: COL_WIDTHS.boatNo,
        sortingFn: boatNoSort,
        meta: {
          getTdStyle: r => isEditing(r.id, 'boatNo') ? { padding: 0 } : isUnlocked ? { cursor: 'pointer', padding: '8px 0' } : undefined,
          onTdClick: (e, r) => { e.stopPropagation(); isUnlocked && startEdit(r, 'boatNo'); },
        },
        cell: ({ row: { original: r } }) => isEditing(r.id, 'boatNo')
          ? <InlineInput rowId={r.id} field="boatNo" />
          : (
            <div style={{ padding: '0 12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {r.boatNo}
              {duplicateBoatNos.has(String(r.boatNo)) && (
                <span title="Duplicate boat number" style={{ marginLeft: 4, color: '#ffb450', fontWeight: 700 }}>!</span>
              )}
            </div>
          ),
      },
      {
        id: 'numFish', accessorKey: 'numFish', header: '# Fish', size: COL_WIDTHS.numFish,
        sortingFn: numericSort,
        meta: {
          tdStyle: { textAlign: 'center' },
          getTdStyle: r => ({ textAlign: 'center', cursor: isUnlocked ? 'pointer' : undefined, padding: isEditing(r.id, 'numFish') ? 0 : undefined }),
          onTdClick: (e, r) => { e.stopPropagation(); isUnlocked && startEdit(r, 'numFish'); },
        },
        cell: ({ row: { original: r } }) => isEditing(r.id, 'numFish')
          ? <InlineInput rowId={r.id} field="numFish" type="number" align="center" />
          : (r.numFish > 0 ? r.numFish : '—'),
      },
      {
        id: 'lunkerWeight', accessorKey: 'lunkerWeight', header: 'Lunker (lbs)', size: COL_WIDTHS.lunkerWeight,
        sortingFn: numericSort,
        meta: {
          getTdStyle: r => ({ textAlign: 'right', fontWeight: 600, cursor: isUnlocked ? 'pointer' : undefined, padding: isEditing(r.id, 'lunkerWeight') ? 0 : undefined }),
          onTdClick: (e, r) => { e.stopPropagation(); isUnlocked && startEdit(r, 'lunkerWeight'); },
        },
        cell: ({ row: { original: r } }) => isEditing(r.id, 'lunkerWeight')
          ? <InlineInput rowId={r.id} field="lunkerWeight" type="number" step="0.01" align="right" />
          : (parseFloat(r.lunkerWeight) > 0 ? parseFloat(r.lunkerWeight).toFixed(2) : '—'),
      },
      {
        id: 'totalWeight', accessorKey: 'totalWeight', header: 'Total Wt (lbs)', size: COL_WIDTHS.totalWeight,
        sortingFn: numericSort,
        meta: {
          getTdStyle: r => ({ textAlign: 'right', fontWeight: 700, color: '#e8c876', cursor: isUnlocked ? 'pointer' : undefined, padding: isEditing(r.id, 'totalWeight') ? 0 : undefined }),
          onTdClick: (e, r) => { e.stopPropagation(); isUnlocked && startEdit(r, 'totalWeight'); },
        },
        cell: ({ row: { original: r } }) => isEditing(r.id, 'totalWeight')
          ? <InlineInput rowId={r.id} field="totalWeight" type="number" step="0.01" align="right" />
          : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {r._isDQ
                ? <span style={{ fontSize: 12, background: 'rgba(255,107,107,0.3)', color: '#ff6b6b', borderRadius: 4, padding: '1px 6px', fontWeight: 800 }}>DQ</span>
                : (parseFloat(r.totalWeight) > 0 ? parseFloat(r.totalWeight).toFixed(2) : '—')
              }
              {r.rawWeight > 0 && (
                <span
                  title="Deductions applied — click for details"
                  onClick={e => { e.stopPropagation(); setPenaltyPopup(p => p?.row?.id === r.id ? null : { row: r, x: e.clientX, y: e.clientY }); }}
                  style={{ fontSize: 11, background: 'rgba(255,107,107,0.25)', color: '#ff9090', borderRadius: 4, padding: '1px 5px', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}
                >
                  −{(r.rawWeight - parseFloat(r.totalWeight)).toFixed(2)}
                </span>
              )}
              {r._isDQ && (
                <span
                  title="Disqualified — late check-in — click for details"
                  onClick={e => { e.stopPropagation(); setPenaltyPopup(p => p?.row?.id === r.id ? null : { row: r, x: e.clientX, y: e.clientY }); }}
                  style={{ fontSize: 11, background: 'rgba(255,107,107,0.25)', color: '#ff9090', borderRadius: 4, padding: '1px 5px', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}
                >
                  {r._minsLate}m late
                </span>
              )}
              {!r._isDQ && r._latePenalty > 0 && (
                <span
                  title="Late penalty applied — click for details"
                  onClick={e => { e.stopPropagation(); setPenaltyPopup(p => p?.row?.id === r.id ? null : { row: r, x: e.clientX, y: e.clientY }); }}
                  style={{ fontSize: 11, background: 'rgba(255,165,0,0.25)', color: '#ffb450', borderRadius: 4, padding: '1px 5px', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}
                >
                  −{r._latePenalty.toFixed(2)} late
                </span>
              )}
            </span>
          ),
      },
      ...['lunker', 'option', 'paid', 'appSigned'].map(field => ({
        id: field, accessorKey: field,
        header: field === 'appSigned' ? 'App Signed' : field.charAt(0).toUpperCase() + field.slice(1),
        size: COL_WIDTHS[field],
        enableSorting: false,
        meta: {
          tdStyle: { textAlign: 'center' },
          getTdStyle: () => ({ textAlign: 'center', cursor: isUnlocked ? 'pointer' : undefined }),
          onTdClick: (e, r) => { e.stopPropagation(); isUnlocked && onToggleField(r.id, field); },
        },
        cell: ({ row: { original: r } }) => <StatusCell val={r[field]} />,
      })),
      {
        id: 'offWater', header: 'Off Water', size: COL_WIDTHS.offWater,
        enableSorting: false,
        meta: {
          tdStyle: { textAlign: 'center' },
          getTdStyle: () => ({ textAlign: 'center', cursor: isUnlocked ? 'pointer' : undefined }),
          onTdClick: (e, r) => { e.stopPropagation(); isUnlocked && onToggleOffWater(r.id); },
        },
        cell: ({ row: { original: r } }) => (
          <span style={{
            display: 'inline-block', width: 24, height: 24, lineHeight: '24px',
            borderRadius: '50%', fontSize: 13, fontWeight: 700,
            background: offWater[r.id] ? 'rgba(120,200,255,0.2)' : 'rgba(168,200,160,0.1)',
            border: `2px solid ${offWater[r.id] ? '#78c8ff' : 'rgba(168,200,160,0.55)'}`,
            color: offWater[r.id] ? '#78c8ff' : 'var(--header-bg)',
          }}>
            {offWater[r.id] ? '✓' : '○'}
          </span>
        ),
      },
      {
        id: 'buyIn', accessorKey: 'buyIn', header: 'Buy-In', size: COL_WIDTHS.buyIn,
        sortingFn: numericSort,
        meta: {
          getTdClassName: r => buyInBlurred ? 'buyin-blurred' : '',
          tdStyle: { textAlign: 'right' },
        },
        cell: ({ row: { original: r } }) => {
          const buyIn = parseFloat(r.buyIn) || 0;
          const cls = buyIn > 0 && buyIn < entryFee ? 'cell-red' : buyIn >= entryFee ? 'cell-green' : 'cell-neutral';
          return <span className={`buyin-val ${cls}`}>${buyIn.toFixed(2)}</span>;
        },
      },
      ...(!isUnlocked ? [{
        id: 'signedUpAt', accessorKey: 'signedUpAt', header: 'Signed Up', size: COL_WIDTHS.signedUpAt,
        enableSorting: true,
        sortingFn: withAttentionFirst((a, b) => {
          const va = a.original.signedUpAt ? new Date(a.original.signedUpAt).getTime() : 0;
          const vb = b.original.signedUpAt ? new Date(b.original.signedUpAt).getTime() : 0;
          return va - vb;
        }),
        meta: { tdStyle: { textAlign: 'center', fontSize: 11, color: 'var(--header-bg)' } },
        cell: ({ row: { original: r } }) => {
          if (!r.signedUpAt) return '—';
          const d = new Date(r.signedUpAt + (r.signedUpAt.includes('Z') || r.signedUpAt.includes('+') ? '' : 'Z'));
          return (
            <span style={{ whiteSpace: 'nowrap' }}>
              {d.toLocaleDateString([], { month: '2-digit', day: '2-digit', year: '2-digit' })}
              {' '}
              {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          );
        },
      }] : []),
      ...(isUnlocked ? [{
        id: 'actions', header: 'Actions', size: COL_WIDTHS.actions,
        enableSorting: false,
        meta: { tdStyle: { textAlign: 'center' } },
        cell: ({ row: { original: r } }) => (
          <span onClick={e => e.stopPropagation()}>
            <button className="btn btn-outline btn-sm" onClick={() => onEdit(r)}>Edit</button>
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(r.id)} style={{ marginLeft: 4 }}>Del</button>
          </span>
        ),
      }] : []),
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, editValues, isUnlocked, duplicateBoatNos, offWater, buyInBlurred, entryFee]);

  const table = useReactTable({
    data: entries,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: rosterFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: row => String(row.id),
  });

  const rows = table.getRowModel().rows;
  const filteredCount = rows.length;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 41,
    overscan: 12,
  });

  const virtualItems  = virtualizer.getVirtualItems();
  const totalSize     = virtualizer.getTotalSize();
  const paddingTop    = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom = virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0;

  const tableMinWidth = isUnlocked
    ? Object.values(COL_WIDTHS).reduce((a, b) => a + b, 0)
    : Object.values(COL_WIDTHS).reduce((a, b) => a + b, 0) - COL_WIDTHS.actions;

  // --- Locked view ---
  if (!isUnlocked) {
    const lockedSorted = [...entries].sort((a, b) => {
      const fa = (a.boaterFirst || '').toLowerCase();
      const fb = (b.boaterFirst || '').toLowerCase();
      return fa < fb ? -1 : fa > fb ? 1 : 0;
    });
    return (
      <div className="tab-panel active" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div className="table-wrapper" style={{ flex: 1, minHeight: 0, maxHeight: 'none' }}>
          <table style={{ tableLayout: 'fixed', minWidth: 480 }}>
            <colgroup>
              <col style={{ width: '25%' }} /><col style={{ width: '25%' }} />
              <col style={{ width: '25%' }} /><col style={{ width: '25%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Boater First</th><th>Boater Last</th>
                <th>Co-Angler First</th><th>Co-Angler Last</th>
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
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--header-bg)', padding: 40 }}>No entries yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --- Sort header helper ---
  function SortHeader({ column, label, style }) {
    const sorted = column.getIsSorted();
    return (
      <th
        style={{ textAlign: 'left', cursor: column.getCanSort() ? 'pointer' : undefined, userSelect: 'none', whiteSpace: 'nowrap', ...style }}
        onClick={column.getToggleSortingHandler()}
      >
        {label}
        {column.getCanSort() && (
          <span style={{ marginLeft: 4, opacity: sorted ? 1 : 0.3, fontSize: 11 }}>
            {sorted === 'desc' ? '▼' : '▲'}
          </span>
        )}
      </th>
    );
  }

  const regFilter = globalFilter.regFilter || 'all';

  return (
    <div className="tab-panel active" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Toolbar */}
      <div className="toolbar" style={{ flexShrink: 0 }}>
        <button className="btn btn-gold" onClick={onAdd}>+ Add Entry</button>

        <button
          className="btn btn-outline"
          title="Click to cycle: All → Registered → Not Registered"
          onClick={() => setGlobalFilter(f => ({ ...f, regFilter: f.regFilter === 'all' ? 'registered' : f.regFilter === 'registered' ? 'unregistered' : 'all' }))}
          style={{
            fontSize: 12,
            borderColor: regFilter === 'registered' ? 'rgba(76,175,80,0.5)' : regFilter === 'unregistered' ? 'rgba(255,107,107,0.5)' : undefined,
            color:       regFilter === 'registered' ? '#4CAF50'              : regFilter === 'unregistered' ? '#ff9090'               : undefined,
          }}
        >
          {regFilter === 'all'          && `All ${entries.length} entries`}
          {regFilter === 'registered'   && `${registeredCount} / ${entries.length} registered`}
          {regFilter === 'unregistered' && `${entries.length - registeredCount} / ${entries.length} not registered`}
          {globalFilter.text && <span style={{ opacity: 0.65 }}>{` (${filteredCount} shown)`}</span>}
        </button>

        <div style={{ flex: 1 }} />

        <input
          id="roster-search"
          name="search"
          type="search"
          placeholder="Filter by name, boat #…"
          value={globalFilter.text}
          onChange={e => setGlobalFilter(f => ({ ...f, text: e.target.value }))}
          style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(139,180,225,0.3)',
            borderRadius: 8, color: 'var(--white)', fontSize: 16, padding: '7px 12px',
            flex: '1 1 120px', maxWidth: 220, minWidth: 0, outline: 'none',
          }}
        />

        <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }}
               onChange={e => {
                 const f = e.target.files[0];
                 if (f) importCSV(f).then(onImport).catch(err => alert(`Import error: ${err.message}`));
                 e.target.value = '';
               }} />

        <div ref={actionsRef} style={{ position: 'relative' }}>
          <button className="btn btn-outline" onClick={openActions}>
            ⚙️ Actions {actionsOpen ? '▲' : '▼'}
          </button>
          {actionsOpen && (
            <div className="actions-dropdown" style={{ position: 'fixed', top: actionsPos.top, bottom: actionsPos.bottom, right: actionsPos.right }}>
              <button className="actions-item" onClick={() => { setActionsOpen(false); confirmed('import CSV', () => fileInputRef.current?.click()); }}>
                📂 Import CSV
              </button>
              <button className="actions-item" onClick={() => { setActionsOpen(false); confirmed('export CSV', () => exportCSV(entries, settings.payoutSettings)); }}>
                💾 Export CSV
              </button>
              <button className="actions-item" onClick={() => { setActionsOpen(false); confirmed('export HTML', () => exportHTML(rows.map(r => r.original), 'Summer Slam Roster')); }}>
                📄 Export HTML
              </button>
              <button className="actions-item" onClick={() => { setActionsOpen(false); confirmed('archive year', onArchive); }}>
                🗂️ Archive Year
              </button>
              {onNormalizePhones && (
                <button className="actions-item" onClick={() => { setActionsOpen(false); confirmed('normalize all phone numbers to xxx-xxx-xxxx', onNormalizePhones); }}>
                  📞 Format phone #'s
                </button>
              )}
              {onBackfillInfo && (
                <button className="actions-item" onClick={() => { setActionsOpen(false); confirmed('backfill phones and emails from contacts', onBackfillInfo); }}>
                  📋 Backfill info
                </button>
              )}
              <div className="actions-divider" />
              <button className="actions-item actions-item--danger" onClick={() => { setActionsOpen(false); confirmed('clear all entries', onClearAll); }}>
                🗑️ Clear All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div ref={tableContainerRef} className="table-wrapper" style={{ flex: 1, minHeight: 0, maxHeight: 'none' }}>
        <table className="roster-table" style={{ tableLayout: 'fixed', minWidth: tableMinWidth }}>
          <colgroup>
            {table.getVisibleLeafColumns().map(col => (
              <col key={col.id} style={{ width: col.getSize() }} />
            ))}
          </colgroup>
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => {
                  const align = ['numFish', 'lunker', 'option', 'paid', 'appSigned', 'offWater', 'actions'].includes(header.id) ? 'center'
                    : ['lunkerWeight', 'totalWeight', 'buyIn'].includes(header.id) ? 'right' : 'left';
                  return (
                    <SortHeader
                      key={header.id}
                      column={header.column}
                      label={flexRender(header.column.columnDef.header, header.getContext())}
                      style={{ textAlign: align }}
                    />
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {paddingTop > 0 && (
              <tr><td colSpan={table.getVisibleLeafColumns().length} style={{ height: paddingTop, padding: 0 }} /></tr>
            )}
            {virtualItems.map(vi => {
              const row = rows[vi.index];
              const r = row.original;
              return (
                <tr key={row.id} style={r.needsAttention ? { background: 'rgba(255,180,80,0.08)' } : undefined}>
                  {row.getVisibleCells().map(cell => {
                    const meta = cell.column.columnDef.meta || {};
                    const tdClassName = meta.getTdClassName?.(r) ?? meta.tdClassName ?? '';
                    const tdStyle = { width: cell.column.getSize(), ...(meta.getTdStyle?.(r) ?? meta.tdStyle ?? {}) };
                    return (
                      <td
                        key={cell.id}
                        className={tdClassName}
                        style={tdStyle}
                        onClick={meta.onTdClick ? e => meta.onTdClick(e, r) : undefined}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {paddingBottom > 0 && (
              <tr><td colSpan={table.getVisibleLeafColumns().length} style={{ height: paddingBottom, padding: 0 }} /></tr>
            )}
          </tbody>
        </table>
        <button className="add-row-btn" onClick={onAdd}>＋ Add New Entry</button>
      </div>

      {/* Penalty popup */}
      {penaltyPopup && (() => {
        const r = penaltyPopup.row;
        const pen = settings?.penalties || {};
        const deadRate  = parseFloat(pen.deadFishPenalty)     || 0.5;
        const shortRate = parseFloat(pen.shortFishPenalty)    || 1.0;
        const countRate = parseInt(pen.shortFishCountPenalty) ?? 1;
        const overRate  = parseFloat(pen.overLimitPenalty)    || 3.0;
        const maxFish   = parseInt(pen.maxFish)               || 5;
        const dead = parseInt(r.deadFish)  || 0;
        const shrt = parseInt(r.shortFish) || 0;
        const adjFish = Math.max(0, parseInt(r.numFish) || 0);
        const rawFish = adjFish + shrt * countRate;
        const over    = Math.max(0, rawFish - maxFish);
        const deadPen  = dead * deadRate;
        const shortPen = shrt * shortRate;
        const overPen  = over * overRate;
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
                <button className="btn btn-danger btn-sm" style={{ marginTop: 12, width: '100%' }}
                        onClick={() => { onClearDeductions(r.id); setPenaltyPopup(null); }}>
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
