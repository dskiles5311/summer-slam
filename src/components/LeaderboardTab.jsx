import { getLeaderboardEntries, getStats } from '../utils/calculations';

export default function LeaderboardTab({ entries, settings }) {
  const topN = parseInt(settings.payoutSettings?.numWinners) || 10;
  const lbEntries = getLeaderboardEntries(entries);
  const displayed = lbEntries.slice(0, topN);
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
  const option1Payout = (optionPot * 0.7).toFixed(2);
  const option2Payout = (optionPot * 0.3).toFixed(2);

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

      <div className="summary-grid-top" style={{ marginBottom: 10 }}>
        <div className="summary-chip">
          <span className="sc-lbl">Total Boats</span>
          <span className="sc-val">{totalBoats}</span>
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
          <span className="sc-lbl">Total Weight</span>
          <span className="sc-val">{totalWeight} lbs</span>
        </div>
      </div>

      <div className="summary-grid" style={{ marginBottom: 16 }}>
        <div className="summary-card">
          <span className="s-lbl">⚡ Option 1 — ${option1Payout}</span>
          {option1Row ? (
            <>
              <span className="s-boat">{option1Row.boatNo ? `Boat #${option1Row.boatNo}` : ''}</span>
              <span className="s-name">{`${option1Row.boaterFirst} ${option1Row.boaterLast}`.trim() || '—'}</span>
              <span className="s-name s-co">{`${option1Row.coAnglerFirst || ''} ${option1Row.coAnglerLast || ''}`.trim() || ''}</span>
            </>
          ) : <span className="s-name">—</span>}
        </div>
        <div className="summary-card">
          <span className="s-lbl">⚡ Option 2 — ${option2Payout}</span>
          {option2Row ? (
            <>
              <span className="s-boat">{option2Row.boatNo ? `Boat #${option2Row.boatNo}` : ''}</span>
              <span className="s-name">{`${option2Row.boaterFirst} ${option2Row.boaterLast}`.trim() || '—'}</span>
              <span className="s-name s-co">{`${option2Row.coAnglerFirst || ''} ${option2Row.coAnglerLast || ''}`.trim() || ''}</span>
            </>
          ) : <span className="s-name">—</span>}
        </div>
      </div>

      <div className="top-n-control">
        <span style={{ color: 'var(--header-bg)', fontSize: 14 }}>
          Showing top <strong style={{ color: 'var(--gold-light)' }}>{topN}</strong> positions — set in Settings
        </span>
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
          const payouts = payoutSettings?.payouts || [];
          const tiedCount = lbEntries.filter(e => e._lbRank === r).length;
          const payoutSlice = payouts.slice(r - 1, r - 1 + tiedCount);
          const payoutAmt = tiedCount > 1
            ? Math.round(payoutSlice.reduce((s, p) => s + (p || 0), 0) / tiedCount)
            : (payouts[r - 1] || 0);
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
