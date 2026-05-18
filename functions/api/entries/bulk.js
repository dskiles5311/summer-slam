import { createClient } from '@libsql/client/web';
import { checkAuth } from '../_auth.js';

function getDb(env) {
  return createClient({
    url:       env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
}

// POST /api/entries/bulk — insert an array of entries atomically
export async function onRequestPost({ request, env }) {
  if (!checkAuth(request, env)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = getDb(env);
    const { entries } = await request.json();
    if (!Array.isArray(entries) || entries.length === 0) {
      return Response.json({ error: 'entries array is required' }, { status: 400 });
    }
    const t = v => (v ?? '').trim();
    const stmts = entries.map(body => ({
      sql: `INSERT INTO entries
              (boater_first, boater_last, boater_suffix, boater_phone, boater_email,
               co_angler_first, co_angler_last, co_angler_suffix, co_angler_phone, co_angler_email,
               boat_no, num_fish, lunker_weight, total_weight,
               lunker, option_field, paid, app_signed, buy_in,
               raw_weight, dead_fish, short_fish, needs_attention,
               weighed_at, signed_up_at, checked_in_at, off_water_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        t(body.boaterFirst),   t(body.boaterLast),   t(body.boaterSuffix ?? ''),   t(body.boaterPhone),   t(body.boaterEmail),
        t(body.coAnglerFirst), t(body.coAnglerLast), t(body.coAnglerSuffix ?? ''), t(body.coAnglerPhone), t(body.coAnglerEmail),
        t(body.boatNo),
        Number(body.numFish)      || 0,
        Number(body.lunkerWeight) || 0,
        Number(body.totalWeight)  || 0,
        body.lunker    === '' ? null : Number(body.lunker    ?? 0),
        body.option    === '' ? null : Number(body.option    ?? 0),
        body.paid      === '' ? null : Number(body.paid      ?? 0),
        body.appSigned === '' ? null : Number(body.appSigned ?? 0),
        Number(body.buyIn) || 0,
        body.rawWeight != null ? Number(body.rawWeight) : null,
        Number(body.deadFish)  || 0,
        Number(body.shortFish) || 0,
        body.needsAttention ? 1 : 0,
        body.weighedAt   ?? null,
        body.signedUpAt  ?? null,
        body.checkedInAt ?? null,
        body.offWaterAt  ?? null,
      ],
    }));

    await db.batch(stmts, 'write');
    return Response.json({ ok: true, count: entries.length });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
