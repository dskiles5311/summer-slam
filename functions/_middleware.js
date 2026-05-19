export async function onRequest(context) {
  if (new URL(context.request.url).pathname.startsWith('/api/')) {
    return context.next();
  }
  return context.env.ASSETS.fetch(context.request);
}
