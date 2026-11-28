'use client';
import MaterialCover from './material-cover';
import { useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Heart,
  Layers3,
  Plus,
  Search,
  Users,
} from 'lucide-react';
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
    [voting, setVoting] = useState<number | null>(null),
    [error, setError] = useState('');
  const locked = useRef(false);
  const candidates = useMemo(() => {
    const existing = new Set(list.items?.map((item) => item.movieId));
    return films
      .filter(
        (film) =>
          !existing.has(film.id) &&
          (!query.trim() ||
            [film.title, film.originalTitle]
              .filter(Boolean)
              .join(' ')
              .toLocaleLowerCase()
              .includes(query.trim().toLocaleLowerCase())),
      )
      .slice(0, 30);
  }, [films, list.items, query]);
  const add = async () => {
    if (
      locked.current ||
      !selected ||
      !candidates.some((f) => f.id === Number(selected))
    )
      return;
    locked.current = true;
    setAdding(true);
    setError('');
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
      } else setError('Не удалось добавить историю. Твой выбор сохранён.');
    } catch {
      setError('Не удалось добавить историю. Попробуй ещё раз.');
    } finally {
      locked.current = false;
      setAdding(false);
    }
  };
  const vote = async (itemId: number) => {
    if (locked.current) return;
    locked.current = true;
    setVoting(itemId);
    setError('');
    try {
      if (!(await action({ action: 'voteList', itemId })))
        setError('Голос не сохранён. Попробуй ещё раз.');
    } catch {
      setError('Голос не сохранён. Попробуй ещё раз.');
    } finally {
      locked.current = false;
      setVoting(null);
    }
  };
  const items = [...(list.items || [])].sort(
      (a, b) => (b.votes || 0) - (a.votes || 0) || a.id - b.id,
    ),
    first = items[0];
  return (
    <section
      className="showcase-collab-list"
      aria-label={`Совместная подборка: ${list.title}`}
    >
      <header className="ballot-list-heading">
        <div>
          <span className="eyebrow">ОБЩИЙ ВЫБОР / ПОДБОРКА</span>
          <h3>{list.title}</h3>
        </div>
        <span className="showcase-collab-count">
          Материалов: {items.length}
        </span>
      </header>
      {first?.film && (
        <div className="ballot-favorite">
          <MaterialCover
            film={first.film}
            badges={false}
            preview={false}
            className="ballot-feature-cover"
          />
          <div>
            <span className="eyebrow">
              {(first.votes || 0) > 0
                ? 'БОЛЬШЕ ВСЕГО ГОЛОСОВ'
                : 'ПЕРВАЯ ИСТОРИЯ В СПИСКЕ'}
            </span>
            <h4>{first.film.title}</h4>
            <p>
              {first.film.year} · {first.film.category} · {first.votes || 0}{' '}
              голосов
            </p>
            <button
              type="button"
              className="outline-btn"
              onClick={() => go('/movie/' + first.film!.id)}
            >
              Быстрый взгляд <ArrowUpRight size={15} />
            </button>
          </div>
        </div>
      )}
      <ul>
        {items.map((item, index) => (
          <li key={item.id}>
            <span className="ballot-position">
              {String(index + 1).padStart(2, '0')}
            </span>
            <button
              type="button"
              className="showcase-collab-film"
              disabled={!item.film}
              onClick={() => item.film && go('/movie/' + item.film.id)}
            >
              <MaterialCover
                film={item.film || {}}
                badges={false}
                preview={false}
                className="collab-cover"
              />
              <span>{item.film?.title || 'Материал недоступен'}</span>
            </button>
            <button
              type="button"
              className="showcase-collab-vote"
              disabled={adding || voting !== null}
              aria-label={`Голос за ${item.film?.title || 'материал'}: ${item.votes || 0}`}
              onClick={() => void vote(item.id)}
            >
              <Heart size={15} />
              {item.votes || 0}
            </button>
          </li>
        ))}
      </ul>
      {!items.length && (
        <div className="showcase-collab-empty">
          <Layers3 size={28} />
          <h4>С чего начнётся ваш вечер?</h4>
          <p>
            Добавь первую историю из каталога. Остальные участники смогут
            продолжить выбор.
          </p>
        </div>
      )}
      <div className="ballot-add-heading">
        <Plus size={17} />
        <b>Предложить свою историю</b>
      </div>
      <form
        className="showcase-collab-add"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <input
          aria-label={`Поиск материала: ${list.title}`}
          placeholder="Название или оригинальное имя…"
          value={query}
          disabled={adding}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected('');
          }}
        />
        <select
          aria-label={`Материал для подборки: ${list.title}`}
          value={selected}
          disabled={adding}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Выбери материал</option>
          {candidates.map((f) => (
            <option key={f.id} value={f.id}>
              {f.title} · {f.year}
            </option>
          ))}
        </select>
        <button type="submit" disabled={!selected || adding || voting !== null}>
          {adding ? 'Добавляем…' : 'Добавить в подборку'}
        </button>
        {!candidates.length && (
          <small role="status">
            Нет подходящих материалов. Уже добавленные скрыты; попробуй другое
            название.
          </small>
        )}
      </form>
      {error && (
        <p className="ballot-error" role="alert">
          {error}
        </p>
      )}
      <p className="ballot-rules">
        Это счётчик голосов, не число участников. Текущие правила разрешают
        голосовать повторно; отмены голоса нет.
      </p>
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
    [creating, setCreating] = useState(false),
    [error, setError] = useState(''),
    [query, setQuery] = useState(''),
    [focused, setFocused] = useState<number | null>(null),
    [createdTitle, setCreatedTitle] = useState('');
  const lock = useRef(false);
  const visible = lists.filter((list) =>
    list.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const active =
    visible.find((list) => list.id === focused) ||
    visible
      .filter((list) => list.title === createdTitle)
      .sort((a, b) => b.id - a.id)[0] ||
    visible[0];
  const create = async () => {
    if (lock.current || !title.trim()) return;
    lock.current = true;
    setCreating(true);
    setError('');
    const value = title.trim();
    try {
      if (await action({ action: 'createList', title: value })) {
        setTitle('');
        setQuery('');
        setFocused(null);
        setCreatedTitle(value);
      } else
        setError('Подборка не создана. Название сохранено — попробуй ещё раз.');
    } catch {
      setError('Не удалось создать подборку. Попробуй ещё раз.');
    } finally {
      lock.current = false;
      setCreating(false);
    }
  };
  return (
    <section className="cinema-ballot" aria-label="Совместные подборки">
      <div className="ballot-intro-stage">
        <header className="showcase-collab-heading">
          <span className="eyebrow">ВМЕСТЕ / РЕШАЕМ, ЧТО СМОТРЕТЬ</span>
          <h2>
            Не спорить час.
            <br />
            <em>Выбрать историю.</em>
          </h2>
          <p>
            Соберите варианты в одной подборке и поддержите то, что хочется
            посмотреть. Списки общие для всех участников сайта — приватных
            приглашений здесь нет.
          </p>
          <div className="ballot-numbers">
            <div>
              <b>{lists.length}</b>
              <span>общих подборок</span>
            </div>
            <div>
              <b>{lists.reduce((n, l) => n + (l.items?.length || 0), 0)}</b>
              <span>историй в списках</span>
            </div>
          </div>
        </header>
        <aside className="ballot-create-panel">
          <span className="eyebrow">НОВЫЙ ПОВОД СОБРАТЬСЯ</span>
          <h3>Дайте вечеру имя.</h3>
          <p>«На один вечер», «Наши сериалы» или что-то совсем ваше.</p>
          <form
            className="collab-create"
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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
          {error && (
            <p className="ballot-error" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            className="ballot-room-link"
            onClick={() => go('/watchroom')}
          >
            Открыть локальный кинозал <ArrowUpRight size={16} />
          </button>
        </aside>
      </div>
      <div className="ballot-workspace">
        <aside className="ballot-index" aria-label="Выбор общей подборки">
          <div className="ballot-index-heading">
            <Users size={17} />
            <b>Общий стол</b>
            <small>
              {visible.length} / {lists.length}
            </small>
          </div>
          <label className="ballot-search">
            <Search size={16} />
            <input
              aria-label="Найти общую подборку"
              value={query}
              placeholder="Поиск по названию…"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="ballot-index-items">
            {visible.map((list) => (
              <button
                type="button"
                key={list.id}
                aria-pressed={active?.id === list.id}
                onClick={() => setFocused(list.id)}
              >
                <span>{list.title}</span>
                <small>{list.items?.length || 0} историй</small>
              </button>
            ))}
          </div>
          {!visible.length && (
            <p className="ballot-rules">
              {lists.length
                ? 'Подборок с таким названием нет.'
                : 'Пока пусто. Создай первый список выше.'}
            </p>
          )}
        </aside>
        {active ? (
          <ListCard
            key={active.id}
            list={active}
            films={films}
            go={go}
            action={action}
          />
        ) : (
          <div className="showcase-empty">
            <h3>
              {lists.length ? 'Ничего не нашли' : 'Первый киновечер — за тобой'}
            </h3>
            <p>
              {lists.length
                ? 'Попробуй другое название.'
                : 'Создай подборку выше и предложи первую историю.'}
            </p>
            {!!lists.length && (
              <button
                type="button"
                className="outline-btn"
                onClick={() => setQuery('')}
              >
                Показать все подборки
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
