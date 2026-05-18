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
    const { firstName, lastName, suffix, phone, email } = await request.json();

    // Read old name before updating so we can cascade to entries
    const before = await db.execute({ sql: 'SELECT first_name, last_name, suffix FROM contacts WHERE id=?', args: [params.id] });
    if (!before.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    const oldFirst  = before.rows[0].first_name;
    const oldLast   = before.rows[0].last_name;
    const oldSuffix = before.rows[0].suffix ?? '';
    const newFirst  = firstName ?? '';
    const newLast   = lastName  ?? '';
    const newSuffix = suffix    ?? '';

    await db.execute({
      sql:  `UPDATE contacts SET first_name=?, last_name=?, suffix=?, phone=?, email=? WHERE id=?`,
      args: [newFirst, newLast, newSuffix, phone ?? '', email ?? '', params.id],
    });

    // Cascade name/suffix change to entries and archives
    if (oldFirst !== newFirst || oldLast !== newLast || oldSuffix !== newSuffix) {
      await db.execute({
        sql:  `UPDATE entries SET boater_first=?, boater_last=?, boater_suffix=? WHERE boater_first=? COLLATE NOCASE AND boater_last=? COLLATE NOCASE AND boater_suffix=? COLLATE NOCASE`,
        args: [newFirst, newLast, newSuffix, oldFirst, oldLast, oldSuffix],
      });
      await db.execute({
        sql:  `UPDATE entries SET co_angler_first=?, co_angler_last=?, co_angler_suffix=? WHERE co_angler_first=? COLLATE NOCASE AND co_angler_last=? COLLATE NOCASE AND co_angler_suffix=? COLLATE NOCASE`,
        args: [newFirst, newLast, newSuffix, oldFirst, oldLast, oldSuffix],
      });
      await db.execute({
        sql:  `UPDATE archives SET boater_first=?, boater_last=?, boater_suffix=? WHERE boater_first=? COLLATE NOCASE AND boater_last=? COLLATE NOCASE AND boater_suffix=? COLLATE NOCASE`,
        args: [newFirst, newLast, newSuffix, oldFirst, oldLast, oldSuffix],
      });
      await db.execute({
        sql:  `UPDATE archives SET co_angler_first=?, co_angler_last=?, co_angler_suffix=? WHERE co_angler_first=? COLLATE NOCASE AND co_angler_last=? COLLATE NOCASE AND co_angler_suffix=? COLLATE NOCASE`,
        args: [newFirst, newLast, newSuffix, oldFirst, oldLast, oldSuffix],
      });
    }

    const result = await db.execute({ sql: 'SELECT * FROM contacts WHERE id=?', args: [params.id] });
    const r = result.rows[0];
    return Response.json({
      id:        Number(r.id),
      firstName: r.first_name,
      lastName:  r.last_name,
      suffix:    r.suffix || '',
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
