export function exportHTML(rows, title = 'Summer Slam Results') {
  const headers = ['Place', 'Boater First', 'Boater Last', 'Co-Angler First', 'Co-Angler Last', 'Boat #', 'Lunker (lbs)', '# Fish', 'Total Wt (lbs)'];

  const rowsHtml = rows.map(row => {
    const place = row._lbRank ?? row._rank ?? '';
    const lunker = parseFloat(row.lunkerWeight) > 0 ? parseFloat(row.lunkerWeight).toFixed(2) : '';
    const fish = row.numFish > 0 ? row.numFish : '';
    const weight = parseFloat(row.totalWeight) > 0 ? parseFloat(row.totalWeight).toFixed(2) : '';
    return `<tr>
      <td>${place}</td>
      <td>${row.boaterFirst || ''}</td>
      <td>${row.boaterLast || ''}</td>
      <td>${row.coAnglerFirst || ''}</td>
      <td>${row.coAnglerLast || ''}</td>
      <td>${row.boatNo || ''}</td>
      <td>${lunker}</td>
      <td>${fish}</td>
      <td>${weight}</td>
    </tr>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
    h1 { color: #1a3a5c; margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; }
    th { background: #1a3a5c; color: #fff; padding: 8px 12px; text-align: left; white-space: nowrap; }
    td { padding: 7px 12px; border-bottom: 1px solid #ddd; }
    tr:nth-child(even) td { background: #f5f8fc; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <table>
    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/\s+/g, '_')}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
