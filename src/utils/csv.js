export function exportCSV(entries) {
  const headers = ['Place','Boater First','Boater Last','Co-Angler First','Co-Angler Last',
    'Boat No','# Fish','Lunker Weight','Total Weight','Lunker','Option','Paid','App Signed','Buy-In'];
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
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
  });

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
        const lines = e.target.result.split('\n').filter(l => l.trim());
        if (lines.length < 2) return resolve([]);

        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
        const fieldMap = {
          'boater first': 'boaterFirst', 'boater_first': 'boaterFirst',
          'boater last': 'boaterLast', 'boater_last': 'boaterLast',
          'co-angler first': 'coAnglerFirst', 'co-angler_first': 'coAnglerFirst',
          'co-angler last': 'coAnglerLast', 'co-angler_last': 'coAnglerLast',
          'boat no': 'boatNo', 'boat_no': 'boatNo', 'boat no.': 'boatNo',
          '# fish': 'numFish', 'num fish': 'numFish', 'number of fish': 'numFish',
          'lunker weight': 'lunkerWeight', 'lunker_weight': 'lunkerWeight',
          'total weight': 'totalWeight', 'total_weight': 'totalWeight',
          'lunker': 'lunker', 'option': 'option', 'paid': 'paid',
          'app signed': 'appSigned', 'app_signed': 'appSigned',
          'buy-in': 'buyIn', 'buy in': 'buyIn',
        };
        const numFields = ['numFish','lunkerWeight','totalWeight','lunker','option','paid','appSigned','buyIn'];

        const entries = [];
        for (let i = 1; i < lines.length; i++) {
          const vals = parseCSVLine(lines[i]);
          const row = {
            boaterFirst: '', boaterLast: '', coAnglerFirst: '', coAnglerLast: '',
            boatNo: '', numFish: 0, lunkerWeight: 0, totalWeight: 0,
            lunker: 0, option: 0, paid: 0, appSigned: 0, buyIn: 0,
          };
          headers.forEach((h, j) => {
            const field = fieldMap[h];
            if (!field) return;
            const v = vals[j]?.trim() || '';
            row[field] = numFields.includes(field) ? (parseFloat(v) || 0) : v;
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
