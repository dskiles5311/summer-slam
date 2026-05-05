export function calcRanks(entries) {
  const sorted = [...entries].sort((a, b) => {
    const wa = parseFloat(a.totalWeight) || 0;
    const wb = parseFloat(b.totalWeight) || 0;
    if (wa === 0 && wb === 0) return 0;
    if (wa === 0) return 1;
    if (wb === 0) return -1;
    return wb - wa;
  });
  return sorted.map((entry, i) => ({
    ...entry,
    _rank: parseFloat(entry.totalWeight) > 0 ? i + 1 : null,
  }));
}

export function getStats(entries, fees) {
  const named = entries.filter(r => r.boaterFirst || r.boaterLast);
  const boated = named.filter(r => r.boatNo);

  const lunkerRows = boated.filter(r => r.lunker === 1 && parseFloat(r.lunkerWeight) > 0);
  const topLunkerRow = lunkerRows.length
    ? lunkerRows.reduce((best, r) => parseFloat(r.lunkerWeight) > parseFloat(best.lunkerWeight) ? r : best)
    : null;

  const bagRows = named.filter(r => parseFloat(r.totalWeight) > 0);
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
  return entries
    .filter(r => (r.boaterFirst || r.boaterLast) && r.paid === 1 && r.appSigned === 1 && r._rank)
    .sort((a, b) => (a._rank || 999) - (b._rank || 999))
    .map((entry, i) => ({ ...entry, _lbRank: i + 1 }));
}
