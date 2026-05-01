'use strict';

// ── DATA STORE ──────────────────────────────────────────────────────────────
const STORAGE_KEY = 'summerSlam_v2';
let rows = [];
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
      if (parsed.fees) {
        setTimeout(() => {
          if (parsed.fees.entryFee !== undefined) document.getElementById('entryFee').value = parsed.fees.entryFee;
          if (parsed.fees.lunkerFee !== undefined) document.getElementById('lunkerFee').value = parsed.fees.lunkerFee;
          if (parsed.fees.optFee !== undefined) document.getElementById('optFee').value = parsed.fees.optFee;
          updateHeaderStats();
        }, 0);
      }
      if (parsed.theme) applyTheme(parsed.theme);
    }
  } catch (e) { rows = []; }
}

function saveData() {
  const fees = {
    entryFee: document.getElementById('entryFee')?.value ?? '249',
    lunkerFee: document.getElementById('lunkerFee')?.value ?? '20',
    optFee: document.getElementById('optFee')?.value ?? '50'
  };
  const theme = document.body.classList.contains('light') ? 'light' : 'dark';
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ rows, nextId, fees, theme }));
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
  // ✅ Rows with a boater name (money & weight allowed)
  const namedRows = rows.filter(r => r.boaterFirst || r.boaterLast);

  // ✅ Rows eligible for ranking / leaderboard
  const boatRows = namedRows.filter(r => r.boatNo);

  // ✅ TOTAL WEIGHT includes weights even without boat #
  const weights = namedRows.map(r => parseFloat(r.totalWeight) || 0);

  // ✅ LUNKER ONLY for boats with boat #
  const lunkers = boatRows
    .filter(r => r.lunker === 1 && r.lunkerWeight !== '')
    .map(r => parseFloat(r.lunkerWeight) || 0);

  // ✅ BUY‑INS counted by name only
  const buyIns = namedRows.map(r => parseFloat(r.buyIn) || 0);

  const lunkerFee = parseFloat(document.getElementById('lunkerFee')?.value || 0);
  const optFee = parseFloat(document.getElementById('optFee')?.value || 0);

  const lunkerPaidCount = namedRows.filter(r => r.lunker === 1).length;
  const optionPaidCount = namedRows.filter(r => r.option === 1).length;

  return {
    totalBoats: boatRows.length,
    largestBag: weights.length ? Math.max(...weights).toFixed(2) : '0.00',
    lunkerToBeat: lunkers.length ? Math.max(...lunkers).toFixed(2) : '0.00',
    totalWeight: weights.reduce((a, b) => a + b, 0).toFixed(2),
    totalBuyIn: buyIns.reduce((a, b) => a + b, 0).toFixed(2),

    totalApps: namedRows.filter(r => r.appSigned).length,
    lunkerPot: (lunkerPaidCount * lunkerFee).toFixed(2),
    optionPot: (optionPaidCount * optFee).toFixed(2),
    lunkerPaidCount,
    optionPaidCount
  };
}
