import { createClient } from '@libsql/client/web';
import { checkAuth } from '../_auth.js';

function getDb(env) {
  return createClient({
    url:       env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
}

function toJS(row) {
  return {
    id:             Number(row.id),
    boaterFirst:    row.boater_first    ?? '',
    boaterLast:     row.boater_last     ?? '',
    boaterPhone:    row.boater_phone    ?? '',
    boaterEmail:    row.boater_email    ?? '',
    coAnglerFirst:  row.co_angler_first ?? '',
    coAnglerLast:   row.co_angler_last  ?? '',
    coAnglerPhone:  row.co_angler_phone ?? '',
    coAnglerEmail:  row.co_angler_email ?? '',
    boatNo:         row.boat_no         ?? '',
    numFish:        row.num_fish        ?? 0,
    lunkerWeight:   row.lunker_weight   ?? 0,
    totalWeight:    row.total_weight    ?? 0,
    lunker:         row.lunker          ?? 0,
    option:         row.option_field    ?? 0,
    paid:           row.paid            ?? 0,
    appSigned:      row.app_signed      ?? 0,
    buyIn:          row.buy_in          ?? 0,
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

export async function onRequestPut({ params, request, env }) {
  if (!checkAuth(request, env)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!/^\d+$/.test(params.id)) return Response.json({ error: 'Invalid id' }, { status: 400 });
  try {
    const db   = getDb(env);
    const body = await request.json();
    const t    = v => (v ?? '').trim();

    const newTotalWeight    = Number(body.totalWeight) || 0;
    const preserveWeighTime = body.preserveWeighTime ? 1 : 0;
    const clientWeighedAt   = body.weighedAt  ? String(body.weighedAt)  : null;
    const clientUpdatedAt   = body.updatedAt  ? String(body.updatedAt)  : null;

    // Snapshot before state for event comparison
    const beforeResult = await db.execute({ sql: 'SELECT boat_no, total_weight, off_water_at FROM entries WHERE id=?', args: [params.id] });
    const before = beforeResult.rows[0] ?? {};

    const result = await db.execute({
      sql: `UPDATE entries SET
              boater_first=?, boater_last=?, boater_phone=?, boater_email=?,
              co_angler_first=?, co_angler_last=?, co_angler_phone=?, co_angler_email=?,
              boat_no=?, num_fish=?, lunker_weight=?, total_weight=?,
              lunker=?, option_field=?, paid=?, app_signed=?, buy_in=?,
              raw_weight=?, dead_fish=?, short_fish=?, needs_attention=?,
              signed_up_at  = CASE WHEN signed_up_at IS NULL AND ? != '' THEN CURRENT_TIMESTAMP ELSE signed_up_at END,
              weighed_at   = CASE WHEN ? > 0 AND ? = 0 THEN COALESCE(?, CURRENT_TIMESTAMP) ELSE weighed_at END,
              checked_in_at = CASE WHEN ? != '' AND checked_in_at IS NULL THEN CURRENT_TIMESTAMP ELSE checked_in_at END,
              off_water_at  = CASE WHEN ? = 1 THEN NULLIF(?, '') WHEN ? = 1 THEN COALESCE(off_water_at, CURRENT_TIMESTAMP) WHEN ? = 0 THEN NULL ELSE off_water_at END,
              updated_at   = CURRENT_TIMESTAMP
            WHERE id=? AND (? IS NULL OR updated_at = ?)`,
      args: [
        t(body.boaterFirst),   t(body.boaterLast),    t(body.boaterPhone),   t(body.boaterEmail),
        t(body.coAnglerFirst), t(body.coAnglerLast),  t(body.coAnglerPhone), t(body.coAnglerEmail),
        t(body.boatNo),
        Number(body.numFish)      || 0,
        Number(body.lunkerWeight) || 0,
        newTotalWeight,
        body.lunker    === '' ? null : Number(body.lunker),
        body.option    === '' ? null : Number(body.option),
        body.paid      === '' ? null : Number(body.paid),
        body.appSigned === '' ? null : Number(body.appSigned),
        Number(body.buyIn) || 0,
        body.rawWeight != null ? Number(body.rawWeight) : null,
        Number(body.deadFish)  || 0,
        Number(body.shortFish) || 0,
        body.needsAttention ? 1 : 0,
        t(body.boaterFirst),
        newTotalWeight, preserveWeighTime, clientWeighedAt,
        t(body.boatNo),
        body.offWaterAtDirect ? 1 : 0,
        body.offWaterAtDirect ? (body.offWaterAt || '') : '',
        body.offWater === true ? 1 : body.offWater === false ? 0 : -1,
        body.offWater === true ? 1 : body.offWater === false ? 0 : -1,
        params.id, clientUpdatedAt, clientUpdatedAt,
      ],
    });

    if (result.rowsAffected === 0) {
      const check = await db.execute({ sql: 'SELECT id FROM entries WHERE id=?', args: [params.id] });
      if (!check.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json({ error: 'conflict' }, { status: 409 });
    }

    const updated = await db.execute({ sql: 'SELECT * FROM entries WHERE id = ?', args: [params.id] });
    const after   = updated.rows[0];
    const boaterName = `${after.boater_first || ''} ${after.boater_last || ''}`.trim();
    const afterBoat  = after.boat_no ?? '';

    // Write lifecycle events (best-effort)
    try {
      await db.execute('CREATE TABLE IF NOT EXISTS event_log (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, entry_id INTEGER, boat_no TEXT, boater_name TEXT, value TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
      const events = [];

      // Check-in: boatNo newly assigned or changed
      const newBoatNo = t(body.boatNo);
      if (newBoatNo && (before.boat_no ?? '') !== newBoatNo) {
        events.push({ sql: 'INSERT INTO event_log (event_type, entry_id, boat_no, boater_name, value) VALUES (?,?,?,?,?)', args: ['checkin', params.id, newBoatNo, boaterName, newBoatNo] });
      }

      // Check-out: off-water toggled either direction
      if (body.offWater === true) {
        events.push({ sql: 'INSERT INTO event_log (event_type, entry_id, boat_no, boater_name, value) VALUES (?,?,?,?,?)', args: ['checkout', params.id, afterBoat, boaterName, 'checked out'] });
      } else if (body.offWater === false) {
        events.push({ sql: 'INSERT INTO event_log (event_type, entry_id, boat_no, boater_name, value) VALUES (?,?,?,?,?)', args: ['checkout', params.id, afterBoat, boaterName, 'returned to water'] });
      }

      // Weigh-in: weight intentionally set (weighedAt provided by client)
      if (clientWeighedAt && newTotalWeight > 0) {
        events.push({ sql: 'INSERT INTO event_log (event_type, entry_id, boat_no, boater_name, value) VALUES (?,?,?,?,?)', args: ['weighin', params.id, afterBoat, boaterName, String(newTotalWeight)] });
      }

      if (events.length > 0) await db.batch(events);
    } catch (_) {}

    return Response.json(toJS(after));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function onRequestDelete({ params, request, env }) {
  if (!checkAuth(request, env)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!/^\d+$/.test(params.id)) return Response.json({ error: 'Invalid id' }, { status: 400 });
  try {
    const db = getDb(env);
    await db.execute({ sql: 'DELETE FROM entries WHERE id = ?', args: [params.id] });
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
