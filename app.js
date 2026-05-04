'use strict';

// ── DATA STORE ──────────────────────────────────────────────────────────────
const STORAGE_KEY = 'summerSlam_v2';
let rows = [];
let payouts = [];   // array of dollar amounts per place, e.g. [4000, 1000, 800, ...]
let nextId = 1;
let currentSort = { field: 'totalWeight', dir: 'desc' };
let editingId = null;

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      rows = parsed.rows || [];
      nextId = parsed.nextId || (rows.length + 1);

      // Restore payouts synchronously so they're available when leaderboard renders
      if (parsed.payoutSettings) {
        const ps = parsed.payoutSettings;
        payouts = ps.payouts || [];
      }

      if (parsed.theme) applyTheme(parsed.theme);

      // Restore DOM inputs after paint
      setTimeout(() => {
        if (parsed.fees) {
          if (parsed.fees.entryFee !== undefined) document.getElementById('entryFee').value = parsed.fees.entryFee;
          if (parsed.fees.lunkerFee !== undefined) document.getElementById('lunkerFee').value = parsed.fees.lunkerFee;
          if (parsed.fees.optFee !== undefined) document.getElementById('optFee').value = parsed.fees.optFee;
          updateHeaderStats();
        }
        if (parsed.payoutSettings) {
          const ps = parsed.payoutSettings;
          if (ps.totalPayout !== undefined) document.getElementById('totalPayout').value = ps.totalPayout;
          if (ps.numWinners !== undefined) document.getElementById('numWinners').value = ps.numWinners;
          renderPayoutRows();
          renderLeaderboard(); // re-render now that payouts are in DOM
        }
      }, 0);
    }
  } catch (e) { rows = []; }
}

function saveData() {
  const fees = {
    entryFee: document.getElementById('entryFee')?.value ?? '249',
    lunkerFee: document.getElementById('lunkerFee')?.value ?? '20',
    optFee: document.getElementById('optFee')?.value ?? '50'
  };
  const payoutSettings = {
    totalPayout: document.getElementById('totalPayout')?.value ?? '0',
    numWinners: document.getElementById('numWinners')?.value ?? '10',
    payouts
  };
  const theme = document.body.classList.contains('light') ? 'light' : 'dark';
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ rows, nextId, fees, payoutSettings, theme }));
}

// ── DEFAULT ROW ──────────────────────────────────────────────────────────────
function newRow(overrides = {}) {
  return {
    id: nextId++,
    boaterFirst: '',
    boaterLast: '',
    coAnglerFirst: '',
    coAnglerLast: '',
    boatNo: '',
    numFish: '',
    lunkerWeight: '',
    totalWeight: '',
    lunker: 0,
    option: 0,
    paid: 0,
    appSigned: 0,
    buyIn: 0,
    ...overrides
  };
}

// ── CALCULATIONS ──────────────────────────────────────────────────────────────
function calcRanks() {
  const sorted = [...rows].sort((a, b) => {
    const wa = parseFloat(a.totalWeight) || 0;
    const wb = parseFloat(b.totalWeight) || 0;
    return wb - wa;
  });
  sorted.forEach((r, i) => {
    const orig = rows.find(x => x.id === r.id);
    if (orig) orig._rank = i + 1;
  });
}

function getStats() {
  //Rows with a boater name (money & weight allowed)
  const namedRows = rows.filter(r => r.boaterFirst || r.boaterLast);

  //Rows eligible for ranking / leaderboard
  const boatRows = namedRows.filter(r => r.boatNo);

  //TOTAL WEIGHT includes weights even without boat #
  const weights = namedRows.map(r => parseFloat(r.totalWeight) || 0);

  //LUNKER ONLY for boats with boat #
  const lunkers = boatRows
    .filter(r => r.lunker === 1 && r.lunkerWeight !== '')
    .map(r => parseFloat(r.lunkerWeight) || 0);

  //BUY‑INS counted by name only
  const buyIns = namedRows.map(r => parseFloat(r.buyIn) || 0);

  const lunkerFee = parseFloat(document.getElementById('lunkerFee')?.value || 0);
  const optFee = parseFloat(document.getElementById('optFee')?.value || 0);

  const lunkerPaidCount = namedRows.filter(r => r.lunker === 1).length;
  const optionPaidCount = namedRows.filter(r => r.option === 1).length;

  // Find the row with the top lunker weight (lunker=yes only)
  const lunkerRows = boatRows.filter(r => r.lunker === 1 && r.lunkerWeight !== '');
  const topLunkerRow = lunkerRows.length
    ? lunkerRows.reduce((best, r) => (parseFloat(r.lunkerWeight) > parseFloat(best.lunkerWeight) ? r : best))
    : null;

  // Find the row with the largest total bag
  const bagRows = namedRows.filter(r => r.totalWeight !== '');
  const topBagRow = bagRows.length
    ? bagRows.reduce((best, r) => (parseFloat(r.totalWeight) > parseFloat(best.totalWeight) ? r : best))
    : null;

  const maxLunker = topLunkerRow ? parseFloat(topLunkerRow.lunkerWeight).toFixed(2) : '0.00';
  const maxBag = topBagRow ? parseFloat(topBagRow.totalWeight).toFixed(2) : '0.00';

  return {
    totalBoats: boatRows.length,
    largestBag: maxBag,
    largestBagRow: topBagRow,
    lunkerToBeat: maxLunker,
    lunkerToBeatRow: topLunkerRow,
    totalWeight: weights.reduce((a, b) => a + b, 0).toFixed(2),
    totalBuyIn: buyIns.reduce((a, b) => a + b, 0).toFixed(2),
    totalApps: namedRows.filter(r => r.appSigned).length,
    lunkerPot: (lunkerPaidCount * lunkerFee).toFixed(2),
    optionPot: (optionPaidCount * optFee).toFixed(2),
    lunkerPaidCount,
    optionPaidCount
  };
}

// ── SORT ──────────────────────────────────────────────────────────────────────
function sortRows(field, dir) {
  currentSort = { field, dir };
  const numericFields = ['totalWeight','lunkerWeight','numFish','boatNo','buyIn','_rank'];
  rows.sort((a, b) => {
    let va = a[field], vb = b[field];
    const isNumeric = numericFields.includes(field);

    // Blank = empty string, null, undefined, or NaN after parse
    const isBlank = v => v === '' || v === null || v === undefined || (isNumeric && isNaN(parseFloat(v)));
    const aBlank = isBlank(va);
    const bBlank = isBlank(vb);
    if (aBlank && bBlank) return 0;
    if (aBlank) return 1;   // always push blanks to bottom
    if (bBlank) return -1;

    if (isNumeric) {
      va = parseFloat(va);
      vb = parseFloat(vb);
    } else {
      va = String(va).toLowerCase();
      vb = String(vb).toLowerCase();
    }
    if (va < vb) return dir === 'asc' ? -1 : 1;
    if (va > vb) return dir === 'asc' ? 1 : -1;
    return 0;
  });
}

// ── RENDER TABLE ──────────────────────────────────────────────────────────────
function renderTable() {
  calcRanks();
  const tbody = document.getElementById('mainTbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  rows.forEach(row => {
    const tr = document.createElement('tr');
    if (editingId === row.id) tr.classList.add('editing');

    const rank = row._rank || '';
    const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';

    // Status cell helper
    const statusCell = (val) => {
      if (val === 1 || val === '1') return `<span class="cell-green">YES</span>`;
      if (val === 0 || val === '0') return `<span class="cell-red">NO</span>`;
      return `<span class="cell-neutral">—</span>`;
    };

    const buyIn = parseFloat(row.buyIn) || 0;
    const buyInClass = buyIn > 0 && buyIn < 249 ? 'cell-red' : buyIn >= 249 ? 'cell-green' : 'cell-neutral';

    tr.innerHTML = `
      <td class="rank-cell ${rankClass}">${rank}</td>
      <td>${escHtml(row.boaterFirst)}</td>
      <td>${escHtml(row.boaterLast)}</td>
      <td>${escHtml(row.coAnglerFirst)}</td>
      <td>${escHtml(row.coAnglerLast)}</td>
      <td>${escHtml(row.boatNo)}</td>
      <td style="text-align:center">${row.numFish !== '' ? row.numFish : '—'}</td>
      <td style="text-align:right;font-weight:600">${row.lunkerWeight !== '' ? parseFloat(row.lunkerWeight).toFixed(2) : '—'}</td>
      <td style="text-align:right;font-weight:700;color:#e8c876">${row.totalWeight !== '' ? parseFloat(row.totalWeight).toFixed(2) : '—'}</td>
      <td style="text-align:center">${statusCell(row.lunker)}</td>
      <td style="text-align:center">${statusCell(row.option)}</td>
      <td style="text-align:center">${statusCell(row.paid)}</td>
      <td style="text-align:center">${statusCell(row.appSigned)}</td>
      <td style="text-align:right"><span class="${buyInClass}">$${buyIn.toFixed(2)}</span></td>
      <td style="text-align:center">
        <button class="btn btn-outline btn-sm" onclick="openEdit(${row.id})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteRow(${row.id})" style="margin-left:4px">Del</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  updateHeaderStats();
  renderLeaderboard();
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── HEADER STATS ──────────────────────────────────────────────────────────────
function updateHeaderStats() {
  const s = getStats();
  document.getElementById('hBoats').textContent = s.totalBoats;
  document.getElementById('hLunker').textContent = s.lunkerToBeat + ' lbs';
  document.getElementById('hBag').textContent = s.largestBag + ' lbs';
  document.getElementById('hPot').textContent = '$' + s.totalBuyIn;
  document.getElementById('hLunkerPot').textContent = '$' + s.lunkerPot;
  document.getElementById('hLunkerCount').textContent = s.lunkerPaidCount + ' paid';
  document.getElementById('hOptionPot').textContent = '$' + s.optionPot;
  document.getElementById('hOptionCount').textContent = s.optionPaidCount + ' paid';
}

// ── LEADERBOARD ──────────────────────────────────────────────────────────────
function renderLeaderboard() {
  const topN = parseInt(document.getElementById('topN')?.value || 10);
  const container = document.getElementById('lbContainer');
  if (!container) return;

  const active = rows
    .filter(r => (r.boaterFirst || r.boaterLast) && r._rank && r.paid === 1 && r.appSigned === 1)
    .sort((a, b) => a._rank - b._rank)
    .map((r, i) => ({ ...r, _lbRank: i + 1 }));
  const top = active.filter(r => r._lbRank <= topN);

  // Stats
  const s = getStats();
  document.getElementById('lbBoats').textContent = s.totalBoats;
  document.getElementById('lbWeight').textContent = s.totalWeight + ' lbs';

  // Lunker to Beat card
  document.getElementById('lbLunker').textContent = s.lunkerToBeat + ' lbs';
  const lr = s.lunkerToBeatRow;
  document.getElementById('lbLunkerName').textContent = lr
    ? `${lr.boaterFirst} ${lr.boaterLast}`.trim() : '—';
  document.getElementById('lbLunkerSub').textContent = lr
    ? `Co: ${lr.coAnglerFirst || ''} ${lr.coAnglerLast || ''}`.trim().replace(/^Co:\s*$/, '') + (lr.boatNo ? ` · Boat #${lr.boatNo}` : '') : '';

  // Largest Bag card
  document.getElementById('lbBag').textContent = s.largestBag + ' lbs';
  const br = s.largestBagRow;
  document.getElementById('lbBagName').textContent = br
    ? `${br.boaterFirst} ${br.boaterLast}`.trim() : '—';
  document.getElementById('lbBagSub').textContent = br
    ? `Co: ${br.coAnglerFirst || ''} ${br.coAnglerLast || ''}`.trim().replace(/^Co:\s*$/, '') + (br.boatNo ? ` · Boat #${br.boatNo}` : '') : '';

  container.innerHTML = '';

  if (top.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--header-bg);padding:40px">No entries yet. Add anglers in the Roster tab.</p>';
    return;
  }

  top.forEach(row => {
    const r = row._lbRank;
    const cardClass = r === 1 ? 'gold-card' : r === 2 ? 'silver-card' : r === 3 ? 'bronze-card' : 'normal-card';
    const rankClass = r === 1 ? 'r1' : r === 2 ? 'r2' : r === 3 ? 'r3' : 'rn';
    const rankDisplay = r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`;

    const payoutAmt = (payouts && payouts[r - 1]) ? payouts[r - 1] : 0;
    const payoutHtml = payoutAmt > 0
      ? `<div class="lb-payout"><div class="val">$${payoutAmt.toLocaleString()}</div><div class="lbl">Payout</div></div>`
      : '<div class="lb-payout"></div>';

    const coName = [row.coAnglerFirst, row.coAnglerLast].filter(Boolean).join(' ') || '—';

    const div = document.createElement('div');
    div.className = `lb-card ${cardClass}`;
    div.innerHTML = `
      <div class="lb-rank ${rankClass}">${rankDisplay}</div>
      <div class="lb-boatno">
        <div class="lb-boatno-num">${escHtml(row.boatNo) || '—'}</div>
        <div class="lb-boatno-lbl">Boat #</div>
      </div>
      <div class="lb-anglers">
        <div class="lb-angler-name">${escHtml(row.boaterFirst)} ${escHtml(row.boaterLast)}</div>
        <div class="lb-angler-name lb-co">${escHtml(coName)}</div>
      </div>
      <div class="lb-stats">
        <div class="lb-stat-item">
          <div class="val">${row.numFish || '—'}</div>
          <div class="lbl">Fish</div>
        </div>
        <div class="lb-stat-item">
          <div class="val">${row.lunkerWeight ? parseFloat(row.lunkerWeight).toFixed(2) : '—'}</div>
          <div class="lbl">Lunker (lbs)</div>
        </div>
        <div class="lb-stat-item highlight">
          <div class="val">${row.totalWeight ? parseFloat(row.totalWeight).toFixed(2) : '—'} lbs</div>
          <div class="lbl">Total Weight</div>
        </div>
      </div>
      ${payoutHtml}
    `;
    container.appendChild(div);
  });
}

// ── EDIT MODAL ────────────────────────────────────────────────────────────────
function openEdit(id) {
  const row = id === 'new' ? newRow() : rows.find(r => r.id === id);
  if (!row) return;
  editingId = id === 'new' ? null : id;

  const fields = ['boaterFirst','boaterLast','coAnglerFirst','coAnglerLast','boatNo','numFish','lunkerWeight','totalWeight','lunker','option','paid','appSigned','buyIn'];
  fields.forEach(f => {
    const el = document.getElementById('ef_' + f);
    if (el) el.value = row[f] ?? '';
  });

  document.getElementById('modalTitle').textContent = id === 'new' ? 'Add Entry' : 'Edit Entry';
  const panel = document.getElementById('editPanel');
  panel.style.display = 'block';
  // Scroll panel into view smoothly on mobile
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  setTimeout(() => document.getElementById('ef_boaterFirst').focus(), 200);
}

function closeEdit() {
  document.getElementById('editPanel').style.display = 'none';
  editingId = null;
}

function saveEdit() {
  const fields = ['boaterFirst','boaterLast','coAnglerFirst','coAnglerLast','boatNo','numFish','lunkerWeight','totalWeight','lunker','option','paid','appSigned','buyIn'];
  const data = {};
  // Status fields: store as integer 0/1 or '' if unset
  const statusFields = ['lunker','option','paid','appSigned'];
  // Float fields: keep '' when blank so sort can detect empty
  const floatFields = ['numFish','lunkerWeight','totalWeight','buyIn'];
  fields.forEach(f => {
    const el = document.getElementById('ef_' + f);
    if (!el) return;
    if (statusFields.includes(f)) {
      data[f] = el.value === '' ? '' : parseInt(el.value);
    } else if (floatFields.includes(f)) {
      data[f] = el.value === '' ? '' : parseFloat(el.value);
    } else {
      data[f] = el.value;
    }
  });

  if (editingId !== null) {
    const idx = rows.findIndex(r => r.id === editingId);
    if (idx >= 0) Object.assign(rows[idx], data);
  } else {
    rows.push({ id: nextId++, ...data });
  }

  saveData();
  closeEdit();
  renderTable();
  showToast('Entry saved!', 'success');
}

// ── DELETE ────────────────────────────────────────────────────────────────────
function deleteRow(id) {
  if (!confirm('Delete this entry?')) return;
  rows = rows.filter(r => r.id !== id);
  saveData();
  renderTable();
  showToast('Entry deleted', 'info');
}

// ── CLEAR ALL ─────────────────────────────────────────────────────────────────
function clearAll() {
  if (!confirm('Clear ALL data? This cannot be undone!')) return;
  rows = [];
  nextId = 1;
  saveData();
  renderTable();
  showToast('All data cleared', 'info');
}

// ── SORT HANDLERS ─────────────────────────────────────────────────────────────
function doSort(field, dir) {
  sortRows(field, dir);
  renderTable();
}

// ── EXPORT ────────────────────────────────────────────────────────────────────
function exportCSV() {
  calcRanks();
  const headers = ['Place','Boater First','Boater Last','Co-Angler First','Co-Angler Last','Boat No','# Fish','Lunker Weight','Total Weight','Lunker','Option','Paid','App Signed','Buy-In'];
  const lines = [headers.join(',')];

  const sorted = [...rows].filter(r => r.boaterFirst || r.boaterLast).sort((a,b) => (a._rank||999) - (b._rank||999));
  sorted.forEach(r => {
    lines.push([
      r._rank || '',
      r.boaterFirst, r.boaterLast,
      r.coAnglerFirst, r.coAnglerLast,
      r.boatNo, r.numFish,
      r.lunkerWeight, r.totalWeight,
      r.lunker, r.option, r.paid, r.appSigned, r.buyIn
    ].map(v => `"${v}"`).join(','));
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'summer-slam-results.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported!', 'success');
}

function printLeaderboard() {
  switchTab('leaderboard');
  setTimeout(() => window.print(), 200);
}

// ── IMPORT CSV ────────────────────────────────────────────────────────────────
function importCSV(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const lines = e.target.result.split('\n').filter(l => l.trim());
    if (lines.length < 2) return;
    const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim().toLowerCase());

    const fieldMap = {
      'boater first': 'boaterFirst', 'boater_first': 'boaterFirst',
      'boater last': 'boaterLast', 'boater_last': 'boaterLast',
      'co-angler first': 'coAnglerFirst', 'co-angler_first': 'coAnglerFirst',
      'co-angler last': 'coAnglerLast', 'co-angler_last': 'coAnglerLast',
      'boat no': 'boatNo', 'boat_no.': 'boatNo', 'boat no.': 'boatNo',
      '# fish': 'numFish', 'number_of_fish': 'numFish', 'num fish': 'numFish',
      'lunker weight': 'lunkerWeight', 'lunker_weight': 'lunkerWeight',
      'total weight': 'totalWeight', 'total_weight': 'totalWeight',
      'lunker': 'lunker', 'option': 'option', 'paid': 'paid',
      'app signed': 'appSigned', 'application_signed': 'appSigned',
      'buy-in': 'buyIn', 'buy in': 'buyIn'
    };

    let added = 0;
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',').map(v => v.replace(/^"|"$/g,'').trim());
      const row = newRow();
      headers.forEach((h, idx) => {
        const field = fieldMap[h];
        if (field && vals[idx] !== undefined) {
          const numFields = ['numFish','lunkerWeight','totalWeight','lunker','option','paid','appSigned','buyIn'];
          row[field] = numFields.includes(field) ? (vals[idx] === '' ? '' : parseFloat(vals[idx]) || 0) : vals[idx];
        }
      });
      if (row.boaterFirst || row.boaterLast) { rows.push(row); added++; }
    }

    saveData();
    renderTable();
    showToast(`Imported ${added} entries`, 'success');
  };
  reader.readAsText(file);
}

// ── TABS ──────────────────────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-' + name)?.classList.add('active');
  document.querySelector(`[data-tab="${name}"]`)?.classList.add('active');
  if (name === 'leaderboard') renderLeaderboard();
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 2500);
}


// ── PAYOUT ────────────────────────────────────────────────────────────────────

// Weighted distribution matching the example pattern:
// Place 1 gets ~38%, 2 gets ~10%, tapering to roughly equal small amounts at bottom
function calcWeightedPayouts(total, n) {
  if (n <= 0 || total <= 0) return [];

  // Generate raw weights: sharply weighted toward 1st place
  const weights = [];
  for (let i = 0; i < n; i++) {
    // Exponential decay: w(i) = 1 / (i + 1)^1.6
    weights.push(1 / Math.pow(i + 1, 1.6));
  }
  const sumW = weights.reduce((a, b) => a + b, 0);

  // Scale to total, round to whole dollars
  let rawAmounts = weights.map(w => Math.round((w / sumW) * total));

  // Fix rounding so sum exactly equals total
  let diff = total - rawAmounts.reduce((a, b) => a + b, 0);
  // Distribute rounding difference starting from 1st place
  let i = 0;
  while (diff !== 0) {
    const step = diff > 0 ? 1 : -1;
    rawAmounts[i % n] += step;
    diff -= step;
    i++;
  }

  return rawAmounts;
}

function recalcPayouts() {
  const total = parseInt(document.getElementById('totalPayout')?.value || 0);
  const n = parseInt(document.getElementById('numWinners')?.value || 0);
  if (total > 0 && n > 0) {
    payouts = calcWeightedPayouts(total, n);
  } else {
    payouts = Array(n).fill(0);
  }
  renderPayoutRows();
  saveData();
  renderLeaderboard();
}

function renderPayoutRows() {
  const container = document.getElementById('payoutRows');
  const summary = document.getElementById('payoutSummary');
  if (!container) return;

  const n = parseInt(document.getElementById('numWinners')?.value || 0);

  // Pad or trim payouts array to match n
  while (payouts.length < n) payouts.push(0);
  payouts = payouts.slice(0, n);

  let html = `<table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead>
      <tr>
        <th style="text-align:left;padding:6px 8px;color:var(--header-bg);font-weight:700;font-size:11px;text-transform:uppercase;border-bottom:1px solid rgba(139,180,225,0.2);width:60px">Place</th>
        <th style="text-align:right;padding:6px 8px;color:var(--header-bg);font-weight:700;font-size:11px;text-transform:uppercase;border-bottom:1px solid rgba(139,180,225,0.2)">Payout</th>
        <th style="text-align:right;padding:6px 8px;color:var(--header-bg);font-weight:700;font-size:11px;text-transform:uppercase;border-bottom:1px solid rgba(139,180,225,0.2);width:60px">%</th>
      </tr>
    </thead>
    <tbody>`;

  const total = parseInt(document.getElementById('totalPayout')?.value || 0);

  payouts.forEach((amt, i) => {
    const pct = total > 0 ? ((amt / total) * 100).toFixed(1) : '0.0';
    const placeLabel = i === 0 ? '🥇 1st' : i === 1 ? '🥈 2nd' : i === 2 ? '🥉 3rd' : `${i+1}th`;
    html += `<tr style="border-bottom:1px solid rgba(139,180,225,0.08)">
      <td style="padding:5px 8px;color:var(--header-bg);font-weight:600">${placeLabel}</td>
      <td style="padding:5px 8px;text-align:right">
        <span style="color:var(--white)">$</span>
        <input type="number"
          value="${amt}"
          min="0"
          step="1"
          inputmode="numeric"
          data-place="${i}"
          onchange="updatePayoutRow(${i}, this.value)"
          style="width:90px;padding:4px 6px;background:rgba(255,255,255,0.08);border:1px solid rgba(139,180,225,0.3);border-radius:5px;color:var(--white);font-size:13px;text-align:right;font-weight:600" />
      </td>
      <td style="padding:5px 8px;text-align:right;color:var(--header-bg);font-size:12px">${pct}%</td>
    </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;

  // Summary
  const rowTotal = payouts.reduce((a, b) => a + b, 0);
  const diff = total - rowTotal;
  const diffColor = diff === 0 ? '#4CAF50' : diff > 0 ? '#ffb450' : '#ff6b6b';
  const diffLabel = diff === 0 ? '✔ Balanced' : diff > 0 ? `$${diff} unallocated` : `$${Math.abs(diff)} over budget`;
  if (summary) {
    summary.innerHTML = `<span style="color:var(--header-bg)">Total allocated:</span>
      <strong style="color:var(--white)"> $${rowTotal.toLocaleString()}</strong>
      &nbsp;&nbsp;
      <span style="color:${diffColor};font-weight:600">${diffLabel}</span>`;
  }
}

function updatePayoutRow(place, value) {
  payouts[place] = parseInt(value) || 0;
  renderPayoutRows();
  saveData();
  renderLeaderboard();
}

function clearPayouts() {
  payouts = [];
  document.getElementById('totalPayout').value = 0;
  document.getElementById('numWinners').value = 10;
  renderPayoutRows();
  saveData();
  renderLeaderboard();
}

// ── THEME ────────────────────────────────────────────────────────────────────
function applyTheme(theme) {
  if (theme === 'light') {
    document.body.classList.add('light');
    const btn = document.getElementById('themeToggle');
    if (btn) btn.innerHTML = '🌙 Dark Mode';
    const btn2 = document.getElementById('themeToggleSettings');
    if (btn2) btn2.innerHTML = '🌙 Switch to Dark Mode';
  } else {
    document.body.classList.remove('light');
    const btn = document.getElementById('themeToggle');
    if (btn) btn.innerHTML = '☀️ Light Mode';
    const btn2 = document.getElementById('themeToggleSettings');
    if (btn2) btn2.innerHTML = '☀️ Switch to Light Mode';
  }
}

function toggleTheme() {
  const isLight = document.body.classList.contains('light');
  applyTheme(isLight ? 'dark' : 'light');
  saveData();
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  sortRows('totalWeight', 'desc');
  renderTable();

  // Tab navigation
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Leaderboard top-N
  document.getElementById('topN')?.addEventListener('input', renderLeaderboard);

  // File import
  document.getElementById('csvImport')?.addEventListener('change', e => {
    if (e.target.files[0]) importCSV(e.target.files[0]);
    e.target.value = '';
  });

  // Keyboard shortcut
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeEdit();
    if (e.key === 'Enter' && document.getElementById('editModal').classList.contains('show')) saveEdit();
  });

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
});

// ── EXPOSE TO HTML ────────────────────────────────────────────────────────────
window.saveData = saveData;
window.openEdit = openEdit;
window.closeEdit = closeEdit;
window.saveEdit = saveEdit;
window.deleteRow = deleteRow;
window.clearAll = clearAll;
window.doSort = doSort;
window.exportCSV = exportCSV;
window.printLeaderboard = printLeaderboard;
window.switchTab = switchTab;
window.toggleTheme = toggleTheme;
window.recalcPayouts = recalcPayouts;
window.updatePayoutRow = updatePayoutRow;
window.clearPayouts = clearPayouts;