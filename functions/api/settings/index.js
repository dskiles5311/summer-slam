import { createClient } from '@libsql/client/web';
import { checkAuth } from '../_auth.js';

function getDb(env) {
  return createClient({
    url:       env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
}

export async function onRequestGet({ env }) {
  try {
    const db     = getDb(env);
    const result = await db.execute('SELECT key, value FROM settings');
    const out    = {};
    for (const row of result.rows) {
      try { out[row.key] = JSON.parse(row.value); }
      catch { out[row.key] = row.value; }
    }
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function onRequestPut({ request, env }) {
  if (!checkAuth(request, env)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db   = getDb(env);
    const body = await request.json();
    for (const [key, value] of Object.entries(body)) {
      await db.execute({
        sql:  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        args: [key, JSON.stringify(value)],
      });
    }
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
