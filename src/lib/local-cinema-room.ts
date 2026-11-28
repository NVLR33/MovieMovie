export function roomReference(
  value: string,
  origin: string,
): { code: string; movieId: number | null } | null {
  const text = value.trim();
  if (/^[a-zA-Z0-9_-]{4,64}$/.test(text)) return { code: text, movieId: null };
  try {
    const url = new URL(text, origin);
    if (url.origin !== new URL(origin).origin || url.username || url.password)
      return null;
    const match = url.pathname.match(/^\/room\/([a-zA-Z0-9_-]{4,64})\/?$/);
    if (!match) return null;
    const movie = Number(url.searchParams.get('movie'));
    return {
      code: match[1],
      movieId:
        Number.isSafeInteger(movie) && movie > 0 && movie <= 2147483647
          ? movie
          : null,
    };
  } catch {
    return null;
  }
}
export function localRoomPath(code: string, movieId?: number | null) {
  return `/room/${encodeURIComponent(code)}${movieId ? `?movie=${movieId}` : ''}`;
}
