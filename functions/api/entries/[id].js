import { createClient } from '@libsql/client/web';

function getDb(env) {
  return createClient({
    url:       env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
}

function toJS(row) {
  return {
    id:            Number(row.id),
    boaterFirst:   row.boater_first   ?? '',
    boaterLast:    row.boater_last    ?? '',
    coAnglerFirst: row.co_angler_first ?? '',
    coAnglerLast:  row.co_angler_last  ?? '',
    boatNo:        row.boat_no        ?? '',
    numFish:       row.num_fish       ?? 0,
    lunkerWeight:  row.lunker_weight  ?? 0,
    totalWeight:   row.total_weight   ?? 0,
    lunker:        row.lunker         ?? 0,
    option:        row.option_field   ?? 0,
    paid:          row.paid           ?? 0,
    appSigned:     row.app_signed     ?? 0,
    buyIn:         row.buy_in         ?? 0,
  };
}

export async function onRequestPut({ params, request, env }) {
  try {
    const db   = getDb(env);
    const body = await request.json();

    await db.execute({
      sql: `UPDATE entries SET
              boater_first=?, boater_last=?, co_angler_first=?, co_angler_last=?,
              boat_no=?, num_fish=?, lunker_weight=?, total_weight=?,
              lunker=?, option_field=?, paid=?, app_signed=?, buy_in=?
            WHERE id=?`,
      args: [
        body.boaterFirst   ?? '', body.boaterLast    ?? '',
        body.coAnglerFirst ?? '', body.coAnglerLast  ?? '',
        body.boatNo        ?? '',
        Number(body.numFish)      || 0,
        Number(body.lunkerWeight) || 0,
        Number(body.totalWeight)  || 0,
        body.lunker    === '' ? null : Number(body.lunker),
        body.option    === '' ? null : Number(body.option),
        body.paid      === '' ? null : Number(body.paid),
        body.appSigned === '' ? null : Number(body.appSigned),
        Number(body.buyIn) || 0,
        params.id,
      ],
    });

    const updated = await db.execute({
      sql:  'SELECT * FROM entries WHERE id = ?',
      args: [params.id],
    });
    return Response.json(toJS(updated.rows[0]));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function onRequestDelete({ params, env }) {
  try {
    const db = getDb(env);
    await db.execute({ sql: 'DELETE FROM entries WHERE id = ?', args: [params.id] });
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
