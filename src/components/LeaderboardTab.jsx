import { useState, useEffect } from 'react';
import { getLeaderboardEntries } from '../utils/calculations';
import { exportHTML } from '../utils/exportHtml';

export default function LeaderboardTab({ entries, settings }) {
  const topN = parseInt(settings.payoutSettings?.numWinners) || 10;
  const lbEntries = getLeaderboardEntries(entries);
  const { payoutSettings } = settings;

  const totalWeight = lbEntries.reduce((s, e) => s + (parseFloat(e.totalWeight) || 0), 0).toFixed(2);


  const lunkerRows = entries.filter(r => r.lunker === 1 && r.boatNo && parseFloat(r.lunkerWeight) > 0);
  const lunkerRow = lunkerRows.length
    ? lunkerRows.reduce((best, r) => parseFloat(r.lunkerWeight) > parseFloat(best.lunkerWeight) ? r : best)
    : null;
  const lunkerRow2 = lunkerRows.length > 1
    ? lunkerRows.filter(r => r.id !== lunkerRow?.id)
        .reduce((best, r) => parseFloat(r.lunkerWeight) > parseFloat(best.lunkerWeight) ? r : best)
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

  const checkedInCount = entries.filter(e => e.boatNo).length;
  const boatsWeighed   = entries.filter(e => e.boatNo && parseFloat(e.totalWeight) > 0).length;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const cwEntry    = settings.currentlyWeighing;
  const cwDuration = (parseInt(settings.currentlyWeighingDuration) || 2) * (settings.currentlyWeighingUnit === 'seconds' ? 1000 : 60000);
  const cwActive   = settings.showCurrentlyWeighing !== false && cwEntry && (now - cwEntry.setAt) < cwDuration;

  const showRecentWeighed = settings.showRecentWeighed !== false;
  const recentWeighCount = parseInt(settings.recentWeighCount) || 2;
  const recentEntries = showRecentWeighed && recentWeighCount > 0
    ? [...entries]
        .filter(e => e.weighedAt)
        .sort((a, b) => new Date(b.weighedAt) - new Date(a.weighedAt))
        .slice(0, recentWeighCount)
    : [];

  return (
    <div className="tab-panel active">
      <div className="leaderboard-header">
        <h2>🎣 Summer Slam! 🎣</h2>
        <p style={{ color: 'var(--header-bg)', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>
          Live Tournament Leaderboard &nbsp;·&nbsp; <strong>{boatsWeighed} of {checkedInCount}</strong> Boats Weighed
        </p>
      </div>

      <div className="summary-grid-top" style={{ marginBottom: 12, maxWidth: 900, marginLeft: 'auto', marginRight: 'auto' }}>
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
              <span className="sc-name">{[bagRow.boaterFirst, bagRow.boaterLast, bagRow.boaterSuffix].filter(Boolean).join(' ') || '—'}</span>
              {[bagRow.coAnglerFirst, bagRow.coAnglerLast, bagRow.coAnglerSuffix].filter(Boolean).join(' ') && (
                <span className="sc-co">{[bagRow.coAnglerFirst, bagRow.coAnglerLast, bagRow.coAnglerSuffix].filter(Boolean).join(' ')}</span>
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
              <span className="sc-name">{[lunkerRow.boaterFirst, lunkerRow.boaterLast, lunkerRow.boaterSuffix].filter(Boolean).join(' ') || '—'}</span>
              {[lunkerRow.coAnglerFirst, lunkerRow.coAnglerLast, lunkerRow.coAnglerSuffix].filter(Boolean).join(' ') && (
                <span className="sc-co">{[lunkerRow.coAnglerFirst, lunkerRow.coAnglerLast, lunkerRow.coAnglerSuffix].filter(Boolean).join(' ')}</span>
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
              <span className="sc-name">{[option1Row.boaterFirst, option1Row.boaterLast, option1Row.boaterSuffix].filter(Boolean).join(' ') || '—'}</span>
              {[option1Row.coAnglerFirst, option1Row.coAnglerLast, option1Row.coAnglerSuffix].filter(Boolean).join(' ') && (
                <span className="sc-co">{[option1Row.coAnglerFirst, option1Row.coAnglerLast, option1Row.coAnglerSuffix].filter(Boolean).join(' ')}</span>
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
              <span className="sc-name">{[option2Row.boaterFirst, option2Row.boaterLast, option2Row.boaterSuffix].filter(Boolean).join(' ') || '—'}</span>
              {[option2Row.coAnglerFirst, option2Row.coAnglerLast, option2Row.coAnglerSuffix].filter(Boolean).join(' ') && (
                <span className="sc-co">{[option2Row.coAnglerFirst, option2Row.coAnglerLast, option2Row.coAnglerSuffix].filter(Boolean).join(' ')}</span>
              )}
            </>
          ) : <span className="sc-name">—</span>}
        </div>
      </div>

      {cwActive && (
        <div className="no-print" style={{ maxWidth: 900, marginLeft: 'auto', marginRight: 'auto', marginBottom: 12 }}>
          <div className="rw-label" style={{ color: '#ffb450' }}>⚖️ Currently Weighing...</div>
          <div className="rw-cards">
            <div className="rw-card rw-latest" style={{ borderColor: 'rgba(255,180,80,0.5)', background: 'rgba(255,180,80,0.08)' }}>
              <div className="rw-icon">
                <span style={{ fontSize: 28 }}>⚖️</span>
              </div>
              <div className="rw-boat">
                <div className="rw-boat-num">{cwEntry.boatNo || '—'}</div>
                <div className="rw-boat-lbl">Boat #</div>
              </div>
              <div className="rw-names">
                <span className="rw-boater">{[cwEntry.boaterFirst, cwEntry.boaterLast, cwEntry.boaterSuffix].filter(Boolean).join(' ') || '—'}</span>
                {[cwEntry.coAnglerFirst, cwEntry.coAnglerLast, cwEntry.coAnglerSuffix].filter(Boolean).join(' ') && (
                  <span className="rw-co">{[cwEntry.coAnglerFirst, cwEntry.coAnglerLast, cwEntry.coAnglerSuffix].filter(Boolean).join(' ')}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {recentEntries.length > 0 && (
        <div className="no-print" style={{ maxWidth: 900, marginLeft: 'auto', marginRight: 'auto', marginBottom: 12 }}>
          <div className="rw-label">⚖️ Recently Weighed</div>
          <div className="rw-cards">
            {recentEntries.map((row, i) => {
              const lw  = parseFloat(row.lunkerWeight) || 0;
              const raw = parseFloat(row.totalWeight) || 0;
              const tw  = row._isDQ ? 0 : (row._effectiveWeight ?? raw);
              const coName = [row.coAnglerFirst, row.coAnglerLast, row.coAnglerSuffix].filter(Boolean).join(' ');
              return (
                <div key={row.id} className={`rw-card${i === 0 ? ' rw-latest' : ''}`}>
                  <div className="rw-icon">
                    {i === 0
                      ? <span className="rw-new-badge">NEW</span>
                      : <span className="rw-weigh-icon">⚖️</span>}
                  </div>
                  <div className="rw-boat">
                    <div className="rw-boat-num">{row.boatNo || '—'}</div>
                    <div className="rw-boat-lbl">Boat #</div>
                  </div>
                  <div className="rw-names">
                    <span className="rw-boater">{[row.boaterFirst, row.boaterLast, row.boaterSuffix].filter(Boolean).join(' ') || '—'}</span>
                    {coName && <span className="rw-co">{coName}</span>}
                  </div>
                  <div className="rw-stats">
                    <div className="rw-stat">
                      <div className="rw-stat-val">{row.numFish || 0}</div>
                      <div className="rw-stat-lbl">Fish</div>
                    </div>
                    {lw > 0 && (
                      <div className="rw-stat">
                        <div className="rw-stat-val">{lw.toFixed(2)}</div>
                        <div className="rw-stat-lbl">Lunker</div>
                      </div>
                    )}
                    <div className="rw-stat rw-highlight">
                      <div className="rw-stat-val">
                        {row._isDQ ? 'DQ' : tw > 0 ? `${tw.toFixed(2)} lbs` : '—'}
                      </div>
                      <div className="rw-stat-lbl">
                        Total Wt{row._latePenalty > 0 ? ` (−${row._latePenalty.toFixed(2)} late)` : ''}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="top-n-control no-print" style={{ maxWidth: 900, marginLeft: 'auto', marginRight: 'auto' }}>
        <span style={{ color: 'var(--header-bg)', fontSize: 14 }}>
          Showing top <strong style={{ color: 'var(--gold-light)' }}>{topN}</strong> positions — set in Settings
        </span>
        <button className="btn btn-gold btn-sm" onClick={() => window.print()}>🖨️ Print / PDF</button>
        <button className="btn btn-outline btn-sm" onClick={() => exportHTML(lbEntries, 'Summer Slam Leaderboard')}>📄 Export HTML</button>
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
          const coName = [row.coAnglerFirst, row.coAnglerLast, row.coAnglerSuffix].filter(Boolean).join(' ') || '—';

          const isLunker1 = lunkerRow  && row.id === lunkerRow.id;
          const isLunker2 = lunkerRow2 && row.id === lunkerRow2.id;
          const isOpt1    = option1Row && row.id === option1Row.id;
          const isOpt2    = option2Row && row.id === option2Row.id;
          const hasBadge  = isLunker1 || isLunker2 || isOpt1 || isOpt2;

          const BADGE = { display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 6, padding: '4px 10px', fontSize: 13, fontWeight: 700, letterSpacing: 0.3 };

          return (
            <div key={row.id} className={`lb-card ${cardClass}${idx >= topN ? ' lb-print-only' : ''}`}>
              <div className={`lb-rank ${rankClass}`}>{rankDisplay}</div>
              <div className="lb-boatno">
                <div className="lb-boatno-num">{row.boatNo || '—'}</div>
                <div className="lb-boatno-lbl">Boat #</div>
              </div>
              <div className="lb-anglers">
                <div className="lb-angler-name">
                  {[row.boaterFirst, row.boaterLast, row.boaterSuffix].filter(Boolean).join(' ')}
                  {row.lunker === 1 && <span style={{ marginLeft: 7, fontSize: 10, fontWeight: 800, color: '#ffb450', background: 'rgba(255,180,80,0.22)', border: '1px solid rgba(255,180,80,0.55)', borderRadius: 3, padding: '1px 5px', verticalAlign: 'middle', letterSpacing: 0.3 }}>L</span>}
                  {row.option === 1 && <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 800, color: '#78c8ff', background: 'rgba(120,200,255,0.22)', border: '1px solid rgba(120,200,255,0.55)', borderRadius: 3, padding: '1px 5px', verticalAlign: 'middle', letterSpacing: 0.3 }}>O</span>}
                  {coName !== '—' && <span className="lb-co">, {coName}</span>}
                </div>
                {hasBadge && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {isLunker1 && <span style={{ ...BADGE, background: '#b06000', border: '1px solid #ffb450', color: '#fff' }}>🎯 Lunker</span>}
                    {isLunker2 && <span style={{ ...BADGE, background: '#444', border: '1px solid #aaa', color: '#fff' }}>🎯 Lunker 2nd</span>}
                    {isOpt1    && <span style={{ ...BADGE, background: '#0a5a9e', border: '1px solid #78c8ff', color: '#fff' }}>⚡ Option 1</span>}
                    {isOpt2    && <span style={{ ...BADGE, background: '#1e6e9e', border: '1px solid #a8dcff', color: '#fff' }}>⚡ Option 2</span>}
                  </div>
                )}
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
                {parseFloat(row.rawWeight) > 0 && (
                  <div className="lb-stat-item">
                    <div className="val">{parseFloat(row.rawWeight).toFixed(2)}</div>
                    <div className="lbl">Scale Wt (lbs)</div>
                  </div>
                )}
                <div className="lb-stat-item highlight">
                  <div className="val">{row._isDQ ? 'DQ' : ((row._effectiveWeight ?? parseFloat(row.totalWeight) ?? 0) > 0 ? `${(row._effectiveWeight ?? parseFloat(row.totalWeight)).toFixed(2)} lbs` : '—')}</div>
                  <div className="lbl">Adj. Wt{row._latePenalty > 0 ? ` (−${row._latePenalty.toFixed(2)} late)` : ''}</div>
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
