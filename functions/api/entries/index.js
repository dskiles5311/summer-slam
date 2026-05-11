import { createClient } from '@libsql/client/web';
import { checkAuth } from '../_auth.js';

function getDb(env) {
  return createClient({
    url:       env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
}

function toJS(row, hidePI = false) {
  return {
    id:             Number(row.id),
    boaterFirst:    row.boater_first    ?? '',
    boaterLast:     row.boater_last     ?? '',
    boaterPhone:    hidePI ? '' : (row.boater_phone    ?? ''),
    boaterEmail:    hidePI ? '' : (row.boater_email    ?? ''),
    coAnglerFirst:  row.co_angler_first ?? '',
    coAnglerLast:   row.co_angler_last  ?? '',
    coAnglerPhone:  hidePI ? '' : (row.co_angler_phone ?? ''),
    coAnglerEmail:  hidePI ? '' : (row.co_angler_email ?? ''),
    boatNo:         row.boat_no         ?? '',
    numFish:        row.num_fish        ?? 0,
    lunkerWeight:   row.lunker_weight   ?? 0,
    totalWeight:    row.total_weight    ?? 0,
    lunker:         row.lunker          ?? 0,
    option:         row.option_field    ?? 0,
    paid:           row.paid            ?? 0,
    appSigned:      row.app_signed      ?? 0,
    buyIn:          hidePI ? 0 : (row.buy_in ?? 0),
    rawWeight:      row.raw_weight      ?? null,
    deadFish:       row.dead_fish       ?? 0,
    shortFish:      row.short_fish      ?? 0,
    needsAttention: Boolean(row.needs_attention),
    weighedAt:      row.weighed_at      ?? null,
  };
}

export async function onRequestGet({ request, env }) {
  try {
    const db = getDb(env);
    const hidePI = !checkAuth(request, env);
    const result = await db.execute('SELECT * FROM entries ORDER BY total_weight DESC, id ASC');
    return Response.json(result.rows.map(r => toJS(r, hidePI)));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function onRequestDelete({ request, env }) {
  if (!checkAuth(request, env)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = getDb(env);
    await db.execute('DELETE FROM entries');
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  if (!checkAuth(request, env)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db   = getDb(env);
    const body = await request.json();
    const t    = v => (v ?? '').trim();

    const result = await db.execute({
      sql: `INSERT INTO entries
              (boater_first, boater_last, boater_phone, boater_email,
               co_angler_first, co_angler_last, co_angler_phone, co_angler_email,
               boat_no, num_fish, lunker_weight, total_weight,
               lunker, option_field, paid, app_signed, buy_in,
               raw_weight, dead_fish, short_fish, needs_attention)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        t(body.boaterFirst),   t(body.boaterLast),    t(body.boaterPhone),   t(body.boaterEmail),
        t(body.coAnglerFirst), t(body.coAnglerLast),  t(body.coAnglerPhone), t(body.coAnglerEmail),
        t(body.boatNo),
        Number(body.numFish)      || 0,
        Number(body.lunkerWeight) || 0,
        Number(body.totalWeight)  || 0,
        body.lunker    === '' ? null : Number(body.lunker),
        body.option    === '' ? null : Number(body.option),
        body.paid      === '' ? null : Number(body.paid),
        body.appSigned === '' ? null : Number(body.appSigned),
        Number(body.buyIn) || 0,
        body.rawWeight != null ? Number(body.rawWeight) : null,
        Number(body.deadFish)  || 0,
        Number(body.shortFish) || 0,
        body.needsAttention ? 1 : 0,
      ],
    });

    const newRow = await db.execute({
      sql:  'SELECT * FROM entries WHERE id = ?',
      args: [Number(result.lastInsertRowid)],
    });
    return Response.json(toJS(newRow.rows[0]), { status: 201 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
