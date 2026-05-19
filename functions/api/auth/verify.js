export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  if (!env.ADMIN_PASSWORD) return Response.json({ error: 'Server misconfigured' }, { status: 500 });
  if (body.password === env.ADMIN_PASSWORD) {
    return Response.json({ ok: true, level: 'admin' });
  }
  if (env.OPERATOR_PASSWORD && body.password === env.OPERATOR_PASSWORD) {
    return Response.json({ ok: true, level: 'operator' });
  }
  await new Promise(r => setTimeout(r, 1500));
  return Response.json({ error: 'Invalid password' }, { status: 401 });
}
