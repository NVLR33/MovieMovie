export type CinemaSpace = "discover" | "library" | "together";
const library = new Set(["profile", "watchlist", "favorites", "wrapped"]);
const together = new Set([
  "collab",
  "friends",
  "chat",
  "leaderboard",
  "games",
  "achievements",
  "challenges",
  "watchroom",
  "room",
  "viewuser",
  "compare",
]);
export function cinemaSpace(page: string): CinemaSpace {
  return library.has(page)
    ? "library"
    : together.has(page)
      ? "together"
      : "discover";
}
export function previewMovieId(href: string): number | null {
  const match = /^\/movie\/([1-9]\d*)$/.exec(href);
  const id = match ? Number(match[1]) : 0;
  return Number.isSafeInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}
