export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  if (!env.ADMIN_PASSWORD) return Response.json({ ok: true });
  if (body.password !== env.ADMIN_PASSWORD) {
    return Response.json({ error: 'Invalid password' }, { status: 401 });
  }
  return Response.json({ ok: true });
}
