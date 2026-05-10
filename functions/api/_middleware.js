export async function onRequest({ next }) {
  const response = await next();
  const cloned = response.clone();
  const headers = new Headers(cloned.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(cloned.body, { status: cloned.status, statusText: cloned.statusText, headers });
}
