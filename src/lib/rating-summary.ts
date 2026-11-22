export function summarizeRatings(rows: Iterable<{ movieId: number; value: number; count: number }>) {
  const summaries = new Map<number, { average: number; count: number; sum: number; dist: Record<string, number> }>();
  for (const row of rows) {
    let summary = summaries.get(row.movieId);
    if (!summary) {
      summary = { average: 0, count: 0, sum: 0, dist: {} };
      summaries.set(row.movieId, summary);
    }
    summary.count += row.count;
    summary.sum += row.value * row.count;
    const key = String(row.value);
    summary.dist[key] = (summary.dist[key] || 0) + row.count;
  }
  for (const summary of summaries.values()) {
    summary.average = summary.count ? Math.round(summary.sum / summary.count * 10) / 10 : 0;
  }
  return summaries;
}
