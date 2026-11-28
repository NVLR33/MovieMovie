import type { CinemaShowing } from "./showtimes";
export type ScreeningGroup = {
  title: string;
  venues: Map<
    string,
    { name: string; address: string; shows: CinemaShowing[] }
  >;
};
/** Group provider IDs, not potentially duplicate translated titles. Never modify the snapshot. */
export function groupCinemaShowings(
  showings: readonly CinemaShowing[],
  search = "",
  cinema = "",
) {
  const groups = new Map<number, ScreeningGroup>(),
    query = search.trim().toLocaleLowerCase();
  for (const show of showings) {
    if (cinema && show.cinema !== cinema) continue;
    if (
      query &&
      !`${show.movie} ${show.cinema}`.toLocaleLowerCase().includes(query)
    )
      continue;
    let group = groups.get(show.movieId);
    if (!group) {
      group = { title: show.movie, venues: new Map() };
      groups.set(show.movieId, group);
    }
    const key = JSON.stringify([show.cinema, show.address]);
    let venue = group.venues.get(key);
    if (!venue) {
      venue = { name: show.cinema, address: show.address, shows: [] };
      group.venues.set(key, venue);
    }
    venue.shows.push(show);
  }
  for (const movie of groups.values())
    for (const venue of movie.venues.values())
      venue.shows.sort(
        (a, b) =>
          Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id - b.id,
      );
  return [...groups.entries()];
}
/** A selection, not a worldwide coverage estimate; a co-production counts in each listed country. */
export function atlasDestinations<T>(
  index: { byCountry: ReadonlyMap<string, readonly T[]> },
  limit = 6,
) {
  return [...index.byCountry]
    .map(([code, films]) => ({ code, count: films.length }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
    .slice(0, Math.max(0, limit));
}
