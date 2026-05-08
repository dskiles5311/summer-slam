import { getLeaderboardEntries, getStats } from '../utils/calculations';

export default function LeaderboardTab({ entries, settings, recentWeighIds = [] }) {
  const topN = parseInt(settings.payoutSettings?.numWinners) || 10;
  const lbEntries = getLeaderboardEntries(entries);
  const { payoutSettings } = settings;

  const totalWeight = lbEntries.reduce((s, e) => s + (parseFloat(e.totalWeight) || 0), 0).toFixed(2);
  const { totalBoats } = getStats(entries, settings.fees);

  const lunkerRows = entries.filter(r => r.lunker === 1 && r.boatNo && parseFloat(r.lunkerWeight) > 0);
  const lunkerRow = lunkerRows.length
    ? lunkerRows.reduce((best, r) => parseFloat(r.lunkerWeight) > parseFloat(best.lunkerWeight) ? r : best)
    : null;
  const lunkerToBeat = lunkerRow ? parseFloat(lunkerRow.lunkerWeight).toFixed(2) : '0.00';

  const bagRows = entries.filter(r => r.paid === 1 && r.appSigned === 1 && parseFloat(r.totalWeight) > 0);
  const bagRow = bagRows.length
    ? bagRows.reduce((best, r) => parseFloat(r.totalWeight) > parseFloat(best.totalWeight) ? r : best)
    : null;
  const largestBag = bagRow ? parseFloat(bagRow.totalWeight).toFixed(2) : '0.00';

  const optFee = parseFloat(settings.fees?.optFee) || 0;
  const optionPot = entries.filter(r => r.option === 1).length * optFee;
  const optionEligible = entries
    .filter(r => r.option === 1 && r.paid === 1 && r.appSigned === 1 && parseFloat(r.totalWeight) > 0)
    .sort((a, b) => parseFloat(b.totalWeight) - parseFloat(a.totalWeight));
  const option1Row = optionEligible[0] || null;
  const option2Row = optionEligible[1] || null;
  const option1Pct = (settings.fees?.option1Pct ?? 70) / 100;
  const option1Payout = (optionPot * option1Pct).toFixed(2);
  const option2Payout = (optionPot * (1 - option1Pct)).toFixed(2);

  const recentWeighCount = parseInt(settings.recentWeighCount) || 2;
  const recentEntries = recentWeighIds
    .slice(0, recentWeighCount)
    .map(id => entries.find(e => e.id === id))
    .filter(Boolean);

  return (
    <div className="tab-panel active" style={{ position: 'relative' }}>
      <img
        src="/SFT%20logo%20color%20no%20background.png"
        alt=""
        aria-hidden="true"
        className="lb-watermark"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '80vmin',
          height: '80vmin',
          objectFit: 'contain',
          opacity: 0.1,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <div className="leaderboard-header">
        <h2>🎣 Summer Slam! 🎣</h2>
        <p style={{ color: 'var(--header-bg)', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>
          Live Tournament Leaderboard
        </p>
      </div>

      <div className="summary-grid-top" style={{ marginBottom: 12, maxWidth: 900, marginLeft: 'auto', marginRight: 'auto' }}>
        <div className="summary-chip">
          <span className="sc-lbl">Total Boats</span>
          <span className="sc-val">{totalBoats}</span>
        </div>
        <div className="summary-chip">
          <span className="sc-lbl">Total Weight</span>
          <span className="sc-val">{totalWeight} lbs</span>
        </div>
        <div className="summary-chip">
          <span className="sc-lbl">Largest Bag</span>
          <span className="sc-val">{largestBag} lbs</span>
          {bagRow && (
            <>
              {bagRow.boatNo && <span className="sc-boat">Boat #{bagRow.boatNo}</span>}
              <span className="sc-name">{`${bagRow.boaterFirst} ${bagRow.boaterLast}`.trim() || '—'}</span>
              {`${bagRow.coAnglerFirst || ''} ${bagRow.coAnglerLast || ''}`.trim() && (
                <span className="sc-co">{`${bagRow.coAnglerFirst || ''} ${bagRow.coAnglerLast || ''}`.trim()}</span>
              )}
            </>
          )}
        </div>
        <div className="summary-chip">
          <span className="sc-lbl">Lunker to Beat</span>
          <span className="sc-val">{lunkerToBeat} lbs</span>
          {lunkerRow && (
            <>
              {lunkerRow.boatNo && <span className="sc-boat">Boat #{lunkerRow.boatNo}</span>}
              <span className="sc-name">{`${lunkerRow.boaterFirst} ${lunkerRow.boaterLast}`.trim() || '—'}</span>
              {`${lunkerRow.coAnglerFirst || ''} ${lunkerRow.coAnglerLast || ''}`.trim() && (
                <span className="sc-co">{`${lunkerRow.coAnglerFirst || ''} ${lunkerRow.coAnglerLast || ''}`.trim()}</span>
              )}
            </>
          )}
        </div>
        <div className="summary-chip">
          <span className="sc-lbl">⚡ Option 1</span>
          <span className="sc-val">${option1Payout}</span>
          {option1Row ? (
            <>
              {option1Row.boatNo && <span className="sc-boat">Boat #{option1Row.boatNo}</span>}
              <span className="sc-name">{`${option1Row.boaterFirst} ${option1Row.boaterLast}`.trim() || '—'}</span>
              {`${option1Row.coAnglerFirst || ''} ${option1Row.coAnglerLast || ''}`.trim() && (
                <span className="sc-co">{`${option1Row.coAnglerFirst || ''} ${option1Row.coAnglerLast || ''}`.trim()}</span>
              )}
            </>
          ) : <span className="sc-name">—</span>}
        </div>
        <div className="summary-chip">
          <span className="sc-lbl">⚡ Option 2</span>
          <span className="sc-val">${option2Payout}</span>
          {option2Row ? (
            <>
              {option2Row.boatNo && <span className="sc-boat">Boat #{option2Row.boatNo}</span>}
              <span className="sc-name">{`${option2Row.boaterFirst} ${option2Row.boaterLast}`.trim() || '—'}</span>
              {`${option2Row.coAnglerFirst || ''} ${option2Row.coAnglerLast || ''}`.trim() && (
                <span className="sc-co">{`${option2Row.coAnglerFirst || ''} ${option2Row.coAnglerLast || ''}`.trim()}</span>
              )}
            </>
          ) : <span className="sc-name">—</span>}
        </div>
      </div>

      {recentEntries.length > 0 && (
        <div className="recently-weighed" style={{ maxWidth: 900, marginLeft: 'auto', marginRight: 'auto', marginBottom: 12 }}>
          <div className="rw-label">⚖️ Recently Weighed</div>
          <div className="rw-cards">
            {recentEntries.map((row, i) => {
              const lw = parseFloat(row.lunkerWeight) || 0;
              const tw = parseFloat(row.totalWeight) || 0;
              const coName = [row.coAnglerFirst, row.coAnglerLast].filter(Boolean).join(' ');
              return (
                <div key={row.id} className={`rw-card${i === 0 ? ' rw-latest' : ''}`}>
                  {i === 0 && <span className="rw-new">NEW</span>}
                  <span className="rw-boat">#{row.boatNo || '—'}</span>
                  <div className="rw-names">
                    <span className="rw-boater">{[row.boaterFirst, row.boaterLast].filter(Boolean).join(' ') || '—'}</span>
                    {coName && <span className="rw-co">{coName}</span>}
                  </div>
                  <div className="rw-stats">
                    <span>{row.numFish || 0} fish</span>
                    {lw > 0 && <span>🎯 {lw.toFixed(2)} lbs</span>}
                    <span className="rw-total">{tw > 0 ? `${tw.toFixed(2)} lbs` : '—'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="top-n-control" style={{ maxWidth: 900, marginLeft: 'auto', marginRight: 'auto' }}>
        <span style={{ color: 'var(--header-bg)', fontSize: 14 }}>
          Showing top <strong style={{ color: 'var(--gold-light)' }}>{topN}</strong> positions — set in Settings
        </span>
        <button className="btn btn-gold btn-sm" onClick={() => window.print()}>🖨️ Print / PDF</button>
      </div>

      <div id="lbContainer" style={{ maxWidth: 900, marginLeft: 'auto', marginRight: 'auto' }}>
        {lbEntries.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--header-bg)', padding: 40 }}>
            No entries yet. Add anglers in the Roster tab.
          </p>
        ) : lbEntries.map((row, idx) => {
          const r = row._lbRank;
          const cardClass = r === 1 ? 'gold-card' : r === 2 ? 'silver-card' : r === 3 ? 'bronze-card' : 'normal-card';
          const rankClass = r === 1 ? 'r1' : r === 2 ? 'r2' : r === 3 ? 'r3' : 'rn';
          const rankDisplay = r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`;
          const payouts = payoutSettings?.payouts || [];
          const tiedCount = lbEntries.filter(e => e._lbRank === r).length;
          const payoutSlice = payouts.slice(r - 1, r - 1 + tiedCount);
          const payoutAmt = tiedCount > 1
            ? Math.round(payoutSlice.reduce((s, p) => s + (p || 0), 0) / tiedCount)
            : (payouts[r - 1] || 0);
          const coName = [row.coAnglerFirst, row.coAnglerLast].filter(Boolean).join(' ') || '—';

          return (
            <div key={row.id} className={`lb-card ${cardClass}${idx >= topN ? ' lb-print-only' : ''}`}>
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
