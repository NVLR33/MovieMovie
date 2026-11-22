import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateUserTitleProgress, progressionTitle, titleCollection, userTitleOptions, type TitleFilm, type UserTitleProgress } from '../src/lib/user-titles';

const zero: UserTitleProgress = { watches: 0, marvel: 0, marvelTotal: 0, festival: 0, spoilers: 0 };
const film = (id: number, extra: Partial<TitleFilm> = {}): TitleFilm => ({ id, category: 'Фильм', ...extra });

test('preserves original four title names and extends progression to 100, 250 and 500 titles', () => {
  assert.equal(progressionTitle(0), 'Начинающий зритель');
  assert.equal(progressionTitle(5), 'Киноискатель');
  assert.equal(progressionTitle(15), 'Мастер кадров');
  assert.equal(progressionTitle(30), 'Легенда экрана');
  assert.equal(progressionTitle(100), 'Кинознаток');
  assert.equal(progressionTitle(250), 'Архивариус кино');
  assert.equal(progressionTitle(500), 'Хранитель киновселенной');
});

test('viewer and festival progression count distinct existing titles, not toggles or duplicates', () => {
  const result = calculateUserTitleProgress({ films: [film(1, { festivalRecognized: true }), film(2, { festivalRecognized: true, category: 'Сериал' })], watches: [{ movieId: 1 }, { movieId: 1 }, { movieId: 2 }, { movieId: 999 }], ratings: [], comments: [] });
  assert.equal(result.watches, 2);
  assert.equal(result.festival, 1);
});

test('Marvel uses explicit editorial franchise metadata, movies only, and every rating must be 10', () => {
  const films = [film(1, { franchise: ' Marvel ' }), film(2, { franchise: 'marvel' }), film(3, { franchise: 'Marvel' }), film(4), film(5, { franchise: 'Marvel', category: 'Сериал' })];
  const input = { films, watches: [], comments: [], ratings: [{ movieId: 1, value: 10 }, { movieId: 2, value: 10 }, { movieId: 3, value: 9.5 }, { movieId: 4, value: 10 }] };
  const before = calculateUserTitleProgress(input);
  assert.equal(before.marvelTotal, 3);assert.equal(before.marvel, 2);
  assert.equal(userTitleOptions(before).find(title => title.id === 'marvel_advocate')?.unlocked, false);
  const after = calculateUserTitleProgress({ ...input, ratings: input.ratings.map(rating => ({ ...rating, value: 10 })) });
  assert.equal(userTitleOptions(after).find(title => title.id === 'marvel_advocate')?.unlocked, true);
});

test('empty/single-film Marvel catalogs never satisfy the all-franchise title', () => {
  for (const total of [0, 1, 2]) assert.equal(userTitleOptions({ ...zero, marvel: total, marvelTotal: total }).find(title => title.id === 'marvel_advocate')?.unlocked, false);
});

test('festival title opens at 50 unique marked films, not 49', () => {
  assert.equal(userTitleOptions({ ...zero, festival: 49 }).find(title => title.id === 'arthouse_king')?.unlocked, false);
  assert.equal(userTitleOptions({ ...zero, festival: 50 }).find(title => title.id === 'arthouse_king')?.unlocked, true);
});

test('spoiler reviews require 80 characters, distinct materials, a real spoiler tag and no parent', () => {
  const result = calculateUserTitleProgress({ films: [film(1), film(2), film(3), film(4)], watches: [], ratings: [], comments: [
    { movieId: 1, body: 'я'.repeat(80), parentId: null, spoiler: true },
    { movieId: 1, body: 'я'.repeat(100), parentId: null, spoiler: true },
    { movieId: 2, body: 'я'.repeat(79), parentId: null, spoiler: true },
    { movieId: 3, body: 'я'.repeat(80), parentId: 1, spoiler: true },
    { movieId: 4, body: 'я'.repeat(80), parentId: null, spoiler: false },
  ] });
  assert.equal(result.spoilers, 1);
  assert.equal(userTitleOptions({ ...zero, spoilers: 9 }).find(title => title.id === 'serial_spoiler')?.unlocked, false);
  assert.equal(userTitleOptions({ ...zero, spoilers: 10 }).find(title => title.id === 'serial_spoiler')?.unlocked, true);
});

test('earned titles remain unlocked after history, ratings or catalog changes', () => {
  const collection = titleCollection(zero, ['marvel_advocate', 'arthouse_king', 'seeker'], 'marvel_advocate');
  assert.equal(collection.active?.name, 'Адвокат Marvel');
  assert.equal(collection.options.find(title => title.id === 'arthouse_king')?.earned, true);
  assert.equal(collection.options.find(title => title.id === 'seeker')?.unlocked, true);
});

test('automatic mode picks the highest viewer rank, not a special title', () => {
  const collection = titleCollection({ ...zero, watches: 100, spoilers: 10 }, [], null);
  assert.equal(collection.active?.id, 'connoisseur');
});

test('locked or fabricated choices do not render; none hides the title', () => {
  for (const id of ['marvel_advocate', '<script>', '__proto__', 'admin']) assert.equal(titleCollection(zero, [], id).active?.id, 'beginner');
  assert.equal(titleCollection({ ...zero, watches: 500 }, [], 'none').active, null);
});
