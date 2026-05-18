import { createClient } from '@libsql/client/web';
import { checkAuth } from '../_auth.js';

function getDb(env) {
  return createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
}

async function ensureTable(db) {
  await db.execute(`CREATE TABLE IF NOT EXISTS event_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type  TEXT    NOT NULL,
    entry_id    INTEGER,
    boat_no     TEXT,
    boater_name TEXT,
    value       TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
}

export async function onRequestGet({ request, env }) {
  if (!checkAuth(request, env)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db   = getDb(env);
    await ensureTable(db);
    const url  = new URL(request.url);
    const type = url.searchParams.get('type');
    const result = type
      ? await db.execute({ sql: 'SELECT * FROM event_log WHERE event_type = ? ORDER BY created_at DESC', args: [type] })
      : await db.execute('SELECT * FROM event_log ORDER BY created_at DESC');
    return Response.json(result.rows.map(r => ({
      id:         Number(r.id),
      eventType:  r.event_type,
      entryId:    r.entry_id,
      boatNo:     r.boat_no     ?? '',
      boaterName: r.boater_name ?? '',
      value:      r.value       ?? '',
      createdAt:  r.created_at,
    })));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function onRequestDelete({ request, env }) {
  if (!checkAuth(request, env)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db   = getDb(env);
    await ensureTable(db);
    const url  = new URL(request.url);
    const type = url.searchParams.get('type');
    if (type) {
      await db.execute({ sql: 'DELETE FROM event_log WHERE event_type = ?', args: [type] });
    } else {
      await db.execute('DELETE FROM event_log');
    }
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
