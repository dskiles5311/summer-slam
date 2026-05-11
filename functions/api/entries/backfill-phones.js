import { createClient } from '@libsql/client/web';
import { checkAuth } from '../_auth.js';

function getDb(env) {
  return createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
}

export async function onRequestPost({ request, env }) {
  if (!checkAuth(request, env)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = getDb(env);

    const boaterResult = await db.execute(`
      UPDATE entries
      SET boater_phone = (
        SELECT phone FROM contacts
        WHERE first_name = entries.boater_first COLLATE NOCASE
          AND last_name  = entries.boater_last  COLLATE NOCASE
          AND phone != ''
        ORDER BY last_seen DESC
        LIMIT 1
      )
      WHERE (boater_phone IS NULL OR boater_phone = '')
        AND boater_first != ''
        AND boater_last  != ''
        AND EXISTS (
          SELECT 1 FROM contacts
          WHERE first_name = entries.boater_first COLLATE NOCASE
            AND last_name  = entries.boater_last  COLLATE NOCASE
            AND phone != ''
        )
    `);

    const coAnglerResult = await db.execute(`
      UPDATE entries
      SET co_angler_phone = (
        SELECT phone FROM contacts
        WHERE first_name = entries.co_angler_first COLLATE NOCASE
          AND last_name  = entries.co_angler_last  COLLATE NOCASE
          AND phone != ''
        ORDER BY last_seen DESC
        LIMIT 1
      )
      WHERE (co_angler_phone IS NULL OR co_angler_phone = '')
        AND co_angler_first != ''
        AND co_angler_last  != ''
        AND EXISTS (
          SELECT 1 FROM contacts
          WHERE first_name = entries.co_angler_first COLLATE NOCASE
            AND last_name  = entries.co_angler_last  COLLATE NOCASE
            AND phone != ''
        )
    `);

    return Response.json({
      boaterCount:   boaterResult.rowsAffected,
      coAnglerCount: coAnglerResult.rowsAffected,
      total:         boaterResult.rowsAffected + coAnglerResult.rowsAffected,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
