import { importCSV, exportCSV } from '../utils/csv';

function StatusCell({ val }) {
  if (val === 1 || val === '1') return <span className="cell-green">YES</span>;
  if (val === 0 || val === '0') return <span className="cell-red">NO</span>;
  return <span className="cell-neutral">—</span>;
}

export default function RosterTab({ entries, settings, onEdit, onAdd, onDelete, onClearAll, onImport }) {
  const entryFee = parseFloat(settings.fees?.entryFee) || 249;

  return (
    <div className="tab-panel active">
      <div className="toolbar">
        <button className="btn btn-gold" onClick={onAdd}>+ Add Entry</button>
        <div style={{ flex: 1 }} />
        <label className="btn btn-outline" style={{ cursor: 'pointer' }}>
          📂 Import CSV
          <input type="file" accept=".csv" style={{ display: 'none' }}
                 onChange={e => {
                   const f = e.target.files[0];
                   if (f) importCSV(f).then(onImport).catch(() => {});
                   e.target.value = '';
                 }} />
        </label>
        <button className="btn btn-primary" onClick={() => exportCSV(entries)}>💾 Export CSV</button>
        <button className="btn btn-danger" onClick={onClearAll}>🗑️ Clear All</button>
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
              <th style={{ textAlign: 'right' }}>Buy-In</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(row => {
              const rank = row._rank;
              const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';
              const buyIn = parseFloat(row.buyIn) || 0;
              const buyInClass = buyIn > 0 && buyIn < entryFee ? 'cell-red' : buyIn >= entryFee ? 'cell-green' : 'cell-neutral';

              return (
                <tr key={row.id}>
                  <td className={`rank-cell ${rankClass}`}>{rank || ''}</td>
                  <td>{row.boaterFirst}</td>
                  <td>{row.boaterLast}</td>
                  <td>{row.coAnglerFirst}</td>
                  <td>{row.coAnglerLast}</td>
                  <td>{row.boatNo}</td>
                  <td style={{ textAlign: 'center' }}>
                    {row.numFish !== '' && row.numFish !== null ? row.numFish : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {parseFloat(row.lunkerWeight) > 0 ? parseFloat(row.lunkerWeight).toFixed(2) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#e8c876' }}>
                    {parseFloat(row.totalWeight) > 0 ? parseFloat(row.totalWeight).toFixed(2) : '—'}
                  </td>
                  <td style={{ textAlign: 'center' }}><StatusCell val={row.lunker} /></td>
                  <td style={{ textAlign: 'center' }}><StatusCell val={row.option} /></td>
                  <td style={{ textAlign: 'center' }}><StatusCell val={row.paid} /></td>
                  <td style={{ textAlign: 'center' }}><StatusCell val={row.appSigned} /></td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={buyInClass}>${buyIn.toFixed(2)}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => onEdit(row)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => onDelete(row.id)} style={{ marginLeft: 4 }}>Del</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button className="add-row-btn" onClick={onAdd}>＋ Add New Entry</button>
      </div>
    </div>
  );
}
