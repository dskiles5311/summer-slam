import { createClient } from '@libsql/client/web';
import { checkAuth } from '../_auth.js';

function getDb(env) {
  return createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
}

// GET /api/archive — list distinct archived years
export async function onRequestGet({ env }) {
  try {
    const db = getDb(env);
    const result = await db.execute('SELECT DISTINCT year FROM archives ORDER BY year DESC');
    return Response.json(result.rows.map(r => r.year));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/archive — snapshot current entries for a year
// Body: { year: string, entries: [{place, boaterFirst, boaterLast, coAnglerFirst, coAnglerLast, boatNo, numFish, lunkerWeight, totalWeight}] }
export async function onRequestPost({ request, env }) {
  if (!checkAuth(request, env)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = getDb(env);
    const { year, entries } = await request.json();
    if (!year || !Array.isArray(entries)) {
      return Response.json({ error: 'year and entries are required' }, { status: 400 });
    }

    // Concurrency note: two simultaneous archive requests for the same year will be
    // serialized by SQLite's write lock — the second batch runs after the first commits.
    // Both admins see the same entries (within the polling window), so both produce
    // equivalent snapshots. Last writer wins, which is acceptable for a once-per-season
    // operation that already requires explicit confirmation.
    const stmts = [
      { sql: 'DELETE FROM archives WHERE year = ?', args: [String(year)] },
      ...entries.map(e => ({
        sql: `INSERT INTO archives
                (year, place, boater_first, boater_last, co_angler_first, co_angler_last,
                 boat_no, num_fish, lunker_weight, total_weight, raw_weight, dead_fish, short_fish,
                 boater_phone, boater_email, co_angler_phone, co_angler_email,
                 lunker, option_field, paid, app_signed, buy_in, needs_attention,
                 weighed_at, signed_up_at, checked_in_at, off_water_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          String(year),
          e.place != null ? Number(e.place) : null,
          e.boaterFirst    ?? '',
          e.boaterLast     ?? '',
          e.coAnglerFirst  ?? '',
          e.coAnglerLast   ?? '',
          e.boatNo         ?? '',
          Number(e.numFish)      || 0,
          Number(e.lunkerWeight) || 0,
          Number(e.totalWeight)  || 0,
          e.rawWeight != null ? Number(e.rawWeight) : null,
          Number(e.deadFish)     || 0,
          Number(e.shortFish)    || 0,
          e.boaterPhone    ?? '',
          e.boaterEmail    ?? '',
          e.coAnglerPhone  ?? '',
          e.coAnglerEmail  ?? '',
          e.lunker   != null ? Number(e.lunker)   : null,
          e.option   != null ? Number(e.option)   : null,
          e.paid     != null ? Number(e.paid)     : null,
          e.appSigned != null ? Number(e.appSigned) : null,
          Number(e.buyIn) || 0,
          e.needsAttention ? 1 : 0,
          e.weighedAt    ?? null,
          e.signedUpAt   ?? null,
          e.checkedInAt  ?? null,
          e.offWaterAt   ?? null,
        ],
      })),
    ];

    await db.batch(stmts, 'write');

    return Response.json({ ok: true, year: String(year), count: entries.length });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
