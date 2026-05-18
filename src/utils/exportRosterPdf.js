function isOn(v) { return v === 1 || v === '1'; }

function pieSlicePath(cx, cy, r, a0, a1) {
  const x1 = cx + r * Math.cos(a0), y1 = cy + r * Math.sin(a0);
  const x2 = cx + r * Math.cos(a1), y2 = cy + r * Math.sin(a1);
  return `M ${cx},${cy} L ${x1.toFixed(1)},${y1.toFixed(1)} A ${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`;
}

// Solid fills only — no url() patterns, reliable in all print contexts
const PIE_FILLS = ['#111', '#777', '#ccc'];

function buildPieSvg(slices) {
  const total = slices.reduce((s, sl) => s + sl.count, 0);
  if (total === 0) return '';
  const W = 560, H = 240, cx = 120, cy = 120, r = 105;
  let angle = -Math.PI / 2;
  const paths = slices.filter(sl => sl.count > 0).map((sl, i) => {
    const sweep = (sl.count / total) * 2 * Math.PI;
    const d = pieSlicePath(cx, cy, r, angle, angle + sweep);
    angle += sweep;
    return `<path d="${d}" fill="${PIE_FILLS[i]}" stroke="#fff" stroke-width="2.5"/>`;
  }).join('');

  const legendY = 60;
  const legend = slices.map((sl, i) => {
    const pct = total > 0 ? ((sl.count / total) * 100).toFixed(1) : '0.0';
    return `<g transform="translate(0,${i * 30})">
      <rect x="0" y="0" width="16" height="16" fill="${PIE_FILLS[i]}" stroke="#000" stroke-width="0.5"/>
      <text x="24" y="12" font-family="Arial,sans-serif" font-size="12" fill="#000" font-weight="bold">${sl.count}</text>
      <text x="24" y="26" font-family="Arial,sans-serif" font-size="10" fill="#555">${sl.label} (${pct}%)</text>
    </g>`;
  }).join('');

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="display:block;max-width:100%">
    ${paths}
    <g transform="translate(268,${legendY})">${legend}</g>
  </svg>`;
}

function buildBarSvg(rows) {
  if (!rows.length) return '';
  const vals = rows.map(r => r._isDQ ? 0 : (parseFloat(r._effectiveWeight ?? r.totalWeight) || 0));
  const maxW = Math.max(...vals, 0.01);
  const W = 680, leftPad = 90, rightPad = 60, barH = 20, gap = 6;
  const H = rows.length * (barH + gap) + 20;
  const barArea = W - leftPad - rightPad;

  const bars = rows.map((r, i) => {
    const wt = vals[i];
    const bw = (wt / maxW) * barArea;
    const y  = i * (barH + gap) + 10;
    const lbl = r.boatNo ? `Boat #${r.boatNo}` : ([r.boaterFirst, r.boaterLast].filter(Boolean).join(' ').slice(0, 12) || '—');
    const val = r._isDQ ? 'DQ' : `${wt.toFixed(2)} lbs`;
    return `
      <text x="${leftPad - 6}" y="${y + barH * 0.72}" text-anchor="end" font-family="Arial,sans-serif" font-size="10" fill="#000">${lbl}</text>
      <rect x="${leftPad}" y="${y}" width="${Math.max(bw, 1).toFixed(1)}" height="${barH}" fill="${r._isDQ ? '#bbb' : '#222'}"/>
      <text x="${leftPad + bw + 5}" y="${y + barH * 0.72}" font-family="Arial,sans-serif" font-size="10" fill="#444">${val}</text>`;
  }).join('');

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="display:block;max-width:100%;margin-top:6px">
    ${bars}
  </svg>`;
}

function statCell(val, lbl) {
  return `<td style="border:1px solid #999;text-align:center;padding:10px 8px;background:#fff">
    <div style="font-size:22px;font-weight:900;line-height:1.1">${val}</div>
    <div style="font-size:8px;text-transform:uppercase;letter-spacing:0.7px;color:#666;margin-top:3px">${lbl}</div>
  </td>`;
}

function sectionHead(title) {
  return `<div style="background:#111;color:#fff;padding:6px 12px;font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;margin:22px 0 10px">${title}</div>`;
}

export function exportRosterPdf(entries, settings) {
  const year    = new Date().getFullYear();
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const registered    = entries.filter(e => isOn(e.paid) && isOn(e.appSigned));
  const paidUnsigned  = entries.filter(e => isOn(e.paid) && !isOn(e.appSigned));
  const unpaid        = entries.filter(e => !isOn(e.paid));
  const checkedIn     = entries.filter(e => e.boatNo);
  const weighed       = entries.filter(e => e.boatNo && parseFloat(e.totalWeight) > 0);
  const hasWeightData = weighed.length > 0;

  let individuals = 0;
  registered.forEach(e => {
    if (e.boaterFirst || e.boaterLast) individuals++;
    if (e.coAnglerFirst || e.coAnglerLast) individuals++;
  });

  const lunkerPot   = entries.filter(e => isOn(e.lunker)).length * (parseFloat(settings.fees?.lunkerFee) || 0);
  const optionPot   = entries.filter(e => isOn(e.option)).length  * (parseFloat(settings.fees?.optFee)   || 0);
  const totalWeight = weighed.reduce((s, e) => s + (parseFloat(e.totalWeight) || 0), 0);
  const totalFish   = weighed.reduce((s, e) => s + (parseInt(e.numFish)       || 0), 0);

  const rosterRows = [...registered].sort((a, b) => {
    const an = parseInt(a.boatNo) || Infinity, bn = parseInt(b.boatNo) || Infinity;
    return an !== bn ? an - bn : (a.boaterLast || '').localeCompare(b.boaterLast || '');
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
    { label: 'Registered (Paid + Signed)', count: registered.length   },
    { label: 'Paid / Not Yet Signed',      count: paidUnsigned.length },
    { label: 'Not Paid',                   count: unpaid.length       },
  ]);

  const barSvg = hasWeightData ? buildBarSvg(standings.slice(0, 15)) : '';

  // Stats cells
  const preStats = [
    statCell(entries.length,      'Total Entries'),
    statCell(registered.length,   'Registered Teams'),
    statCell(individuals,         'Individuals'),
    statCell(checkedIn.length,    'Checked In'),
    statCell(`$${lunkerPot.toLocaleString()}`, 'Lunker Pot'),
    statCell(`$${optionPot.toLocaleString()}`, 'Option Pot'),
  ];
  const postStats = hasWeightData ? [
    statCell(weighed.length,          'Boats Weighed'),
    statCell(totalWeight.toFixed(2),  'Total Weight (lbs)'),
    statCell(totalFish,               'Total Fish'),
  ] : [];
  const allStats = [...preStats, ...postStats];
  const cols = 4;
  const statRows = [];
  for (let i = 0; i < allStats.length; i += cols) {
    const chunk = allStats.slice(i, i + cols);
    while (chunk.length < cols) chunk.push('<td style="border:1px solid #eee;background:#fafafa"></td>');
    statRows.push(`<tr>${chunk.join('')}</tr>`);
  }

  // Roster table rows
  const TH = `style="background:#111;color:#fff;padding:7px 8px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;font-weight:bold"`;
  const THC = `style="background:#111;color:#fff;padding:7px 8px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;font-weight:bold"`;

  const rosterTableRows = rosterRows.map((e, i) => {
    const boater = [e.boaterFirst, e.boaterLast].filter(Boolean).join(' ') || '—';
    const co     = [e.coAnglerFirst, e.coAnglerLast].filter(Boolean).join(' ') || '—';
    const bg     = i % 2 === 1 ? '#f7f7f7' : '#fff';
    return `<tr>
      <td style="background:${bg};text-align:center;padding:5px 8px;color:#777;font-size:10px">${i + 1}</td>
      <td style="background:${bg};text-align:center;padding:5px 8px;font-weight:bold">${e.boatNo || '—'}</td>
      <td style="background:${bg};padding:5px 8px">${boater}</td>
      <td style="background:${bg};padding:5px 8px;color:#555">${co}</td>
      <td style="background:${bg};text-align:center;padding:5px 8px;color:${e.boatNo ? '#222' : '#aaa'}">${e.boatNo ? '✓' : '—'}</td>
    </tr>`;
  }).join('');

  const standingsTableRows = standings.map((e, i) => {
    const ew     = e._isDQ ? 'DQ' : (e._effectiveWeight ?? parseFloat(e.totalWeight) ?? 0).toFixed(2);
    const boater = [e.boaterFirst, e.boaterLast].filter(Boolean).join(' ') || '—';
    const co     = [e.coAnglerFirst, e.coAnglerLast].filter(Boolean).join(' ');
    const names  = co ? `${boater} / ${co}` : boater;
    const pen    = e._latePenalty > 0 ? ` <span style="font-size:9px;color:#888">(−${e._latePenalty.toFixed(2)} late)</span>` : '';
    const bg     = i % 2 === 1 ? '#f7f7f7' : '#fff';
    const medal  = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
    return `<tr>
      <td style="background:${bg};text-align:center;padding:5px 8px;font-weight:bold;font-size:${i < 3 ? 14 : 11}px">${medal}</td>
      <td style="background:${bg};text-align:center;padding:5px 8px;font-weight:bold">${e.boatNo || '—'}</td>
      <td style="background:${bg};padding:5px 8px">${names}</td>
      <td style="background:${bg};text-align:center;padding:5px 8px">${e.numFish || 0}</td>
      <td style="background:${bg};text-align:center;padding:5px 8px">${parseFloat(e.lunkerWeight) > 0 ? parseFloat(e.lunkerWeight).toFixed(2) : '—'}</td>
      <td style="background:${bg};text-align:center;padding:5px 8px;font-weight:bold${e._isDQ ? ';color:#aaa' : ''}">${ew}${pen}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${year} Summer Slam — Tournament Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; font-size: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { max-width: 780px; margin: 0 auto; padding: 40px; }
  table { border-collapse: collapse; }
  @media print {
    @page { margin: 0.65in; size: letter portrait; }
    .page { padding: 0; max-width: 100%; }
  }
</style>
</head>
<body><div class="page">

  <!-- Header -->
  <div style="text-align:center;padding-bottom:18px;border-bottom:3px solid #000;margin-bottom:20px">
    <div style="font-size:32px;font-weight:900;letter-spacing:3px;line-height:1">${year} SUMMER SLAM!</div>
    <div style="font-size:11px;color:#444;letter-spacing:3px;text-transform:uppercase;margin-top:6px">Susquehanna Fishing Tackle · Tournament Report</div>
    <div style="font-size:10px;color:#888;margin-top:5px">${dateStr}</div>
  </div>

  <!-- Summary Stats -->
  ${sectionHead('Tournament Summary')}
  <table style="width:100%;border-collapse:collapse">
    ${statRows.join('')}
  </table>

  <!-- Registration Breakdown -->
  ${sectionHead('Registration Breakdown')}
  ${pieSvg}

  <!-- Weight Distribution -->
  ${hasWeightData ? sectionHead(`Weight Distribution — Top ${Math.min(15, standings.length)} Boats`) + barSvg : ''}

  <!-- Roster -->
  ${sectionHead(`Registered Teams — ${rosterRows.length}`)}
  <table style="width:100%;border-collapse:collapse;font-size:11px">
    <thead><tr>
      <th ${THC} style="background:#111;color:#fff;padding:7px 8px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;font-weight:bold;width:36px">#</th>
      <th ${THC} style="background:#111;color:#fff;padding:7px 8px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;font-weight:bold;width:64px">Boat #</th>
      <th ${TH}>Boater</th>
      <th ${TH}>Co-Angler</th>
      <th ${THC} style="background:#111;color:#fff;padding:7px 8px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;font-weight:bold;width:72px">Checked In</th>
    </tr></thead>
    <tbody>${rosterTableRows}</tbody>
  </table>

  <!-- Standings -->
  ${hasWeightData ? `
  ${sectionHead('Final Standings')}
  <table style="width:100%;border-collapse:collapse;font-size:11px">
    <thead><tr>
      <th ${THC} style="background:#111;color:#fff;padding:7px 8px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;font-weight:bold;width:44px">Pos</th>
      <th ${THC} style="background:#111;color:#fff;padding:7px 8px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;font-weight:bold;width:64px">Boat #</th>
      <th ${TH}>Boater / Co-Angler</th>
      <th ${THC} style="background:#111;color:#fff;padding:7px 8px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;font-weight:bold;width:44px">Fish</th>
      <th ${THC} style="background:#111;color:#fff;padding:7px 8px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;font-weight:bold;width:80px">Lunker (lbs)</th>
      <th ${THC} style="background:#111;color:#fff;padding:7px 8px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;font-weight:bold;width:90px">Total Wt (lbs)</th>
    </tr></thead>
    <tbody>${standingsTableRows}</tbody>
  </table>` : ''}

  <!-- Footer -->
  <div style="margin-top:28px;padding-top:10px;border-top:1px solid #ccc;font-size:9px;color:#999;text-align:center">
    ${year} Summer Slam · Susquehanna Fishing Tackle · Generated ${now.toLocaleString()}
  </div>

</div></body></html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');
  if (win) setTimeout(() => { win.print(); URL.revokeObjectURL(url); }, 800);
}
