import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMemories,
  filterMemories,
  memoryDepth,
  memoryMonthLabel,
  type MemoryFilm,
  type MemoryReview,
} from '../src/lib/memory-orbit';
const films: MemoryFilm[] = [1, 2, 3, 4].map((id) => ({
  id,
  title: `Кино ${id}`,
  poster: '',
  year: 2020,
  category: 'Фильм',
}));
const watches = [
  { movieId: 1, watchedAt: '2026-01-31T23:30:00Z' },
  { movieId: 2, watchedAt: '2026-02-01T01:00:00+03:00' },
  { movieId: 3, watchedAt: 'bad-date' },
  { movieId: 4, watchedAt: '2026-02-05T01:00:00Z' },
];
test('history is newest first, deduplicated, UTC-grouped and never invents repeat sessions', () => {
  const entries = buildMemories(
    films,
    [
      ...watches,
      { movieId: 1, watchedAt: '2026-02-03T00:00Z' },
      { movieId: 99, watchedAt: '2026-02-10Z' },
    ],
    [],
    [],
    1,
  );
  assert.deepEqual(
    entries.map((e) => e.film.id),
    [4, 1, 2, 3],
  );
  assert.equal(entries[2].month, '2026-01');
  assert.equal(entries[3].month, 'undated');
  assert.equal(entries[3].timestamp, null);
  assert.equal(entries.length, 4);
  assert(memoryMonthLabel('2026-02').includes('2026'));
  assert.equal(memoryMonthLabel('undated'), 'Дата не указана');
});
test('only personal 10/10 is classic; low ratings are 0.5–4, missing/invalid stay neutral', () => {
  const entries = buildMemories(
    films,
    watches,
    [
      { movieId: 1, value: 10 },
      { movieId: 2, value: 4 },
      { movieId: 3, value: NaN },
      { movieId: 4, value: 9.5 },
    ],
    [],
    1,
  );
  assert.equal(entries.find((e) => e.film.id === 1)?.kind, 'classic');
  assert.equal(entries.find((e) => e.film.id === 2)?.kind, 'muted');
  assert.equal(entries.find((e) => e.film.id === 3)?.rating, null);
  assert.equal(entries[0].kind, 'neutral');
  for (const score of [0, 11, 8.2, Infinity])
    assert.equal(
      buildMemories(films, watches, [{ movieId: 1, value: score }], [], 1).find(
        (e) => e.film.id === 1,
      )?.kind,
      'neutral',
    );
  assert.equal(
    buildMemories(films, watches, [{ movieId: 1, value: 0.5 }], [], 1).find(
      (e) => e.film.id === 1,
    )?.kind,
    'muted',
  );
});
test('month/classic filters compose without changing original ordering/data', () => {
  const all = buildMemories(
    films,
    watches,
    [
      { movieId: 1, value: 10 },
      { movieId: 4, value: 10 },
    ],
    [],
    1,
  );
  assert.deepEqual(
    filterMemories(all, '2026-01', true).map((e) => e.film.id),
    [1],
  );
  assert.equal(filterMemories(all, '2027-01', false).length, 0);
  assert.equal(filterMemories(all, '', true).length, 2);
  assert.equal(all.length, 4);
});
test('memory uses newest own root review, never someone else’s review or a reply', () => {
  const review = (
    id: number,
    author: number,
    parentId: number | null,
    createdAt: string,
  ): MemoryReview => ({
    id,
    movieId: 1,
    author: { id: author },
    parentId,
    createdAt,
    body: `review-${id}`,
    spoiler: true,
  });
  const comments = [
    review(1, 1, null, '2026-01-01Z'),
    review(2, 2, null, '2026-02-01Z'),
    review(3, 1, 1, '2026-03-01Z'),
    review(4, 1, null, '2026-01-10Z'),
  ];
  const entry = buildMemories(films, watches, [], comments, 1).find(
    (e) => e.film.id === 1,
  )!;
  assert.equal(entry.review?.id, 4);
  assert.equal(entry.review?.spoiler, true);
  assert.equal(
    buildMemories(films, watches, [], comments, 5).find((e) => e.film.id === 1)
      ?.review,
    null,
  );
});
test('depth is bounded and smaller on mobile, stable slots prevent measurement feedback', () => {
  const far = memoryDepth(-2000, 1000, false),
    mobile = memoryDepth(-2000, 1000, true),
    center = memoryDepth(520, 1000, false);
  assert.equal(far.z, -145);
  assert.equal(mobile.z, -48);
  assert(Math.abs(center.z) < 0.001);
  assert(Math.abs(center.tilt) < 0.001);
  assert(Number.isFinite(memoryDepth(0, 0, false).z));
  assert(memoryDepth(1200, 1000, false).tilt < 0);
});
test('empty history and orphan watches are safe', () => {
  assert.deepEqual(buildMemories(films, [], [], [], 1), []);
  assert.deepEqual(buildMemories([], watches, [], [], 1), []);
});
