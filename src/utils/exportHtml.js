export function exportHTML(rows, title = 'Summer Slam Results', options = {}) {
  const payouts   = options.payouts || [];
  const hasPayouts = payouts.length > 0;
  const year      = new Date().getFullYear();
  const generated = new Date().toLocaleString();

  // Pre-compute payout per row with tie splitting
  const rankCounts = {};
  rows.forEach(r => { const rank = r._lbRank ?? 0; rankCounts[rank] = (rankCounts[rank] || 0) + 1; });

  function payoutForRow(row) {
    if (row._isDQ) return '';
    const rank      = row._lbRank ?? 0;
    const tiedCount = rankCounts[rank] || 1;
    const slice     = payouts.slice(rank - 1, rank - 1 + tiedCount);
    const amt       = tiedCount > 1
      ? Math.round(slice.reduce((s, p) => s + (p || 0), 0) / tiedCount)
      : (payouts[rank - 1] || 0);
    return amt > 0 ? `$${amt.toLocaleString()}` : '';
  }

  const headers = [
    'Place', 'Boat #', 'Boater', 'Co-Angler',
    'Lunker (lbs)', '# Fish', 'Adj. Wt (lbs)',
    ...(hasPayouts ? ['Payout'] : []),
  ];

  const rowsHtml = rows.map((row, i) => {
    const place   = row._isDQ ? `${row._lbRank} DQ` : (row._lbRank ?? '');
    const boater  = [row.boaterFirst, row.boaterLast, row.boaterSuffix].filter(Boolean).join(' ') || '';
    const co      = [row.coAnglerFirst, row.coAnglerLast, row.coAnglerSuffix].filter(Boolean).join(' ') || '';
    const lunker  = parseFloat(row.lunkerWeight) > 0 ? parseFloat(row.lunkerWeight).toFixed(2) : '';
    const fish    = row.numFish > 0 ? row.numFish : '';
    const effWt   = row._isDQ ? 'DQ' : (row._effectiveWeight ?? parseFloat(row.totalWeight) ?? 0);
    const adjWt   = row._isDQ ? 'DQ' : (effWt > 0 ? Number(effWt).toFixed(2) : '');
    const late    = row._latePenalty > 0 ? ` (−${row._latePenalty.toFixed(2)} late)` : '';
    const payout  = payoutForRow(row);
    const bg      = i % 2 === 0 ? '' : ' class="alt"';
    return `<tr${bg}>
      <td>${place}</td>
      <td>${row.boatNo || ''}</td>
      <td>${boater}</td>
      <td>${co}</td>
      <td>${lunker}</td>
      <td>${fish}</td>
      <td>${adjWt}${late}</td>
      ${hasPayouts ? `<td>${payout}</td>` : ''}
    </tr>`;
  }).join('\n');

  const fullTitle = `${year} ${title}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${fullTitle}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
    h1 { color: #1a3a5c; margin-bottom: 4px; }
    .meta { font-size: 12px; color: #888; margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; }
    th { background: #1a3a5c; color: #fff; padding: 8px 12px; text-align: left; white-space: nowrap; }
    td { padding: 7px 12px; border-bottom: 1px solid #ddd; }
    tr.alt td { background: #f5f8fc; }
    td:first-child { font-weight: bold; }
  </style>
</head>
<body>
  <h1>${fullTitle}</h1>
  <div class="meta">Generated ${generated} &nbsp;·&nbsp; Susquehanna Fishing Tackle</div>
  <table>
    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${fullTitle.replace(/\s+/g, '_')}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
