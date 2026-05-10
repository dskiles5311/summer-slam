import { createClient } from '@libsql/client/web';
import { checkAuth } from '../_auth.js';

function getDb(env) {
  return createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
}

export async function onRequestGet({ request, env }) {
  if (!checkAuth(request, env)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const q = new URL(request.url).searchParams.get('q') || '';
    const db = getDb(env);
    let result;
    if (q.length >= 2) {
      const like = `%${q}%`;
      result = await db.execute({
        sql: `SELECT id, first_name, last_name, phone, email FROM contacts
              WHERE first_name LIKE ? OR last_name LIKE ? OR (first_name || ' ' || last_name) LIKE ?
              ORDER BY last_seen DESC LIMIT 10`,
        args: [like, like, like],
      });
    } else {
      result = await db.execute(
        `SELECT id, first_name, last_name, phone, email FROM contacts ORDER BY last_name ASC, first_name ASC`
      );
    }
    return Response.json(result.rows.map(r => ({
      id:        Number(r.id),
      firstName: r.first_name,
      lastName:  r.last_name,
      phone:     r.phone || '',
      email:     r.email || '',
    })));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  if (!checkAuth(request, env)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = getDb(env);
    const { firstName, lastName, phone, email } = await request.json();
    if (!firstName || !lastName) return Response.json({ error: 'firstName and lastName required' }, { status: 400 });
    await db.execute({
      sql: `INSERT INTO contacts (first_name, last_name, phone, email, last_seen)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(first_name, last_name) DO UPDATE SET
              phone = CASE WHEN ? != '' THEN ? ELSE phone END,
              email = CASE WHEN ? != '' THEN ? ELSE email END,
              last_seen = CURRENT_TIMESTAMP`,
      args: [firstName, lastName, phone || '', email || '',
             phone || '', phone || '', email || '', email || ''],
    });
    return Response.json({ success: true }, { status: 201 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
