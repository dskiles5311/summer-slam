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
    const { firstName, lastName, phone, email } = await request.json();

    // Read old name before updating so we can cascade to entries
    const before = await db.execute({ sql: 'SELECT first_name, last_name FROM contacts WHERE id=?', args: [params.id] });
    if (!before.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    const oldFirst = before.rows[0].first_name;
    const oldLast  = before.rows[0].last_name;
    const newFirst = firstName ?? '';
    const newLast  = lastName  ?? '';

    await db.execute({
      sql:  `UPDATE contacts SET first_name=?, last_name=?, phone=?, email=? WHERE id=?`,
      args: [newFirst, newLast, phone ?? '', email ?? '', params.id],
    });

    // Cascade name change to entries if the name actually changed
    if (oldFirst !== newFirst || oldLast !== newLast) {
      await db.execute({
        sql:  `UPDATE entries SET boater_first=?, boater_last=? WHERE boater_first=? AND boater_last=? COLLATE NOCASE`,
        args: [newFirst, newLast, oldFirst, oldLast],
      });
      await db.execute({
        sql:  `UPDATE entries SET co_angler_first=?, co_angler_last=? WHERE co_angler_first=? AND co_angler_last=? COLLATE NOCASE`,
        args: [newFirst, newLast, oldFirst, oldLast],
      });
    }

    const result = await db.execute({ sql: 'SELECT * FROM contacts WHERE id=?', args: [params.id] });
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
