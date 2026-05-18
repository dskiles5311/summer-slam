function isOn(v) { return v === 1 || v === '1'; }

function parseTs(ts) {
  if (!ts) return null;
  const d = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z');
  return isNaN(d) ? null : d;
}

function parseTimeStr(timeStr, refDate) {
  if (!timeStr || !refDate) return null;
  const ampm = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (ampm) {
    let h = parseInt(ampm[1]);
    const m = parseInt(ampm[2]);
    const ap = ampm[3].toUpperCase();
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    const d = new Date(refDate);
    d.setHours(h, m, 0, 0);
    return d;
  }
  const bare = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (bare) {
    const h = parseInt(bare[1]), m = parseInt(bare[2]);
    if (h > 23 || m > 59) return null;
    const d = new Date(refDate);
    d.setHours(h, m, 0, 0);
    return d;
  }
  return null;
}

function fmtTime(ts) {
  const d = parseTs(ts);
  if (!d) return '—';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function fmtDateTime(ts) {
  const d = parseTs(ts);
  if (!d) return '—';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy} ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

function fmtDur(ms) {
  if (!ms || ms < 0 || isNaN(ms)) return '—';
  const totalMins = Math.floor(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function flightFor(entry, flights) {
  const n = parseInt(entry.boatNo);
  if (isNaN(n)) return null;
  return flights.find(f => n >= parseInt(f.boatStart) && (!f.boatEnd || n <= parseInt(f.boatEnd))) || null;
}

function rowName(r) {
  if (!r) return '—';
  const boater = [r.boaterFirst, r.boaterLast].filter(Boolean).join(' ') || '—';
  const co = [r.coAnglerFirst, r.coAnglerLast].filter(Boolean).join(' ');
  return co ? `${boater} / ${co}` : boater;
}

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
  const now           = new Date();
  const tDate         = settings.tournamentDate ? new Date(settings.tournamentDate + 'T12:00:00') : null;
  const year          = tDate ? tDate.getFullYear() : now.getFullYear();
  const tournamentStr = tDate
    ? tDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : null;

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
  const totalBuyIn  = entries.reduce((s, e) => s + (parseFloat(e.buyIn) || 0), 0);
  const totalWeight = weighed.reduce((s, e) => s + (parseFloat(e.totalWeight) || 0), 0);
  const totalFish   = weighed.reduce((s, e) => s + (parseInt(e.numFish)       || 0), 0);

  // --- Side pot winners ---
  const lunkerEligible = entries.filter(e => e.lunker === 1 && e.boatNo && parseFloat(e.lunkerWeight) > 0);
  const lunkerRow1 = lunkerEligible.length
    ? lunkerEligible.reduce((best, r) => parseFloat(r.lunkerWeight) > parseFloat(best.lunkerWeight) ? r : best)
    : null;
  const lunkerRow2 = lunkerEligible.length > 1
    ? lunkerEligible.filter(r => r.id !== lunkerRow1?.id)
        .reduce((best, r) => parseFloat(r.lunkerWeight) > parseFloat(best.lunkerWeight) ? r : best)
    : null;

  const option1Pct  = (settings.fees?.option1Pct ?? 70) / 100;
  const optionEligible = entries
    .filter(e => e.option === 1 && e.paid === 1 && e.appSigned === 1 && parseFloat(e.totalWeight) > 0)
    .sort((a, b) => parseFloat(b.totalWeight) - parseFloat(a.totalWeight));
  const option1Row    = optionEligible[0] || null;
  const option2Row    = optionEligible[1] || null;
  const option1Payout = (optionPot * option1Pct).toFixed(2);
  const option2Payout = (optionPot * (1 - option1Pct)).toFixed(2);

  // --- Timing computations ---
  const flights = (settings.flights || []).slice().sort((a, b) => (parseInt(a.boatStart) || 0) - (parseInt(b.boatStart) || 0));

  // Check-in window
  const ciTimes = entries.map(e => parseTs(e.checkedInAt)).filter(Boolean);
  const ciFirst = ciTimes.length ? new Date(Math.min(...ciTimes)) : null;
  const ciLast  = ciTimes.length ? new Date(Math.max(...ciTimes)) : null;
  const ciWindowMs = ciFirst && ciLast ? ciLast - ciFirst : null;

  // Average weight per boat
  const avgWeight = weighed.length > 0 ? (totalWeight / weighed.length) : null;

  // Time on water per entry: offWaterAt minus that entry's flight launchTime
  // Only include boats that were assigned a number (checked in) and returned off water
  const waterDurations = entries
    .map(e => {
      if (!e.boatNo) return null;
      const offWater = parseTs(e.offWaterAt);
      if (!offWater) return null;
      const flight = flightFor(e, flights);
      if (!flight?.launchTime) return null;
      const launch = parseTimeStr(flight.launchTime, offWater);
      if (!launch) return null;
      const ms = offWater - launch;
      return ms > 0 ? ms : null;
    })
    .filter(Boolean);
  const avgWaterMs = waterDurations.length > 0
    ? waterDurations.reduce((s, d) => s + d, 0) / waterDurations.length
    : null;

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
    statCell(`$${totalBuyIn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Total Buy-In'),
    statCell(`$${lunkerPot.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Lunker Pot'),
    statCell(`$${optionPot.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Option Pot'),
    statCell(`$${option1Payout}`, `Option 1 Payout (${Math.round(option1Pct * 100)}%)`),
    statCell(`$${option2Payout}`, `Option 2 Payout (${Math.round((1 - option1Pct) * 100)}%)`),
  ];
  const postStats = hasWeightData ? [
    statCell(weighed.length,          'Boats Weighed'),
    statCell(totalWeight.toFixed(2),  'Total Weight (lbs)'),
    statCell(totalFish,               'Total Fish'),
    statCell(avgWeight != null ? avgWeight.toFixed(2) : '—', 'Avg Weight / Boat (lbs)'),
  ] : [];

  const timingStats = [
    ...(ciFirst && ciLast ? [
      statCell(`${fmtTime(ciFirst.toISOString())} – ${fmtTime(ciLast.toISOString())}`, 'Check-In Window'),
      statCell(fmtDur(ciWindowMs), 'Check-In Duration'),
    ] : []),
    ...(avgWaterMs != null ? [
      statCell(fmtDur(avgWaterMs), `Avg Time on Water (${waterDurations.length} boats)`),
    ] : []),
  ];
  const allStats = [...preStats, ...postStats, ...timingStats];
  const cols = 4;
  const statRows = [];
  for (let i = 0; i < allStats.length; i += cols) {
    const chunk = allStats.slice(i, i + cols);
    while (chunk.length < cols) chunk.push('<td style="border:1px solid #eee;background:#fafafa"></td>');
    statRows.push(`<tr>${chunk.join('')}</tr>`);
  }

  // Activity log rows — all entries with at least one timestamp, sorted by boat #
  const logRows = [...entries]
    .filter(e => e.checkedInAt || e.offWaterAt || e.weighedAt || e.signedUpAt)
    .sort((a, b) => {
      const an = parseInt(a.boatNo) || Infinity;
      const bn = parseInt(b.boatNo) || Infinity;
      return an !== bn ? an - bn : (a.boaterLast || '').localeCompare(b.boaterLast || '');
    });

  let lastFlightRef = undefined;
  let altRow = 0;
  const activityTableRows = logRows.flatMap(e => {
    const boater   = [e.boaterFirst, e.boaterLast].filter(Boolean).join(' ') || '—';
    const flight   = e.boatNo ? flightFor(e, flights) : null;
    const offWater = parseTs(e.offWaterAt);
    const launch   = offWater && flight?.launchTime ? parseTimeStr(flight.launchTime, offWater) : null;
    const waterMs  = offWater && launch ? offWater - launch : null;
    const rows     = [];

    if (flights.length > 0 && flight !== lastFlightRef) {
      lastFlightRef = flight;
      altRow = 0;
      const flightIdx  = flight ? flights.indexOf(flight) : -1;
      const rangeLabel = flight
        ? (flight.boatEnd ? `Boats #${flight.boatStart}–#${flight.boatEnd}` : `Boats #${flight.boatStart}+`)
        : 'No Flight / Unassigned';
      const timeLabel  = flight?.launchTime  ? ` · Launch ${flight.launchTime}`          : '';
      const ciLabel    = flight?.checkInTime ? ` · Check-In by ${flight.checkInTime}` : '';
      const label      = flightIdx >= 0
        ? `Flight ${flightIdx + 1} — ${rangeLabel}${timeLabel}${ciLabel}`
        : rangeLabel;
      rows.push(`<tr><td colspan="7" style="background:#333;color:#fff;padding:5px 10px;font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:1px">${label}</td></tr>`);
    }

    const bg = altRow % 2 === 0 ? '#fff' : '#f7f7f7';
    altRow++;
    rows.push(`<tr>
      <td style="background:${bg};text-align:center;padding:5px 8px;font-weight:bold">${e.boatNo || '—'}</td>
      <td style="background:${bg};padding:5px 8px">${boater}</td>
      <td style="background:${bg};text-align:center;padding:5px 8px;font-size:10px;color:#555">${fmtDateTime(e.signedUpAt)}</td>
      <td style="background:${bg};text-align:center;padding:5px 8px;font-size:10px;color:#555">${fmtTime(e.checkedInAt)}</td>
      <td style="background:${bg};text-align:center;padding:5px 8px;font-size:10px;color:#555">${fmtTime(e.offWaterAt)}</td>
      <td style="background:${bg};text-align:center;padding:5px 8px;font-size:10px;color:#555">${fmtTime(e.weighedAt)}</td>
      <td style="background:${bg};text-align:center;padding:5px 8px;font-size:10px;font-weight:bold">${waterMs != null ? fmtDur(waterMs) : '—'}</td>
    </tr>`);
    return rows;
  }).join('');

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

  const payoutsList = settings.payoutSettings?.payouts || [];
  const rankCounts  = {};
  standings.forEach(e => { const r = e._lbRank ?? 0; rankCounts[r] = (rankCounts[r] || 0) + 1; });

  const standingsTableRows = standings.map((e, i) => {
    const ew     = e._isDQ ? 'DQ' : (e._effectiveWeight ?? parseFloat(e.totalWeight) ?? 0).toFixed(2);
    const boater = [e.boaterFirst, e.boaterLast].filter(Boolean).join(' ') || '—';
    const co     = [e.coAnglerFirst, e.coAnglerLast].filter(Boolean).join(' ');
    const names  = co ? `${boater} / ${co}` : boater;
    const pen    = e._latePenalty > 0 ? ` <span style="font-size:9px;color:#888">(−${e._latePenalty.toFixed(2)} late)</span>` : '';
    const bg     = i % 2 === 1 ? '#f7f7f7' : '#fff';
    const medal  = i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : `${i + 1}`;
    const rank        = e._lbRank ?? (i + 1);
    const tiedCount   = rankCounts[rank] || 1;
    const payoutSlice = payoutsList.slice(rank - 1, rank - 1 + tiedCount);
    const payoutAmt   = tiedCount > 1
      ? Math.round(payoutSlice.reduce((s, p) => s + (p || 0), 0) / tiedCount)
      : (payoutsList[rank - 1] || 0);
    const payoutCell  = e._isDQ || payoutAmt <= 0 ? '—' : `$${payoutAmt.toLocaleString()}`;
    const isL1 = lunkerRow1 && e.id === lunkerRow1.id;
    const isL2 = lunkerRow2 && e.id === lunkerRow2.id;
    const isO1 = option1Row && e.id === option1Row.id;
    const isO2 = option2Row && e.id === option2Row.id;
    const potBadges = [
      isL1 && `<span style="background:#222;color:#fff;font-size:8px;font-weight:bold;padding:1px 5px;border-radius:3px;margin-left:6px">LUNKER</span>`,
      isL2 && `<span style="background:#555;color:#fff;font-size:8px;font-weight:bold;padding:1px 5px;border-radius:3px;margin-left:6px">LUNKER 2ND</span>`,
      isO1 && `<span style="background:#222;color:#fff;font-size:8px;font-weight:bold;padding:1px 5px;border-radius:3px;margin-left:6px">OPTION 1</span>`,
      isO2 && `<span style="background:#555;color:#fff;font-size:8px;font-weight:bold;padding:1px 5px;border-radius:3px;margin-left:6px">OPTION 2</span>`,
    ].filter(Boolean).join('');
    return `<tr>
      <td style="background:${bg};text-align:center;padding:5px 8px;font-weight:bold;font-size:${i < 3 ? 14 : 11}px">${medal}</td>
      <td style="background:${bg};text-align:center;padding:5px 8px;font-weight:bold">${e.boatNo || '—'}</td>
      <td style="background:${bg};padding:5px 8px">${names}${pen}${potBadges}</td>
      <td style="background:${bg};text-align:center;padding:5px 8px">${e.numFish || 0}</td>
      <td style="background:${bg};text-align:center;padding:5px 8px">${parseFloat(e.lunkerWeight) > 0 ? parseFloat(e.lunkerWeight).toFixed(2) : '—'}</td>
      <td style="background:${bg};text-align:center;padding:5px 8px;font-weight:bold${e._isDQ ? ';color:#aaa' : ''}">${ew}</td>
      <td style="background:${bg};text-align:center;padding:5px 8px;font-weight:bold;color:${payoutCell === '—' ? '#aaa' : '#000'}">${payoutCell}</td>
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
    ${tournamentStr ? `<div style="font-size:13px;font-weight:700;margin-top:6px">${tournamentStr}</div>` : ''}
    <div style="font-size:10px;color:#888;margin-top:4px">Generated ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
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
      <th ${THC} style="background:#111;color:#fff;padding:7px 8px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;font-weight:bold;width:80px">Payout</th>
    </tr></thead>
    <tbody>${standingsTableRows}</tbody>
  </table>` : ''}

  <!-- Side Pot Results -->
  ${(lunkerRow1 || option1Row) ? `
  ${sectionHead('Side Pot Results')}
  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:8px">
    <thead><tr>
      <th ${TH} style="width:12%">Pot</th>
      <th ${TH} style="width:9%">Place</th>
      <th ${THC} style="width:9%">Boat #</th>
      <th ${TH}>Boater / Co-Angler</th>
      <th ${THC} style="width:14%">Key Weight</th>
      <th ${THC} style="width:13%">Payout</th>
    </tr></thead>
    <tbody>
      ${lunkerRow1 ? `<tr>
        <td style="background:#fff;padding:6px 8px;font-weight:bold;font-size:10px">Lunker<br><span style="font-size:9px;color:#888;font-weight:normal">$${lunkerPot.toFixed(2)} pot</span></td>
        <td style="background:#fff;padding:6px 8px"><span style="background:#222;color:#fff;font-size:9px;font-weight:bold;padding:2px 7px;border-radius:3px">1ST</span></td>
        <td style="background:#fff;padding:6px 8px;text-align:center;font-weight:bold">${lunkerRow1.boatNo || '—'}</td>
        <td style="background:#fff;padding:6px 8px">${rowName(lunkerRow1)}</td>
        <td style="background:#fff;padding:6px 8px;text-align:center">${parseFloat(lunkerRow1.lunkerWeight).toFixed(2)} lbs</td>
        <td style="background:#fff;padding:6px 8px;text-align:center;font-weight:900;font-size:16px">$${lunkerPot.toFixed(2)}</td>
      </tr>` : ''}
      ${lunkerRow2 ? `<tr>
        <td style="background:#f7f7f7;padding:6px 8px;color:#999;font-size:10px">Lunker</td>
        <td style="background:#f7f7f7;padding:6px 8px"><span style="background:#555;color:#fff;font-size:9px;font-weight:bold;padding:2px 7px;border-radius:3px">2ND</span></td>
        <td style="background:#f7f7f7;padding:6px 8px;text-align:center;font-weight:bold">${lunkerRow2.boatNo || '—'}</td>
        <td style="background:#f7f7f7;padding:6px 8px">${rowName(lunkerRow2)}</td>
        <td style="background:#f7f7f7;padding:6px 8px;text-align:center">${parseFloat(lunkerRow2.lunkerWeight).toFixed(2)} lbs</td>
        <td style="background:#f7f7f7;padding:6px 8px;text-align:center;color:#aaa">—</td>
      </tr>` : ''}
      ${option1Row ? `<tr>
        <td style="background:#fff;padding:6px 8px;font-weight:bold;font-size:10px">Option<br><span style="font-size:9px;color:#888;font-weight:normal">$${optionPot.toFixed(2)} · ${Math.round(option1Pct * 100)}%/${Math.round((1 - option1Pct) * 100)}%</span></td>
        <td style="background:#fff;padding:6px 8px"><span style="background:#222;color:#fff;font-size:9px;font-weight:bold;padding:2px 7px;border-radius:3px">OPT 1</span></td>
        <td style="background:#fff;padding:6px 8px;text-align:center;font-weight:bold">${option1Row.boatNo || '—'}</td>
        <td style="background:#fff;padding:6px 8px">${rowName(option1Row)}</td>
        <td style="background:#fff;padding:6px 8px;text-align:center">${parseFloat(option1Row.totalWeight).toFixed(2)} lbs</td>
        <td style="background:#fff;padding:6px 8px;text-align:center;font-weight:900;font-size:16px">$${option1Payout}</td>
      </tr>` : ''}
      ${option2Row ? `<tr>
        <td style="background:#f7f7f7;padding:6px 8px;color:#999;font-size:10px">Option</td>
        <td style="background:#f7f7f7;padding:6px 8px"><span style="background:#555;color:#fff;font-size:9px;font-weight:bold;padding:2px 7px;border-radius:3px">OPT 2</span></td>
        <td style="background:#f7f7f7;padding:6px 8px;text-align:center;font-weight:bold">${option2Row.boatNo || '—'}</td>
        <td style="background:#f7f7f7;padding:6px 8px">${rowName(option2Row)}</td>
        <td style="background:#f7f7f7;padding:6px 8px;text-align:center">${parseFloat(option2Row.totalWeight).toFixed(2)} lbs</td>
        <td style="background:#f7f7f7;padding:6px 8px;text-align:center;font-weight:900;font-size:16px">$${option2Payout}</td>
      </tr>` : ''}
    </tbody>
  </table>` : ''}

  <!-- Activity Log -->
  ${logRows.length > 0 ? `
  ${sectionHead('Tournament Activity Log')}
  <table style="width:100%;border-collapse:collapse;font-size:10px">
    <thead><tr>
      <th ${THC} style="background:#111;color:#fff;padding:6px 8px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;font-weight:bold;width:60px">Boat #</th>
      <th ${TH} style="width:18%">Boater</th>
      <th ${THC} style="background:#111;color:#fff;padding:6px 8px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;font-weight:bold;width:82px">Signed Up</th>
      <th ${THC} style="background:#111;color:#fff;padding:6px 8px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;font-weight:bold;width:82px">Checked In</th>
      <th ${THC} style="background:#111;color:#fff;padding:6px 8px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;font-weight:bold;width:82px">Off Water</th>
      <th ${THC} style="background:#111;color:#fff;padding:6px 8px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;font-weight:bold;width:82px">Weighed In</th>
      <th ${THC} style="background:#111;color:#fff;padding:6px 8px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.8px;font-weight:bold;width:82px">Time on Water</th>
    </tr></thead>
    <tbody>${activityTableRows}</tbody>
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
