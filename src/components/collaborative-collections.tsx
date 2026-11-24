'use client';
/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from 'react';
import { Heart, Plus } from 'lucide-react';
import type { Film } from '@/lib/data';
type Action = (
  payload: Record<string, unknown>,
  success?: string,
) => Promise<boolean>;
type List = {
  id: number;
  title: string;
  items?: { id: number; movieId: number; votes: number | null; film?: Film }[];
};
function ListCard({
  list,
  films,
  go,
  action,
}: {
  list: List;
  films: Film[];
  go: (url: string) => void;
  action: Action;
}) {
  const [query, setQuery] = useState(''),
    [selected, setSelected] = useState(''),
    [adding, setAdding] = useState(false),
    [voting, setVoting] = useState<number | null>(null);
  const candidates = useMemo(() => {
    const existing = new Set(list.items?.map((item) => item.movieId));
    return films
      .filter(
        (film) =>
          !existing.has(film.id) &&
          (!query.trim() ||
            film.title
              .toLocaleLowerCase()
              .includes(query.trim().toLocaleLowerCase())),
      )
      .slice(0, 30);
  }, [films, list.items, query]);
  const add = async () => {
    if (
      !selected ||
      adding ||
      !candidates.some((film) => film.id === Number(selected))
    )
      return;
    setAdding(true);
    try {
      if (
        await action({
          action: 'addToList',
          listId: list.id,
          movieId: Number(selected),
        })
      ) {
        setSelected('');
        setQuery('');
      }
    } finally {
      setAdding(false);
    }
  };
  const vote = async (itemId: number) => {
    if (voting !== null) return;
    setVoting(itemId);
    try {
      await action({ action: 'voteList', itemId });
    } finally {
      setVoting(null);
    }
  };
  return (
    <section
      className="showcase-collab-list"
      aria-label={`Совместная подборка: ${list.title}`}
    >
      <h3>{list.title}</h3>
      <p className="showcase-collab-count">
        Материалов: {list.items?.length || 0}
      </p>
      <ul>
        {list.items?.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="showcase-collab-film"
              disabled={!item.film}
              onClick={() => item.film && go(`/movie/${item.film.id}`)}
            >
              {item.film?.poster && (
                <img src={item.film.poster} alt="" loading="lazy" />
              )}
              <span>{item.film?.title || 'Материал недоступен'}</span>
            </button>
            <button
              type="button"
              className="showcase-collab-vote"
              disabled={voting !== null}
              aria-label={`Голос за ${item.film?.title || 'материал'}: ${item.votes || 0}`}
              onClick={() => void vote(item.id)}
            >
              <Heart size={14} />
              {item.votes || 0}
            </button>
          </li>
        ))}
      </ul>
      {!list.items?.length && (
        <p className="showcase-collab-empty">
          Пока пусто — добавь первую историю для общего киновечера.
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
        className="showcase-collab-add"
      >
        <input
          aria-label={`Поиск материала: ${list.title}`}
          placeholder="Найти материал в каталоге…"
          value={query}
          disabled={adding}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected('');
          }}
        />
        <select
          aria-label={`Материал для подборки: ${list.title}`}
          value={selected}
          disabled={adding}
          onChange={(event) => setSelected(event.target.value)}
        >
          <option value="">Выбери материал</option>
          {candidates.map((film) => (
            <option key={film.id} value={film.id}>
              {film.title} · {film.year}
            </option>
          ))}
        </select>
        <button type="submit" disabled={!selected || adding}>
          {adding ? 'Добавляем…' : 'Добавить в подборку'}
        </button>
        {!candidates.length && (
          <small role="status">
            Нет подходящих материалов. Попробуй другое название: уже добавленные
            скрыты.
          </small>
        )}
      </form>
    </section>
  );
}
export default function CollaborativeCollections({
  films,
  lists,
  go,
  action,
}: {
  films: Film[];
  lists: List[];
  go: (url: string) => void;
  action: Action;
}) {
  const [title, setTitle] = useState(''),
    [creating, setCreating] = useState(false);
  const create = async () => {
    if (!title.trim() || creating) return;
    setCreating(true);
    try {
      if (await action({ action: 'createList', title: title.trim() }))
        setTitle('');
    } finally {
      setCreating(false);
    }
  };
  return (
    <section aria-label="Совместные подборки">
      <header className="showcase-collab-heading">
        <span className="eyebrow">СМОТРИМ ВМЕСТЕ</span>
        <h2>Киновечер начинается с выбора.</h2>
        <p>
          Создавай списки, добавляй материалы из каталога и голосуй за следующий
          просмотр. Списки общие для участников сайта.
        </p>
      </header>
      <form
        className="collab-create"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Название новой подборки…"
          aria-label="Название совместной подборки"
          maxLength={150}
          disabled={creating}
        />
        <button
          className="primary-btn"
          type="submit"
          disabled={creating || !title.trim()}
        >
          <Plus size={16} />
          {creating ? 'Создаём…' : 'Создать'}
        </button>
      </form>
      {lists.length ? (
        <div className="showcase-collab-grid">
          {lists.map((list) => (
            <ListCard
              key={list.id}
              list={list}
              films={films}
              go={go}
              action={action}
            />
          ))}
        </div>
      ) : (
        <div className="showcase-empty">
          <h3>Первый киновечер — за тобой</h3>
          <p>Создай подборку выше и пригласи друзей выбрать кино.</p>
        </div>
      )}
    </section>
  );
}
