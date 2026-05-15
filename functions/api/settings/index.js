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
    let version  = null;
    for (const row of result.rows) {
      if (row.key === '__version') { version = row.value; continue; }
      try { out[row.key] = JSON.parse(row.value); }
      catch { out[row.key] = row.value; }
    }
    out._version = version;
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function onRequestPut({ request, env }) {
  if (!checkAuth(request, env)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db            = getDb(env);
    const body          = await request.json();
    const clientVersion = body._version ?? null;

    // Check the stored version — if it exists and doesn't match, another device saved first
    const vRow = await db.execute(`SELECT value FROM settings WHERE key = '__version'`);
    const serverVersion = vRow.rows[0]?.value ?? null;
    if (serverVersion !== null && clientVersion !== serverVersion) {
      return Response.json({ error: 'Settings were modified by another device', isConflict: true }, { status: 409 });
    }

    // Write all keys (skip _version — we manage __version ourselves)
    for (const [key, value] of Object.entries(body)) {
      if (key === '_version') continue;
      await db.execute({
        sql:  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        args: [key, JSON.stringify(value)],
      });
    }

    // Bump the version timestamp
    const newVersion = new Date().toISOString();
    await db.execute({
      sql:  `INSERT INTO settings (key, value) VALUES ('__version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      args: [newVersion],
    });

    return Response.json({ success: true, _version: newVersion });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
