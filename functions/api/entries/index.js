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
    boaterSuffix:   row.boater_suffix   ?? '',
    boaterPhone:    hidePI ? '' : (row.boater_phone    ?? ''),
    boaterEmail:    hidePI ? '' : (row.boater_email    ?? ''),
    coAnglerFirst:  row.co_angler_first ?? '',
    coAnglerLast:   row.co_angler_last  ?? '',
    coAnglerSuffix: row.co_angler_suffix ?? '',
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
    updatedAt:      row.updated_at      ?? null,
    signedUpAt:     row.signed_up_at    ?? null,
    checkedInAt:    row.checked_in_at   ?? null,
    offWaterAt:     row.off_water_at    ?? null,
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
              (boater_first, boater_last, boater_suffix, boater_phone, boater_email,
               co_angler_first, co_angler_last, co_angler_suffix, co_angler_phone, co_angler_email,
               boat_no, num_fish, lunker_weight, total_weight,
               lunker, option_field, paid, app_signed, buy_in,
               raw_weight, dead_fish, short_fish, needs_attention, signed_up_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [
        t(body.boaterFirst),   t(body.boaterLast),   t(body.boaterSuffix ?? ''),   t(body.boaterPhone),   t(body.boaterEmail),
        t(body.coAnglerFirst), t(body.coAnglerLast), t(body.coAnglerSuffix ?? ''), t(body.coAnglerPhone), t(body.coAnglerEmail),
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

    const newId  = Number(result.lastInsertRowid);
    const newRow = await db.execute({ sql: 'SELECT * FROM entries WHERE id = ?', args: [newId] });

    // Write signup event (best-effort — don't fail the request if it errors)
    try {
      await db.execute('CREATE TABLE IF NOT EXISTS event_log (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, entry_id INTEGER, boat_no TEXT, boater_name TEXT, value TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
      const boaterName = [t(body.boaterFirst), t(body.boaterLast), t(body.boaterSuffix ?? '')].filter(Boolean).join(' ');
      await db.execute({ sql: 'INSERT INTO event_log (event_type, entry_id, boat_no, boater_name, value) VALUES (?,?,?,?,?)', args: ['signup', newId, '', boaterName, ''] });
    } catch (_) {}

    return Response.json(toJS(newRow.rows[0]), { status: 201 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
