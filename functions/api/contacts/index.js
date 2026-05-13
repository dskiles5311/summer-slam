import { createClient } from '@libsql/client/web';
import { checkAuth } from '../_auth.js';

function getDb(env) {
  return createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
}

function formatPhone(raw) {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 7)  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length === 6)  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return raw || '';
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
        sql: `SELECT id, first_name, last_name, phone, email, last_seen FROM contacts
              WHERE first_name LIKE ? OR last_name LIKE ? OR (first_name || ' ' || last_name) LIKE ? OR phone LIKE ?
              ORDER BY last_seen DESC LIMIT 10`,
        args: [like, like, like, like],
      });
    } else {
      result = await db.execute(
        `SELECT id, first_name, last_name, phone, email, last_seen FROM contacts ORDER BY last_name ASC, first_name ASC`
      );
    }
    return Response.json(result.rows.map(r => ({
      id:        Number(r.id),
      firstName: r.first_name,
      lastName:  r.last_name,
      phone:     r.phone || '',
      email:     r.email || '',
      lastSeen:  r.last_seen || null,
    })));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  if (!checkAuth(request, env)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db        = getDb(env);
    const body      = await request.json();
    const firstName    = (body.firstName    ?? '').trim();
    const lastName     = (body.lastName     ?? '').trim();
    const phone        = formatPhone((body.phone ?? '').trim());
    const email        = (body.email ?? '').trim();
    const oldFirstName = (body.oldFirstName ?? '').trim();
    const oldLastName  = (body.oldLastName  ?? '').trim();
    if (!firstName || !lastName) return Response.json({ error: 'firstName and lastName required' }, { status: 400 });

    // If old names differ from new names, rename the existing contact instead of creating an orphan
    if (oldFirstName && oldLastName && (oldFirstName !== firstName || oldLastName !== lastName)) {
      const old = await db.execute({
        sql:  `SELECT id, phone, email FROM contacts WHERE first_name = ? AND last_name = ? COLLATE NOCASE ORDER BY last_seen DESC LIMIT 1`,
        args: [oldFirstName, oldLastName],
      });
      if (old.rows.length > 0) {
        const oldRow   = old.rows[0];
        const newPhone = phone !== '' ? phone : (oldRow.phone || '');
        const newEmail = email !== '' ? email : (oldRow.email || '');
        await db.execute({
          sql:  `UPDATE contacts SET first_name=?, last_name=?, phone=?, email=?, last_seen=CURRENT_TIMESTAMP WHERE id=?`,
          args: [firstName, lastName, newPhone, newEmail, Number(oldRow.id)],
        });
        return Response.json({ success: true }, { status: 201 });
      }
    }

    const existing = await db.execute({
      sql:  `SELECT id, phone, email FROM contacts WHERE first_name = ? AND last_name = ? COLLATE NOCASE ORDER BY last_seen DESC LIMIT 1`,
      args: [firstName, lastName],
    });

    if (existing.rows.length > 0) {
      const row      = existing.rows[0];
      const newPhone = phone !== '' ? phone : (row.phone || '');
      const newEmail = email !== '' ? email : (row.email || '');
      await db.execute({
        sql:  `UPDATE OR IGNORE contacts SET phone=?, email=?, last_seen=CURRENT_TIMESTAMP WHERE id=?`,
        args: [newPhone, newEmail, Number(row.id)],
      });
    } else {
      await db.execute({
        sql:  `INSERT OR IGNORE INTO contacts (first_name, last_name, phone, email, last_seen) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        args: [firstName, lastName, phone, email],
      });
    }

    return Response.json({ success: true }, { status: 201 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
