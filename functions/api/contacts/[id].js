import { createClient } from '@libsql/client/web';
import { checkAuth } from '../_auth.js';

function getDb(env) {
  return createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
}

export async function onRequestPut({ params, request, env }) {
  if (!checkAuth(request, env)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!/^\d+$/.test(params.id)) return Response.json({ error: 'Invalid id' }, { status: 400 });
  try {
    const db = getDb(env);
    const { phone, email } = await request.json();
    await db.execute({
      sql: `UPDATE contacts SET phone=?, email=? WHERE id=?`,
      args: [phone ?? '', email ?? '', params.id],
    });
    const result = await db.execute({ sql: 'SELECT * FROM contacts WHERE id=?', args: [params.id] });
    if (!result.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    const r = result.rows[0];
    return Response.json({
      id:        Number(r.id),
      firstName: r.first_name,
      lastName:  r.last_name,
      phone:     r.phone || '',
      email:     r.email || '',
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function onRequestDelete({ params, request, env }) {
  if (!checkAuth(request, env)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!/^\d+$/.test(params.id)) return Response.json({ error: 'Invalid id' }, { status: 400 });
  try {
    const db = getDb(env);
    await db.execute({ sql: 'DELETE FROM contacts WHERE id=?', args: [params.id] });
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
