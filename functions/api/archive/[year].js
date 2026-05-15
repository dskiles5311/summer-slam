import { createClient } from '@libsql/client/web';
import { checkAuth } from '../_auth.js';

function getDb(env) {
  return createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
}

function toJS(row, hidePI = false) {
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
    rawWeight:      row.raw_weight      ?? null,
    deadFish:       row.dead_fish       ?? 0,
    shortFish:      row.short_fish      ?? 0,
    boaterPhone:    hidePI ? '' : (row.boater_phone    ?? ''),
    boaterEmail:    hidePI ? '' : (row.boater_email    ?? ''),
    coAnglerPhone:  hidePI ? '' : (row.co_angler_phone ?? ''),
    coAnglerEmail:  hidePI ? '' : (row.co_angler_email ?? ''),
    lunker:         row.lunker          ?? 0,
    option:         row.option_field    ?? 0,
    paid:           row.paid            ?? 0,
    appSigned:      row.app_signed      ?? 0,
    buyIn:          hidePI ? 0 : (row.buy_in ?? 0),
    needsAttention: Boolean(row.needs_attention),
    weighedAt:      row.weighed_at      ?? null,
    signedUpAt:     row.signed_up_at    ?? null,
    checkedInAt:    row.checked_in_at   ?? null,
    offWaterAt:     row.off_water_at    ?? null,
  };
}

// GET /api/archive/:year
export async function onRequestGet({ params, request, env }) {
  try {
    const db = getDb(env);
    const hidePI = !checkAuth(request, env);
    const result = await db.execute({
      sql: 'SELECT * FROM archives WHERE year = ? ORDER BY place ASC NULLS LAST, id ASC',
      args: [params.year],
    });
    return Response.json(result.rows.map(r => toJS(r, hidePI)));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
