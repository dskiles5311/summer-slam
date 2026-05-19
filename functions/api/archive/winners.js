import { createClient } from '@libsql/client/web';
import { checkAuth } from '../_auth.js';

function getDb(env) {
  return createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
}

// GET /api/archive/winners — all 1st-place finishers across all archived years
export async function onRequestGet({ request, env }) {
  if (!checkAuth(request, env)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = getDb(env);
    const result = await db.execute(
      `SELECT year, boater_first, boater_last, boater_suffix,
              co_angler_first, co_angler_last, co_angler_suffix
       FROM archives WHERE place = 1 ORDER BY year DESC`
    );
    return Response.json(result.rows.map(r => ({
      year:          r.year,
      boaterFirst:   r.boater_first,
      boaterLast:    r.boater_last,
      boaterSuffix:  r.boater_suffix,
      coAnglerFirst: r.co_angler_first,
      coAnglerLast:  r.co_angler_last,
      coAnglerSuffix: r.co_angler_suffix,
    })));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
