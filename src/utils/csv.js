export function exportCSV(entries, payoutSettings) {
  const headers = ['Place','Boater First','Boater Last','Co-Angler First','Co-Angler Last',
    'Boat No','# Fish','Lunker Weight','Total Weight','Lunker','Option','Paid','App Signed','Buy-In',
    'Raw Weight','Dead Fish','Short Fish','Needs Attention'];
  const lines = [headers.join(',')];

  const sorted = [...entries]
    .filter(r => r.boaterFirst || r.boaterLast)
    .sort((a, b) => (a._rank || 999) - (b._rank || 999));

  sorted.forEach(r => {
    lines.push([
      r._rank || '',
      r.boaterFirst, r.boaterLast,
      r.coAnglerFirst, r.coAnglerLast,
      r.boatNo, r.numFish,
      r.lunkerWeight, r.totalWeight,
      r.lunker, r.option, r.paid, r.appSigned, r.buyIn,
      r.rawWeight ?? '', r.deadFish || 0, r.shortFish || 0, r.needsAttention ? 1 : 0,
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
  });

  if (payoutSettings) {
    const { totalPayout = 0, numWinners = 0, payouts = [] } = payoutSettings;
    lines.push('');
    lines.push('Payout Settings');
    lines.push(`Total Payout,$${totalPayout}`);
    lines.push(`Number of Winners,${numWinners}`);
    if (payouts.length > 0) {
      lines.push('Place,Amount,Pct');
      const placeLabel = i => i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : `${i + 1}th`;
      payouts.forEach((amt, i) => {
        const pct = totalPayout > 0 ? ((amt / totalPayout) * 100).toFixed(1) : '0.0';
        lines.push(`${placeLabel(i)},$${amt},${pct}%`);
      });
    }
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'summer-slam-results.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (line[i] === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += line[i];
    }
  }
  result.push(current);
  return result;
}

export function importCSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const lines = e.target.result.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) return resolve([]);

        const headerVals = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
        const fieldMap = {
          'boater first': 'boaterFirst', 'boater_first': 'boaterFirst',
          'boater last': 'boaterLast', 'boater_last': 'boaterLast',
          'co-angler first': 'coAnglerFirst', 'co-angler_first': 'coAnglerFirst',
          'co-angler last': 'coAnglerLast', 'co-angler_last': 'coAnglerLast',
          'boat no': 'boatNo', 'boat_no': 'boatNo', 'boat no.': 'boatNo', 'boat_no.': 'boatNo',
          '# fish': 'numFish', 'num fish': 'numFish', 'number of fish': 'numFish', 'number_of_fish': 'numFish',
          'lunker weight': 'lunkerWeight', 'lunker_weight': 'lunkerWeight',
          'total weight': 'totalWeight', 'total_weight': 'totalWeight',
          'lunker': 'lunker', 'option': 'option', 'paid': 'paid',
          'app signed': 'appSigned', 'app_signed': 'appSigned', 'application_signed': 'appSigned',
          'buy-in': 'buyIn', 'buy in': 'buyIn', 'buyin': 'buyIn',
          'raw weight': 'rawWeight', 'raw_weight': 'rawWeight',
          'dead fish': 'deadFish', 'dead_fish': 'deadFish',
          'short fish': 'shortFish', 'short_fish': 'shortFish',
          'needs attention': 'needsAttention', 'needs_attention': 'needsAttention',
        };
        const numFields = ['numFish','lunkerWeight','totalWeight','lunker','option','paid','appSigned','buyIn',
          'rawWeight','deadFish','shortFish'];

        const entries = [];
        for (let i = 1; i < lines.length; i++) {
          const vals = parseCSVLine(lines[i]);
          const row = {
            boaterFirst: '', boaterLast: '', coAnglerFirst: '', coAnglerLast: '',
            boatNo: '', numFish: 0, lunkerWeight: 0, totalWeight: 0,
            lunker: 0, option: 0, paid: 0, appSigned: 0, buyIn: 0,
            rawWeight: null, deadFish: 0, shortFish: 0, needsAttention: false,
          };
          headerVals.forEach((h, j) => {
            const field = fieldMap[h];
            if (!field) return;
            let v = vals[j]?.trim() || '';

            if (field === 'needsAttention') {
              row[field] = v === '1' || /^true$/i.test(v);
            } else if (field === 'rawWeight') {
              const n = parseFloat(v.replace(/[$\s]/g, '').replace(/lbs?$/i, ''));
              row[field] = isNaN(n) || n === 0 ? null : n;
            } else if (numFields.includes(field)) {
              v = v.replace(/[$\s]/g, '').replace(/lbs?$/i, '').trim();
              row[field] = /^x$/i.test(v) ? 1 : (parseFloat(v) || 0);
            } else {
              row[field] = v;
            }
          });
          if (row.boaterFirst || row.boaterLast) entries.push(row);
        }
        resolve(entries);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
