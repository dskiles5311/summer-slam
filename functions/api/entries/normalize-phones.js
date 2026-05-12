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

export async function onRequestPost({ request, env }) {
  if (!checkAuth(request, env)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = getDb(env);
    let entriesUpdated = 0;
    let contactsUpdated = 0;

    const entries = await db.execute('SELECT id, boater_phone, co_angler_phone FROM entries');
    for (const row of entries.rows) {
      const origBp = row.boater_phone    ?? '';
      const origCp = row.co_angler_phone ?? '';
      const bp = formatPhone(origBp);
      const cp = formatPhone(origCp);
      if (bp !== origBp || cp !== origCp) {
        await db.execute({
          sql:  'UPDATE entries SET boater_phone=?, co_angler_phone=? WHERE id=?',
          args: [bp, cp, Number(row.id)],
        });
        entriesUpdated++;
      }
    }

    const contacts = await db.execute('SELECT id, phone FROM contacts');
    for (const row of contacts.rows) {
      const origP = row.phone ?? '';
      const p = formatPhone(origP);
      if (p !== origP) {
        await db.execute({
          sql:  'UPDATE OR IGNORE contacts SET phone=? WHERE id=?',
          args: [p, Number(row.id)],
        });
        contactsUpdated++;
      }
    }

    return Response.json({ entriesUpdated, contactsUpdated, total: entriesUpdated + contactsUpdated });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
