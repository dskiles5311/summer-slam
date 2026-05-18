function pieSlicePath(cx, cy, r, startAngle, endAngle) {
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx},${cy} L ${x1.toFixed(2)},${y1.toFixed(2)} A ${r},${r} 0 ${largeArc},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
}

function buildPieSvg(slices) {
  const total = slices.reduce((s, sl) => s + sl.count, 0);
  if (total === 0) return '<p style="color:#999;font-size:12px;margin:8px 0">No registration data</p>';

  const cx = 100, cy = 100, r = 85;
  let angle = -Math.PI / 2;

  const paths = slices.filter(sl => sl.count > 0).map(sl => {
    const sweep = (sl.count / total) * 2 * Math.PI;
    const path = pieSlicePath(cx, cy, r, angle, angle + sweep);
    angle += sweep;
    return `<path d="${path}" fill="${sl.fill}" stroke="#fff" stroke-width="2"/>`;
  }).join('');

  const legendItems = slices.filter(sl => sl.count > 0).map((sl, i) => {
    const pct = ((sl.count / total) * 100).toFixed(1);
    return `<g transform="translate(0,${i * 22})">
      <rect width="14" height="14" fill="${sl.fill}" stroke="#333" stroke-width="0.5"/>
      <text x="20" y="11" font-size="11" fill="#000">${sl.label}: ${sl.count} (${pct}%)</text>
    </g>`;
  }).join('');

  return `<svg width="460" height="210" viewBox="0 0 460 210" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="#000" stroke-width="2.5"/>
      </pattern>
    </defs>
    ${paths}
    <g transform="translate(215,70)">${legendItems}</g>
  </svg>`;
}

function buildBarSvg(rows) {
  if (!rows.length) return '';
  const maxW = Math.max(...rows.map(r => parseFloat(r._effectiveWeight ?? r.totalWeight) || 0));
  if (maxW === 0) return '';

  const barH = 18, gap = 5, leftPad = 68, rightPad = 50, svgW = 520;
  const svgH = rows.length * (barH + gap) + 16;
  const barArea = svgW - leftPad - rightPad;

  const bars = rows.map((r, i) => {
    const wt = r._isDQ ? 0 : (parseFloat(r._effectiveWeight ?? r.totalWeight) || 0);
    const rawWt = parseFloat(r.totalWeight) || 0;
    const barW = maxW > 0 ? (wt / maxW) * barArea : 0;
    const y = i * (barH + gap) + 8;
    const label = r.boatNo ? `Boat #${r.boatNo}` : [r.boaterFirst, r.boaterLast].filter(Boolean).join(' ').slice(0, 10);
    const valLabel = r._isDQ ? 'DQ' : rawWt !== wt ? `${wt.toFixed(2)} (pen)` : `${wt.toFixed(2)}`;
    return `
      <text x="${leftPad - 4}" y="${y + barH * 0.72}" text-anchor="end" font-size="10" fill="#000">${label}</text>
      <rect x="${leftPad}" y="${y}" width="${barW.toFixed(1)}" height="${barH}" fill="${r._isDQ ? '#ccc' : '#000'}"/>
      <text x="${leftPad + barW + 4}" y="${y + barH * 0.72}" font-size="9" fill="#444">${valLabel}</text>
    `;
  }).join('');

  return `<svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}

function isOn(v) { return v === 1 || v === '1'; }

export function exportRosterPdf(entries, settings) {
  const year   = new Date().getFullYear();
  const now    = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const registered   = entries.filter(e => isOn(e.paid) && isOn(e.appSigned));
  const paidUnsigned = entries.filter(e => isOn(e.paid) && !isOn(e.appSigned));
  const unpaid       = entries.filter(e => !isOn(e.paid));
  const checkedIn    = entries.filter(e => e.boatNo);
  const weighed      = entries.filter(e => e.boatNo && parseFloat(e.totalWeight) > 0);
  const hasWeightData = weighed.length > 0;

  let individuals = 0;
  registered.forEach(e => {
    if (e.boaterFirst || e.boaterLast) individuals++;
    if (e.coAnglerFirst || e.coAnglerLast) individuals++;
  });

  const lunkerPot = entries.filter(e => isOn(e.lunker)).length * (parseFloat(settings.fees?.lunkerFee) || 0);
  const optionPot = entries.filter(e => isOn(e.option)).length  * (parseFloat(settings.fees?.optFee) || 0);

  const totalWeight = weighed.reduce((s, e) => s + (parseFloat(e.totalWeight) || 0), 0);
  const totalFish   = weighed.reduce((s, e) => s + (parseInt(e.numFish) || 0), 0);

  const rosterRows = [...registered].sort((a, b) => {
    const an = parseInt(a.boatNo) || Infinity;
    const bn = parseInt(b.boatNo) || Infinity;
    if (an !== bn) return an - bn;
    return (a.boaterLast || '').localeCompare(b.boaterLast || '');
  });

  const standings = [...entries]
    .filter(e => parseFloat(e.totalWeight) > 0)
    .sort((a, b) => {
      const aw = a._isDQ ? -1 : (a._effectiveWeight ?? parseFloat(a.totalWeight) ?? 0);
      const bw = b._isDQ ? -1 : (b._effectiveWeight ?? parseFloat(b.totalWeight) ?? 0);
      return bw - aw;
    })
    .slice(0, 20);

  const pieSvg = buildPieSvg([
    { label: 'Registered (Paid + Signed)', count: registered.length,   fill: '#000' },
    { label: 'Paid / Not Yet Signed',      count: paidUnsigned.length, fill: 'url(#hatch)' },
    { label: 'Not Paid',                   count: unpaid.length,       fill: '#ddd' },
  ]);

  const barSvg = hasWeightData ? buildBarSvg(standings.slice(0, 15)) : '';

  const rosterTableRows = rosterRows.map((e, i) => {
    const boater = [e.boaterFirst, e.boaterLast].filter(Boolean).join(' ') || '—';
    const co     = [e.coAnglerFirst, e.coAnglerLast].filter(Boolean).join(' ') || '—';
    const bg     = i % 2 === 1 ? 'background:#f5f5f5;' : '';
    return `<tr>
      <td style="${bg}text-align:center">${i + 1}</td>
      <td style="${bg}font-weight:bold;text-align:center">${e.boatNo || '—'}</td>
      <td style="${bg}">${boater}</td>
      <td style="${bg}">${co}</td>
      <td style="${bg}text-align:center">${e.boatNo ? 'Yes' : '—'}</td>
    </tr>`;
  }).join('');

  const standingsTableRows = standings.map((e, i) => {
    const ew     = e._isDQ ? 'DQ' : (e._effectiveWeight ?? parseFloat(e.totalWeight) ?? 0).toFixed(2);
    const boater = [e.boaterFirst, e.boaterLast].filter(Boolean).join(' ') || '—';
    const co     = [e.coAnglerFirst, e.coAnglerLast].filter(Boolean).join(' ');
    const names  = co ? `${boater} / ${co}` : boater;
    const pen    = e._latePenalty > 0 ? ` (−${e._latePenalty.toFixed(2)} late)` : '';
    const bg     = i % 2 === 1 ? 'background:#f5f5f5;' : '';
    return `<tr>
      <td style="${bg}font-weight:bold;text-align:center">${i + 1}</td>
      <td style="${bg}font-weight:bold;text-align:center">${e.boatNo || '—'}</td>
      <td style="${bg}">${names}</td>
      <td style="${bg}text-align:center">${e.numFish || 0}</td>
      <td style="${bg}text-align:center">${parseFloat(e.lunkerWeight) > 0 ? parseFloat(e.lunkerWeight).toFixed(2) : '—'}</td>
      <td style="${bg}text-align:center${e._isDQ ? ';color:#999' : ''}">${ew}${pen}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${year} Summer Slam Tournament Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; font-size: 12px; }
  .page { padding: 40px; max-width: 860px; margin: 0 auto; }
  h1 { font-size: 26px; text-align: center; letter-spacing: 1px; font-weight: 900; }
  .subtitle { font-size: 11px; text-align: center; color: #555; margin-top: 4px; letter-spacing: 2px; text-transform: uppercase; }
  .dateline { font-size: 10px; text-align: center; color: #888; margin-top: 6px; }
  .divider { border: none; border-top: 2px solid #000; margin: 16px 0 20px; }
  h3 { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #000; padding-bottom: 4px; margin: 24px 0 12px; }
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 4px; }
  .stat-box { border: 1px solid #000; padding: 10px 8px; text-align: center; }
  .stat-val { font-size: 22px; font-weight: bold; line-height: 1.2; }
  .stat-lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #000; color: #fff; padding: 6px 8px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 5px 8px; border-bottom: 1px solid #e8e8e8; }
  .footer { margin-top: 32px; border-top: 1px solid #ccc; padding-top: 10px; font-size: 9px; color: #888; text-align: center; }
  @media print {
    @page { margin: 0.75in; size: letter portrait; }
    h3 { margin-top: 16px; }
    .page { padding: 0; }
  }
</style>
</head>
<body>
<div class="page">

  <h1>${year} Summer Slam!</h1>
  <div class="subtitle">Susquehanna Fishing Tackle · Tournament Report</div>
  <div class="dateline">Generated ${dateStr}</div>
  <hr class="divider">

  <h3>Tournament Summary</h3>
  <div class="stats-grid">
    <div class="stat-box"><div class="stat-val">${entries.length}</div><div class="stat-lbl">Total Entries</div></div>
    <div class="stat-box"><div class="stat-val">${registered.length}</div><div class="stat-lbl">Registered Teams</div></div>
    <div class="stat-box"><div class="stat-val">${individuals}</div><div class="stat-lbl">Individuals</div></div>
    <div class="stat-box"><div class="stat-val">${checkedIn.length}</div><div class="stat-lbl">Checked In</div></div>
    ${hasWeightData ? `<div class="stat-box"><div class="stat-val">${weighed.length}</div><div class="stat-lbl">Boats Weighed</div></div>
    <div class="stat-box"><div class="stat-val">${totalWeight.toFixed(2)}</div><div class="stat-lbl">Total Weight (lbs)</div></div>
    <div class="stat-box"><div class="stat-val">${totalFish}</div><div class="stat-lbl">Total Fish</div></div>` : ''}
    <div class="stat-box"><div class="stat-val">$${lunkerPot.toLocaleString()}</div><div class="stat-lbl">Lunker Pot</div></div>
    <div class="stat-box"><div class="stat-val">$${optionPot.toLocaleString()}</div><div class="stat-lbl">Option Pot</div></div>
  </div>

  <h3>Registration Breakdown</h3>
  ${pieSvg}

  ${hasWeightData ? `
  <h3>Weight Distribution — Top ${Math.min(15, standings.length)} Boats</h3>
  ${barSvg}
  ` : ''}

  <h3>Registered Teams (${rosterRows.length})</h3>
  <table>
    <thead>
      <tr>
        <th style="width:30px;text-align:center">#</th>
        <th style="width:60px;text-align:center">Boat #</th>
        <th>Boater</th>
        <th>Co-Angler</th>
        <th style="width:70px;text-align:center">Checked In</th>
      </tr>
    </thead>
    <tbody>${rosterTableRows}</tbody>
  </table>

  ${hasWeightData ? `
  <h3 style="margin-top:28px">Final Standings</h3>
  <table>
    <thead>
      <tr>
        <th style="width:30px;text-align:center">Pos</th>
        <th style="width:60px;text-align:center">Boat #</th>
        <th>Boater / Co-Angler</th>
        <th style="width:40px;text-align:center">Fish</th>
        <th style="width:70px;text-align:center">Lunker (lbs)</th>
        <th style="width:90px;text-align:center">Total Wt (lbs)</th>
      </tr>
    </thead>
    <tbody>${standingsTableRows}</tbody>
  </table>
  ` : ''}

  <div class="footer">
    ${year} Summer Slam · Susquehanna Fishing Tackle · Printed ${now.toLocaleString()}
  </div>

</div>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 600);
}
