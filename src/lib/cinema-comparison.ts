export type ComparisonRating = {
  movieId: number;
  value: number;
  title?: string;
};
export type ComparisonPair = {
  movieId: number;
  title: string;
  my: number;
  their: number;
  gap: number;
  agreement: boolean;
};
/** Only explicit positive ratings on both sides are compared; no inferred tastes. */
export function compareCinemaRatings(
  mine: readonly ComparisonRating[],
  theirs: readonly ComparisonRating[],
): ComparisonPair[] {
  const own = new Map(
    mine
      .filter((r) => Number.isFinite(r.value) && r.value > 0)
      .map((r) => [r.movieId, r.value]),
  );
  const seen = new Set<number>();
  return theirs
    .flatMap((r) => {
      if (
        seen.has(r.movieId) ||
        !own.has(r.movieId) ||
        !Number.isFinite(r.value) ||
        r.value <= 0
      )
        return [];
      seen.add(r.movieId);
      const my = own.get(r.movieId)!,
        gap = Math.abs(my - r.value);
      return [
        {
          movieId: r.movieId,
          title: r.title || 'История #' + r.movieId,
          my,
          their: r.value,
          gap,
          agreement: gap <= 1 && my >= 8 && r.value >= 8,
        },
      ];
    })
    .sort((a, b) => b.gap - a.gap || a.movieId - b.movieId);
}
