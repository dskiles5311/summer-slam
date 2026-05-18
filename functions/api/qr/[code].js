import { createClient } from '@libsql/client/web';

const VALID_CODES = ['rules', 'off-limits'];
const REDIRECT_URL = 'https://sft-summer-slam.pages.dev/';

function getDb(env) {
  return createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
}

export async function onRequestGet({ env, params }) {
  const code = params.code;
  if (!VALID_CODES.includes(code)) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const db = getDb(env);
    await db.execute({
      sql: 'INSERT INTO event_log (event_type, value) VALUES (?, ?)',
      args: ['qr_scan', code],
    });
  } catch (_) {
    // Don't fail the redirect if logging errors
  }

  return new Response(null, {
    status: 302,
    headers: { Location: REDIRECT_URL },
  });
}
