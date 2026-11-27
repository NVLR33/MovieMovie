export const STATIC_SITE_ROUTES = ['catalog', 'showtimes', 'world', 'top', 'profile', 'watchlist', 'favorites', 'leaderboard', 'achievements', 'challenges', 'games', 'friends', 'wrapped', 'collab', 'watchroom', 'chat', 'admin', 'about-admin'] as const;
export function resolveSiteRoute(pathname: string) {
  const parts = pathname.replace(/^\/|\/$/g, '').split('/').filter(Boolean);
  if (!parts.length) return { page: 'home' };
  if (parts.length === 1 && STATIC_SITE_ROUTES.some(route => route === parts[0])) return { page: parts[0] };
  if (parts.length === 2 && ['movie', 'user', 'compare'].includes(parts[0]) && /^[1-9]\d*$/.test(parts[1]) && Number(parts[1]) <= 2147483647) {
    return { page: parts[0] === 'user' ? 'viewuser' : parts[0], id: Number(parts[1]) };
  }
  if (parts.length === 2 && parts[0] === 'room' && /^[a-zA-Z0-9_-]{4,64}$/.test(parts[1])) return { page: 'room', roomId: parts[1] };
  return null;
}
