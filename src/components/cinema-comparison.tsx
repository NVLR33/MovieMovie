'use client';

import { useState, type ReactNode } from 'react';
import { ArrowUpRight, Heart, Search, Sparkles, Zap } from 'lucide-react';
import {
  compareCinemaRatings,
  type ComparisonRating,
} from '@/lib/cinema-comparison';
import type { Film } from '@/lib/data';
import { CommunityNavigation } from './community-cinema';
import { useJsonResource } from './use-json-resource';
import type { CommunityPerson } from '@/lib/community-directory';

type ComparisonProfile = {
  profile: CommunityPerson;
  ratings: ComparisonRating[];
  commonFilms: number;
  compatibility: number;
};
export default function CinemaComparison({
  viewer,
  compareId,
  ratings,
  films,
  go,
  avatar,
  poster,
}: {
  viewer: CommunityPerson;
  compareId: number;
  ratings: ComparisonRating[];
  films: Film[];
  go: (href: string) => void;
  avatar: (person: CommunityPerson, size: number) => ReactNode;
  poster: (film: Film) => ReactNode;
}) {
  const [snapshot, reload, status] = useJsonResource<ComparisonProfile>(
    '/api/profile?id=' + compareId,
  );
  const [scope, setScope] = useState<'all' | 'disputes' | 'agreements'>('all'),
    [query, setQuery] = useState('');
  if (!snapshot?.profile)
    return (
      <div className="cinema-comparison">
        <CommunityNavigation active="profile" go={go} />
        <div className="empty-state" role={status.error ? 'alert' : 'status'}>
          <h1>
            {status.error
              ? 'Сравнение пока недоступно'
              : 'Собираем два взгляда…'}
          </h1>
          {status.error && (
            <>
              <p>Не удалось загрузить профиль участника.</p>
              <button type="button" className="outline-btn" onClick={reload}>
                Повторить
              </button>
              <button
                type="button"
                className="outline-btn"
                onClick={() => go('/friends')}
              >
                К зрителям
              </button>
            </>
          )}
        </div>
      </div>
    );
  const peer = snapshot.profile,
    pairs = compareCinemaRatings(ratings, snapshot.ratings),
    disputes = pairs.filter((p) => p.gap > 1),
    agreements = pairs.filter((p) => p.agreement),
    spotlight = pairs[0];
  const known = new Map(films.map((f) => [f.id, f]));
  const filtered = pairs.filter(
    (p) =>
      (scope === 'all' || (scope === 'disputes' ? p.gap > 1 : p.agreement)) &&
      (known.get(p.movieId)?.title || p.title)
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  const scores = (my: number, their: number) => (
    <div className="compare-scores">
      <div className="mine">
        <span>Ты</span>
        <b>{my.toLocaleString('ru-RU')}</b>
      </div>
      <div className="theirs">
        <span>Собеседник</span>
        <b>{their.toLocaleString('ru-RU')}</b>
      </div>
    </div>
  );
  return (
    <section className="cinema-comparison">
      <CommunityNavigation active="profile" go={go} />
      <button
        type="button"
        className="back-link"
        onClick={() => go('/user/' + compareId)}
      >
        ← Назад к профилю
      </button>
      <div className="cinema-comparison-stage">
        <header className="cinema-comparison-intro">
          <span className="eyebrow">ВМЕСТЕ / ДВА ВЗГЛЯДА</span>
          <h1>
            Одна история.
            <br />
            <em>Два послевкусия.</em>
          </h1>
          <p>
            Кино-Баттл без победителей. Посмотри, где вы совпали, а что хочется
            обсудить.
          </p>
          <div className="cinema-comparison-people">
            <div>
              {avatar(viewer, 56)}
              <b>{viewer.username}</b>
              <small>ты</small>
            </div>
            <span>×</span>
            <div>
              {avatar(peer, 56)}
              <b>{peer.username}</b>
              <small>другой взгляд</small>
            </div>
          </div>
          <div className="cinema-comparison-numbers">
            <div>
              <strong>{pairs.length}</strong>
              <span>общих оценок</span>
            </div>
            <div>
              <strong>{agreements.length}</strong>
              <span>любимых совпадений</span>
            </div>
            <div>
              <strong>{disputes.length}</strong>
              <span>поводов поспорить</span>
            </div>
          </div>
        </header>
        <aside className="cinema-comparison-spotlight">
          <span className="eyebrow">
            {spotlight ? 'ИСТОРИЯ ДЛЯ РАЗГОВОРА' : 'ЕЩЁ НЕ ПЕРЕСЕКЛИСЬ'}
          </span>
          {spotlight ? (
            <>
              <div className="cinema-comparison-feature">
                {known.has(spotlight.movieId) &&
                  poster(known.get(spotlight.movieId)!)}
                <div>
                  <h2>
                    {known.get(spotlight.movieId)?.title || spotlight.title}
                  </h2>
                  <p>
                    {spotlight.gap > 1
                      ? 'Максимальная разница среди ваших общих оценок. Хороший повод спросить: «Что ты в этом увидел?»'
                      : 'Ваши оценки близки. Иногда лучший разговор начинается с согласия.'}
                  </p>
                </div>
              </div>
              {scores(spotlight.my, spotlight.their)}
              {known.has(spotlight.movieId) && (
                <button
                  type="button"
                  className="outline-btn"
                  onClick={() => go('/movie/' + spotlight.movieId)}
                >
                  Вспомнить историю <ArrowUpRight size={16} />
                </button>
              )}
            </>
          ) : (
            <>
              <Sparkles size={32} />
              <h2>Первое совпадение впереди.</h2>
              <p>
                Здесь появятся только истории, которым вы оба поставили оценку.
                Просмотры сами по себе не заменяют мнение.
              </p>
              <button
                type="button"
                className="outline-btn"
                onClick={() => go('/catalog')}
              >
                Найти историю <ArrowUpRight size={16} />
              </button>
            </>
          )}
        </aside>
      </div>
      <section className="cinema-comparison-library" aria-label="Общие оценки">
        <header>
          <div>
            <span className="eyebrow">СРАВНИВАЙ, А НЕ СОРЕВНУЙСЯ</span>
            <h2>Между «нравится» и «почему?»</h2>
          </div>
          <span role="status">
            Показано {filtered.length} из {pairs.length}
          </span>
        </header>
        <div className="cinema-comparison-controls">
          <div role="group" aria-label="Взгляды на кино">
            {(
              [
                ['all', 'Все общие'],
                ['disputes', 'Главные споры'],
                ['agreements', 'Единодушие'],
              ] as const
            ).map(([id, label]) => (
              <button
                type="button"
                key={id}
                aria-pressed={scope === id}
                onClick={() => setScope(id)}
              >
                {id === 'disputes' ? (
                  <Zap size={15} />
                ) : id === 'agreements' ? (
                  <Heart size={15} />
                ) : (
                  <Sparkles size={15} />
                )}{' '}
                {label}
              </button>
            ))}
          </div>
          <label>
            <Search size={17} />
            <input
              aria-label="Найти общую историю"
              placeholder="Название общей истории…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        <p className="cinema-comparison-rule">
          Споры — разница больше 1 балла. Единодушие — обе оценки от 8, разница
          не больше 1. Порядок: сначала самая большая разница.
        </p>
        <div className="cinema-comparison-grid">
          {filtered.map((pair) => (
            <article className="compare-row" key={pair.movieId}>
              {known.has(pair.movieId) && poster(known.get(pair.movieId)!)}
              <div className="compare-info">
                <b>{known.get(pair.movieId)?.title || pair.title}</b>
                <small>
                  Разница:{' '}
                  {pair.gap.toLocaleString('ru-RU', {
                    maximumFractionDigits: 1,
                  })}{' '}
                  / 10
                </small>
              </div>
              {scores(pair.my, pair.their)}
              {known.has(pair.movieId) && (
                <button
                  type="button"
                  className="cinema-compare-open"
                  aria-label={
                    'Открыть ' + (known.get(pair.movieId)?.title || pair.title)
                  }
                  onClick={() => go('/movie/' + pair.movieId)}
                >
                  <ArrowUpRight size={18} />
                </button>
              )}
            </article>
          ))}
        </div>
        {!filtered.length && (
          <div className="empty-state">
            <h3>
              {pairs.length ? 'В этом кадре пока пусто' : 'Нет общих оценок'}
            </h3>
            <p>
              {pairs.length
                ? 'Попробуй другой раздел или название.'
                : 'Ваши личные оценки появятся здесь, когда вы оцените одни и те же истории.'}
            </p>
            {!!pairs.length && (
              <button
                type="button"
                className="outline-btn"
                onClick={() => {
                  setScope('all');
                  setQuery('');
                }}
              >
                Показать все общие
              </button>
            )}
          </div>
        )}
      </section>
    </section>
  );
}
