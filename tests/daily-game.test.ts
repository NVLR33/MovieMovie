import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDailyGame } from '../src/lib/daily-game';

const now = new Date('2026-11-22T12:00:00Z');
const films = [{ id: 1, title: 'Интерстеллар', year: 2014 }, { id: 2, title: 'Начало', year: 2010 }, { id: 3, title: 'Дюна', year: 2021 }];

test('daily game has exactly four distinct answers and one correct real catalog year', () => {
  const question = createDailyGame(films, now)!;
  assert.equal(question.options.length, 4);
  assert.equal(new Set(question.options).size, 4);
  assert.equal(question.options.filter(o => o === question.correct).length, 1);
  assert.equal(Number(question.correct), films.find(f => f.id === question.movieId)!.year);
  assert.equal(question.date, '2026-11-22');
});

test('question and shuffled options are stable all UTC day and independent of query order', () => {
  const before = structuredClone(films);
  assert.deepEqual(createDailyGame(films, now), createDailyGame([...films].reverse(), new Date('2026-11-22T23:59:59Z')));
  assert.deepEqual(createDailyGame(films, now), createDailyGame(films, new Date('2026-11-23T04:59:59+05:00')));
  assert.deepEqual(films, before);
});

test('the next UTC day rotates to another question', () => {
  const next = createDailyGame(films, new Date('2026-11-23T00:00:00Z'))!;
  assert.notEqual(next.id, createDailyGame(films, now)!.id);
  assert.notEqual(next.movieId, createDailyGame(films, now)!.movieId);
});

test('small catalogs still get four choices, and earliest/current years stay plausible', () => {
  for (const year of [1888, 2026]) {
    const question = createDailyGame([{ id: 1, title: 'Фильм', year }], now)!;
    assert.equal(question.options.length, 4);
    assert(question.options.every(o => Number(o) >= 1888 && Number(o) <= 2026));
  }
});

test('empty catalogs, invalid years, unreleased films and missing titles fail gracefully', () => {
  assert.equal(createDailyGame([], now), null);
  assert.equal(createDailyGame([{ id: 1, title: ' ', year: 2020 }, { id: 2, title: 'Будущее', year: 2027 }, { id: 3, title: 'Нет года', year: NaN }], now), null);
  assert.equal(createDailyGame(films, new Date('invalid')), null);
});
