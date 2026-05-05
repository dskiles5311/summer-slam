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

export async function onRequestGet({ env }) {
  try {
    const db = getDb(env);
    const result = await db.execute('SELECT * FROM entries ORDER BY total_weight DESC, id ASC');
    return Response.json(result.rows.map(toJS));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const db   = getDb(env);
    const body = await request.json();

    const result = await db.execute({
      sql: `INSERT INTO entries
              (boater_first, boater_last, co_angler_first, co_angler_last,
               boat_no, num_fish, lunker_weight, total_weight,
               lunker, option_field, paid, app_signed, buy_in)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      ],
    });

    const newRow = await db.execute({
      sql:  'SELECT * FROM entries WHERE id = ?',
      args: [Number(result.lastInsertRowid)],
    });
    return Response.json(toJS(newRow.rows[0]), { status: 201 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
