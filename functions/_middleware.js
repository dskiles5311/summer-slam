export async function onRequest(context) {
  if (new URL(context.request.url).pathname.startsWith('/api/')) {
    return context.next();
  }
  // Try ASSETS binding; if unavailable, fall through to CF Pages static asset serving
  try {
    return await context.env.ASSETS.fetch(context.request.url);
  } catch {
    return context.next();
  }
}
