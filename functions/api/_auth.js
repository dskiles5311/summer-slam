export function checkAuth(request, env) {
  if (!env.ADMIN_PASSWORD) return true;
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return token === env.ADMIN_PASSWORD;
}
