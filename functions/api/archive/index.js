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

    await db.execute({ sql: 'DELETE FROM archives WHERE year = ?', args: [String(year)] });

    for (const e of entries) {
      await db.execute({
        sql: `INSERT INTO archives
                (year, place, boater_first, boater_last, co_angler_first, co_angler_last,
                 boat_no, num_fish, lunker_weight, total_weight)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          String(year),
          e.place != null ? Number(e.place) : null,
          e.boaterFirst    ?? '',
          e.boaterLast     ?? '',
          e.coAnglerFirst  ?? '',
          e.coAnglerLast   ?? '',
          e.boatNo         ?? '',
          Number(e.numFish)        || 0,
          Number(e.lunkerWeight)   || 0,
          Number(e.totalWeight)    || 0,
        ],
      });
    }

    return Response.json({ ok: true, year: String(year), count: entries.length });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
