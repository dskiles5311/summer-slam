import { createClient } from '@libsql/client/web';

function getDb(env) {
  return createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
}

function toJS(row) {
  return {
    id:             Number(row.id),
    year:           row.year,
    place:          row.place,
    boaterFirst:    row.boater_first    ?? '',
    boaterLast:     row.boater_last     ?? '',
    coAnglerFirst:  row.co_angler_first ?? '',
    coAnglerLast:   row.co_angler_last  ?? '',
    boatNo:         row.boat_no         ?? '',
    numFish:        row.num_fish        ?? 0,
    lunkerWeight:   row.lunker_weight   ?? 0,
    totalWeight:    row.total_weight    ?? 0,
  };
}

// GET /api/archive/:year
export async function onRequestGet({ params, env }) {
  try {
    const db = getDb(env);
    const result = await db.execute({
      sql: 'SELECT * FROM archives WHERE year = ? ORDER BY place ASC NULLS LAST, id ASC',
      args: [params.year],
    });
    return Response.json(result.rows.map(toJS));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
