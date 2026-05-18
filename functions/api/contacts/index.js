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
      const digits = q.replace(/\D/g, '');
      const useDigits = digits.length >= 2;
      result = await db.execute({
        sql: `SELECT id, first_name, last_name, phone, email, last_seen FROM contacts
              WHERE first_name LIKE ? OR last_name LIKE ? OR (first_name || ' ' || last_name) LIKE ? OR phone LIKE ?${useDigits ? ` OR REPLACE(phone, '-', '') LIKE ?` : ''}
              ORDER BY last_seen DESC LIMIT 10`,
        args: useDigits ? [like, like, like, like, `%${digits}%`] : [like, like, like, like],
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
      suffix:    r.suffix || '',
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
    const suffix       = (body.suffix       ?? '').trim();
    const phone        = formatPhone((body.phone ?? '').trim());
    const email        = (body.email ?? '').trim();
    const oldFirstName = (body.oldFirstName ?? '').trim();
    const oldLastName  = (body.oldLastName  ?? '').trim();
    const contactId    = body.contactId ? Number(body.contactId) : null;
    if (!firstName || !lastName) return Response.json({ error: 'firstName and lastName required' }, { status: 400 });

    // If the caller knows exactly which contact to update (selected from autofill), update by ID
    if (contactId) {
      const row = await db.execute({ sql: `SELECT id, phone, email FROM contacts WHERE id = ?`, args: [contactId] });
      if (row.rows.length > 0) {
        const existing = row.rows[0];
        const newPhone = phone !== '' ? phone : (existing.phone || '');
        const newEmail = email !== '' ? email : (existing.email || '');
        await db.execute({
          sql:  `UPDATE contacts SET first_name=?, last_name=?, suffix=?, phone=?, email=?, last_seen=CURRENT_TIMESTAMP WHERE id=?`,
          args: [firstName, lastName, suffix, newPhone, newEmail, contactId],
        });
        return Response.json({ success: true }, { status: 201 });
      }
    }

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
          sql:  `UPDATE contacts SET first_name=?, last_name=?, suffix=?, phone=?, email=?, last_seen=CURRENT_TIMESTAMP WHERE id=?`,
          args: [firstName, lastName, suffix, newPhone, newEmail, Number(oldRow.id)],
        });
        return Response.json({ success: true }, { status: 201 });
      }
    }

    if (phone) {
      await db.execute({
        sql: `INSERT INTO contacts (first_name, last_name, suffix, phone, email, last_seen)
              VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(first_name, last_name, suffix, phone) DO UPDATE SET
                email     = CASE WHEN excluded.email != '' THEN excluded.email ELSE contacts.email END,
                last_seen = CURRENT_TIMESTAMP`,
        args: [firstName, lastName, suffix, phone, email],
      });
    } else {
      const existing = await db.execute({
        sql:  `SELECT id, email FROM contacts WHERE first_name = ? AND last_name = ? AND suffix = ? COLLATE NOCASE ORDER BY last_seen DESC LIMIT 1`,
        args: [firstName, lastName, suffix],
      });
      if (existing.rows.length > 0) {
        const row      = existing.rows[0];
        const newEmail = email !== '' ? email : (row.email || '');
        await db.execute({
          sql:  `UPDATE contacts SET email=?, last_seen=CURRENT_TIMESTAMP WHERE id=?`,
          args: [newEmail, Number(row.id)],
        });
      } else {
        await db.execute({
          sql:  `INSERT OR IGNORE INTO contacts (first_name, last_name, suffix, phone, email, last_seen) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          args: [firstName, lastName, suffix, '', email],
        });
      }
    }

    return Response.json({ success: true }, { status: 201 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
