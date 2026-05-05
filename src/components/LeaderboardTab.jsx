import { useState } from 'react';
import { getLeaderboardEntries } from '../utils/calculations';

export default function LeaderboardTab({ entries, settings }) {
  const [topN, setTopN] = useState(10);
  const lbEntries = getLeaderboardEntries(entries);
  const displayed = lbEntries.slice(0, topN);
  const { payoutSettings } = settings;

  const totalWeight = lbEntries.reduce((s, e) => s + (parseFloat(e.totalWeight) || 0), 0).toFixed(2);

  const lunkerRows = entries.filter(r => r.lunker === 1 && parseFloat(r.lunkerWeight) > 0);
  const lunkerRow = lunkerRows.length
    ? lunkerRows.reduce((best, r) => parseFloat(r.lunkerWeight) > parseFloat(best.lunkerWeight) ? r : best)
    : null;
  const lunkerToBeat = lunkerRow ? parseFloat(lunkerRow.lunkerWeight).toFixed(2) : '0.00';

  const bagRow = lbEntries[0] || null;
  const largestBag = bagRow ? parseFloat(bagRow.totalWeight).toFixed(2) : '0.00';

  return (
    <div className="tab-panel active">
      <div className="leaderboard-header">
        <h2>🎣 Summer Slam! 🎣</h2>
        <p style={{ color: 'var(--header-bg)', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>
          Live Tournament Leaderboard
        </p>
      </div>

      <div className="summary-grid-top" style={{ marginBottom: 10 }}>
        <div className="summary-chip">
          <span className="sc-lbl">Total Boats</span>
          <span className="sc-val">{lbEntries.length}</span>
        </div>
        <div className="summary-chip">
          <span className="sc-lbl">Lunker to Beat</span>
          <span className="sc-val">{lunkerToBeat} lbs</span>
        </div>
        <div className="summary-chip">
          <span className="sc-lbl">Largest Bag</span>
          <span className="sc-val">{largestBag} lbs</span>
        </div>
        <div className="summary-chip">
          <span className="sc-lbl">Total Weight</span>
          <span className="sc-val">{totalWeight} lbs</span>
        </div>
      </div>

      <div className="summary-grid" style={{ marginBottom: 16 }}>
        <div className="summary-card">
          <span className="s-lbl">🎣 Lunker Holder</span>
          {lunkerRow ? (
            <>
              <span className="s-boat">{lunkerRow.boatNo ? `Boat #${lunkerRow.boatNo}` : ''}</span>
              <span className="s-name">{`${lunkerRow.boaterFirst} ${lunkerRow.boaterLast}`.trim() || '—'}</span>
              <span className="s-name s-co">{`${lunkerRow.coAnglerFirst || ''} ${lunkerRow.coAnglerLast || ''}`.trim() || ''}</span>
            </>
          ) : <span className="s-name">—</span>}
        </div>
        <div className="summary-card">
          <span className="s-lbl">🏆 Bag Leader</span>
          {bagRow ? (
            <>
              <span className="s-boat">{bagRow.boatNo ? `Boat #${bagRow.boatNo}` : ''}</span>
              <span className="s-name">{`${bagRow.boaterFirst} ${bagRow.boaterLast}`.trim() || '—'}</span>
              <span className="s-name s-co">{`${bagRow.coAnglerFirst || ''} ${bagRow.coAnglerLast || ''}`.trim() || ''}</span>
            </>
          ) : <span className="s-name">—</span>}
        </div>
      </div>

      <div className="top-n-control">
        <label>Show Top</label>
        <input type="number" value={topN} min="1" max="500"
               onChange={e => setTopN(parseInt(e.target.value) || 10)} />
        <label>anglers</label>
        <button className="btn btn-primary btn-sm" onClick={() => setTopN(topN)}>Refresh</button>
        <button className="btn btn-gold btn-sm" onClick={() => window.print()}>🖨️ Print / PDF</button>
      </div>

      <div id="lbContainer">
        {displayed.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--header-bg)', padding: 40 }}>
            No entries yet. Add anglers in the Roster tab.
          </p>
        ) : displayed.map(row => {
          const r = row._lbRank;
          const cardClass = r === 1 ? 'gold-card' : r === 2 ? 'silver-card' : r === 3 ? 'bronze-card' : 'normal-card';
          const rankClass = r === 1 ? 'r1' : r === 2 ? 'r2' : r === 3 ? 'r3' : 'rn';
          const rankDisplay = r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`;
          const payoutAmt = payoutSettings?.payouts?.[r - 1] || 0;
          const coName = [row.coAnglerFirst, row.coAnglerLast].filter(Boolean).join(' ') || '—';

          return (
            <div key={row.id} className={`lb-card ${cardClass}`}>
              <div className={`lb-rank ${rankClass}`}>{rankDisplay}</div>
              <div className="lb-boatno">
                <div className="lb-boatno-num">{row.boatNo || '—'}</div>
                <div className="lb-boatno-lbl">Boat #</div>
              </div>
              <div className="lb-anglers">
                <div className="lb-angler-name">{row.boaterFirst} {row.boaterLast}</div>
                <div className="lb-angler-name lb-co">{coName}</div>
              </div>
              <div className="lb-stats">
                <div className="lb-stat-item">
                  <div className="val">{row.numFish || '—'}</div>
                  <div className="lbl">Fish</div>
                </div>
                <div className="lb-stat-item">
                  <div className="val">{parseFloat(row.lunkerWeight) > 0 ? parseFloat(row.lunkerWeight).toFixed(2) : '—'}</div>
                  <div className="lbl">Lunker (lbs)</div>
                </div>
                <div className="lb-stat-item highlight">
                  <div className="val">{parseFloat(row.totalWeight) > 0 ? parseFloat(row.totalWeight).toFixed(2) : '—'} lbs</div>
                  <div className="lbl">Total Weight</div>
                </div>
              </div>
              <div className="lb-payout">
                {payoutAmt > 0 && (
                  <>
                    <div className="val">${payoutAmt.toLocaleString()}</div>
                    <div className="lbl">Payout</div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
