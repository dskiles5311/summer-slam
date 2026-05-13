function parseFlightTime(timeStr, referenceDate) {
  if (!timeStr) return null;
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const ap = match[3].toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  const d = new Date(referenceDate);
  d.setHours(h, m, 0, 0);
  return d;
}

export function calcRanks(entries, settings) {
  const flights       = settings?.flights || [];
  const latePenPerMin = parseFloat(settings?.penalties?.latePenaltyPerMin ?? 1.0);
  const lateDQMin     = parseInt(settings?.penalties?.latePenaltyDQMin    ?? 15);

  const withPenalties = entries.map(entry => {
    const base = parseFloat(entry.totalWeight) || 0;
    const noLate = { ...entry, _latePenalty: 0, _isDQ: false, _minsLate: 0, _effectiveWeight: base };

    if (!entry.weighedAt || !entry.boatNo || !flights.length) return noLate;

    const boatNum = parseInt(entry.boatNo);
    const flight  = flights.find(f => boatNum >= parseInt(f.boatStart) && boatNum <= parseInt(f.boatEnd));
    if (!flight?.checkInTime) return noLate;

    const weighedDate = new Date(entry.weighedAt);
    const checkIn     = parseFlightTime(flight.checkInTime, weighedDate);
    if (!checkIn) return noLate;

    const minsLate = Math.max(0, Math.floor((weighedDate - checkIn) / 60000));
    if (minsLate === 0) return noLate;

    if (minsLate >= lateDQMin) {
      return { ...entry, _latePenalty: 0, _isDQ: true, _minsLate: minsLate, _effectiveWeight: 0 };
    }

    const penalty         = parseFloat((minsLate * latePenPerMin).toFixed(2));
    const effectiveWeight = parseFloat(Math.max(0, base - penalty).toFixed(2));
    return { ...entry, _latePenalty: penalty, _isDQ: false, _minsLate: minsLate, _effectiveWeight: effectiveWeight };
  });

  const sorted = [...withPenalties].sort((a, b) => {
    const wa = a._effectiveWeight || 0;
    const wb = b._effectiveWeight || 0;
    if (wa === 0 && wb === 0) return 0;
    if (wa === 0) return 1;
    if (wb === 0) return -1;
    if (wb !== wa) return wb - wa;
    return (parseFloat(b.lunkerWeight) || 0) - (parseFloat(a.lunkerWeight) || 0);
  });

  const ranked = [];
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const ew = entry._effectiveWeight || 0;
    if (!(ew > 0)) { ranked.push({ ...entry, _rank: null }); continue; }
    if (i === 0) { ranked.push({ ...entry, _rank: 1 }); continue; }
    const prev = sorted[i - 1];
    const sameWeight = ew === (prev._effectiveWeight || 0);
    const sameLunker = (parseFloat(entry.lunkerWeight) || 0) === (parseFloat(prev.lunkerWeight) || 0);
    ranked.push({ ...entry, _rank: sameWeight && sameLunker ? ranked[i - 1]._rank : i + 1 });
  }
  return ranked;
}

export function getStats(entries, fees) {
  const named = entries.filter(r => r.boaterFirst || r.boaterLast);
  const boated = entries.filter(r => r.boatNo);

  const lunkerRows = boated.filter(r => r.lunker === 1 && parseFloat(r.lunkerWeight) > 0);
  const topLunkerRow = lunkerRows.length
    ? lunkerRows.reduce((best, r) => parseFloat(r.lunkerWeight) > parseFloat(best.lunkerWeight) ? r : best)
    : null;

  const bagRows = named.filter(r => r.paid === 1 && r.appSigned === 1 && parseFloat(r.totalWeight) > 0);
  const topBagRow = bagRows.length
    ? bagRows.reduce((best, r) => parseFloat(r.totalWeight) > parseFloat(best.totalWeight) ? r : best)
    : null;

  const totalWeight = bagRows.reduce((s, r) => s + (parseFloat(r.totalWeight) || 0), 0);
  const totalBuyIn = named.reduce((s, r) => s + (parseFloat(r.buyIn) || 0), 0);
  const lunkerPaidCount = named.filter(r => r.lunker === 1).length;
  const optionPaidCount = named.filter(r => r.option === 1).length;
  const lunkerPot = lunkerPaidCount * (parseFloat(fees?.lunkerFee) || 0);
  const optionPot = optionPaidCount * (parseFloat(fees?.optFee) || 0);

  return {
    totalBoats: boated.length,
    lunkerToBeat: topLunkerRow ? parseFloat(topLunkerRow.lunkerWeight).toFixed(2) : '0.00',
    lunkerToBeatRow: topLunkerRow,
    largestBag: topBagRow ? parseFloat(topBagRow.totalWeight).toFixed(2) : '0.00',
    largestBagRow: topBagRow,
    totalWeight: totalWeight.toFixed(2),
    totalBuyIn: totalBuyIn.toFixed(2),
    lunkerPot: lunkerPot.toFixed(2),
    optionPot: optionPot.toFixed(2),
    lunkerPaidCount,
    optionPaidCount,
  };
}
//Adjust this function to use weighted payouts instead of flat percentages
export function calcWeightedPayouts(total, n) {
  if (!n || n <= 0 || !total || total <= 0) return Array(Math.max(n || 0, 0)).fill(0);
  const weights = [];
  for (let i = 0; i < n; i++) {
    weights.push(1 / Math.pow(i + 1, 1.6));
  }
  const sumW = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map(w => Math.round((w / sumW) * total));
  let diff = total - raw.reduce((a, b) => a + b, 0);
  let i = 0;
  while (diff !== 0) {
    const step = diff > 0 ? 1 : -1;
    raw[i % n] += step;
    diff -= step;
    i++;
  }
  return raw;
}

export function getLeaderboardEntries(entries) {
  const filtered = entries
    .filter(r => (r.boaterFirst || r.boaterLast) && r.paid === 1 && r.appSigned === 1 && r._rank)
    .sort((a, b) => (a._rank || 999) - (b._rank || 999));

  const result = [];
  for (let i = 0; i < filtered.length; i++) {
    const entry = filtered[i];
    if (i === 0) { result.push({ ...entry, _lbRank: 1 }); continue; }
    const prev = filtered[i - 1];
    const sameWeight = parseFloat(entry.totalWeight) === parseFloat(prev.totalWeight);
    const sameLunker = (parseFloat(entry.lunkerWeight) || 0) === (parseFloat(prev.lunkerWeight) || 0);
    result.push({ ...entry, _lbRank: sameWeight && sameLunker ? result[i - 1]._lbRank : i + 1 });
  }
  return result;
}
