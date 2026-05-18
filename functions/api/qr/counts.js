import { createClient } from '@libsql/client/web';
import { checkAuth } from '../_auth.js';

function getDb(env) {
  return createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
}

export async function onRequestGet({ request, env }) {
  if (!checkAuth(request, env)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = getDb(env);
    const result = await db.execute(
      `SELECT value, COUNT(*) as count FROM event_log WHERE event_type = 'qr_scan' GROUP BY value`
    );
    const counts = { rules: 0, 'off-limits': 0 };
    for (const row of result.rows) {
      if (row.value === 'rules') counts.rules = Number(row.count);
      if (row.value === 'off-limits') counts['off-limits'] = Number(row.count);
    }
    return Response.json(counts);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
