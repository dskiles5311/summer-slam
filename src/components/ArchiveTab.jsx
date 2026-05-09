import { useState, useEffect } from 'react';
import { fetchArchiveYears, fetchArchive } from '../utils/api';
import { exportHTML } from '../utils/exportHtml';

export default function ArchiveTab() {
  const [years, setYears]       = useState([]);
  const [activeYear, setActiveYear] = useState(null);
  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [error, setError]       = useState(null);

  useEffect(() => {
    fetchArchiveYears()
      .then(data => {
        setYears(data);
        if (data.length > 0) setActiveYear(data[0]);
      })
      .catch(() => setError('Failed to load archive years'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeYear) return;
    setLoadingEntries(true);
    fetchArchive(activeYear)
      .then(setEntries)
      .catch(() => setError(`Failed to load ${activeYear} archive`))
      .finally(() => setLoadingEntries(false));
  }, [activeYear]);

  if (loading) {
    return (
      <div className="tab-panel active" style={{ textAlign: 'center', padding: 60, color: 'var(--header-bg)' }}>
        Loading archive…
      </div>
    );
  }

  if (error) {
    return (
      <div className="tab-panel active" style={{ textAlign: 'center', padding: 60, color: '#ff9090' }}>
        {error}
      </div>
    );
  }

  return (
    <div className="tab-panel active">
      <div className="toolbar">
        <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--gold-light)' }}>
          🗂️ Tournament Archive
        </span>

        <div style={{ flex: 1 }} />

        {years.length > 0 && (
          <>
            <label style={{ color: 'var(--header-bg)', fontSize: 14 }}>Year:</label>
            <select
              value={activeYear ?? ''}
              onChange={e => setActiveYear(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(139,180,225,0.35)',
                borderRadius: 8,
                color: 'var(--white)',
                fontSize: 14,
                padding: '6px 10px',
                cursor: 'pointer',
              }}
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button
              className="btn btn-outline"
              onClick={() => {
                const ranked = entries.map(e => ({ ...e, _rank: e.place }));
                exportHTML(ranked, `Summer Slam ${activeYear} Results`);
              }}
            >
              📄 Export HTML
            </button>
          </>
        )}
      </div>

      {years.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--header-bg)' }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>No archives yet.</p>
          <p style={{ fontSize: 14 }}>Use the "Archive Year" button on the Roster tab to save a season's results.</p>
        </div>
      ) : (
        <>
          <div style={{ maxWidth: 900, margin: '0 auto 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--header-bg)', fontSize: 13 }}>
              <strong style={{ color: 'var(--gold-light)' }}>{entries.length}</strong> entries
            </span>
            <span style={{ color: 'var(--header-bg)', fontSize: 12, opacity: 0.6 }}>— read only</span>
          </div>

          {loadingEntries ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--header-bg)' }}>Loading…</div>
          ) : (
            <div className="table-wrapper">
              <table className="roster-table" style={{ tableLayout: 'fixed', minWidth: 700 }}>
                <colgroup>
                  <col style={{ width: 60 }} />
                  <col />
                  <col />
                  <col />
                  <col />
                  <col style={{ width: 72 }} />
                  <col style={{ width: 96 }} />
                  <col style={{ width: 64 }} />
                  <col style={{ width: 110 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Place</th>
                    <th style={{ textAlign: 'left' }}>Boater First</th>
                    <th style={{ textAlign: 'left' }}>Boater Last</th>
                    <th style={{ textAlign: 'left' }}>Co-Angler First</th>
                    <th style={{ textAlign: 'left' }}>Co-Angler Last</th>
                    <th style={{ textAlign: 'left' }}>Boat #</th>
                    <th style={{ textAlign: 'right' }}>Lunker (lbs)</th>
                    <th style={{ textAlign: 'center' }}># Fish</th>
                    <th style={{ textAlign: 'right' }}>Total Wt (lbs)</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(row => {
                    const rank = row.place;
                    const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';
                    return (
                      <tr key={row.id}>
                        <td className={`rank-cell ${rankClass}`}>{rank ?? ''}</td>
                        <td className="td-name">{row.boaterFirst}</td>
                        <td className="td-name">{row.boaterLast}</td>
                        <td className="td-name">{row.coAnglerFirst}</td>
                        <td className="td-name">{row.coAnglerLast}</td>
                        <td style={{ padding: '8px 12px' }}>{row.boatNo}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {parseFloat(row.lunkerWeight) > 0 ? parseFloat(row.lunkerWeight).toFixed(2) : '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {row.numFish > 0 ? row.numFish : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#e8c876' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                            {parseFloat(row.totalWeight) > 0 ? parseFloat(row.totalWeight).toFixed(2) : '—'}
                            {row.rawWeight > 0 && (
                              <span style={{ fontSize: 11, background: 'rgba(255,107,107,0.25)', color: '#ff9090', borderRadius: 4, padding: '1px 5px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                −{(row.rawWeight - parseFloat(row.totalWeight)).toFixed(2)}
                              </span>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
