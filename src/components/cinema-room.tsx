'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  Film,
  MessageCircle,
  MonitorPlay,
  Play,
  Search,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import type { Film as Material } from '@/lib/data';
import { playerEmbedUrl } from '@/lib/player-url';
import { localRoomPath, roomReference } from '@/lib/local-cinema-room';
import { copyText } from '@/lib/browser-preferences';
import {
  communityRelation,
  communityState,
  type CommunityPerson,
  type CommunityRelation,
} from '@/lib/community-directory';
import { CommunityNavigation } from './community-cinema';
import MaterialCover from './material-cover';
type Props = {
  films: Material[];
  viewer: CommunityPerson;
  people: CommunityPerson[];
  relations: CommunityRelation[];
  go: (href: string) => void;
  action: (p: Record<string, unknown>) => Promise<boolean>;
  avatar: (person: CommunityPerson) => ReactNode;
};
export function CinemaRoomLobby({
  films,
  viewer,
  people,
  relations,
  go,
  action,
  avatar,
}: Props) {
  const [query, setQuery] = useState(''),
    [selectedId, setSelectedId] = useState<number | null>(null),
    [entry, setEntry] = useState(''),
    [entryError, setEntryError] = useState(''),
    [busy, setBusy] = useState<number | null>(null),
    [notice, setNotice] = useState('');
  const locked = useRef(false),
    selected = films.find((f) => f.id === selectedId);
  const filtered = films
    .filter((f) =>
      [f.title, f.originalTitle]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
    )
    .slice(0, 12);
  const friends = people
    .filter(
      (p) =>
        p.id !== viewer.id &&
        communityState(
          communityRelation(relations, viewer.id, p.id),
          viewer.id,
        ) === 'friends',
    )
    .slice(0, 4);
  const open = () => {
    if (selected)
      go(
        localRoomPath(
          crypto.randomUUID().slice(0, 8).toUpperCase(),
          selected.id,
        ),
      );
  };
  const join = () => {
    const parsed = roomReference(entry, location.origin);
    if (!parsed) {
      setEntryError(
        'Нужен код из 4–64 латинских букв, цифр, _ или - либо ссылка на зал этого сайта.',
      );
      return;
    }
    setEntryError('');
    go(localRoomPath(parsed.code, parsed.movieId || selected?.id));
  };
  const share = async (person: CommunityPerson) => {
    if (!selected || locked.current) return;
    locked.current = true;
    setBusy(person.id);
    setNotice('');
    try {
      setNotice(
        (await action({
          action: 'share',
          movieId: selected.id,
          userId: person.id,
        }))
          ? 'Фильм предложен другу. Это уведомление о материале, а не приглашение в общую комнату.'
          : 'Не удалось предложить фильм. Попробуй ещё раз.',
      );
    } catch {
      setNotice('Не удалось предложить фильм. Попробуй ещё раз.');
    } finally {
      locked.current = false;
      setBusy(null);
    }
  };
  return (
    <section className="cinema-room-lobby">
      <CommunityNavigation active="profile" go={go} />
      <div className="room-lobby-stage">
        <header className="room-editorial">
          <span className="eyebrow">ВМЕСТЕ / ПЕРЕД СЕАНСОМ</span>
          <h1>
            Сначала история.
            <br />
            <em>Потом — свет тише.</em>
          </h1>
          <p>
            Выбери материал и подготовь плеер. Сейчас кинозал работает как
            локальный предпросмотр — без общей комнаты и синхронного
            воспроизведения.
          </p>
          <div className="room-local-badge">
            <MonitorPlay size={17} />
            <span>Одна вкладка · без синхронизации</span>
          </div>
        </header>
        <aside className="room-entry-panel">
          <span className="eyebrow">У ТЕБЯ ЕСТЬ ССЫЛКА?</span>
          <h2>Вернуться к истории.</h2>
          <p>
            Ссылка сохраняет выбранный фильм. Один код не хранит плеер,
            сообщения или присутствие других зрителей.
          </p>
          <form
            className="wrc-join-form"
            onSubmit={(e) => {
              e.preventDefault();
              join();
            }}
          >
            <label>
              Код или ссылка на зал
              <input
                aria-label="Код или ссылка на зал"
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
                maxLength={2048}
                placeholder="ABCD1234 или /room/…"
              />
            </label>
            <button
              type="submit"
              className="outline-btn"
              disabled={!entry.trim()}
            >
              Открыть по ссылке <ArrowRight size={16} />
            </button>
          </form>
          {entryError && (
            <p role="alert" className="room-status">
              {entryError}
            </p>
          )}
        </aside>
      </div>
      <div className="room-lobby-workspace">
        <section
          className="room-film-picker"
          aria-label="Выбрать историю для зала"
        >
          <header>
            <div>
              <span className="eyebrow">01 / ВЫБЕРИ ИСТОРИЮ</span>
              <h2>Что сегодня на экране?</h2>
            </div>
            <span>
              {filtered.length} из {films.length}
            </span>
          </header>
          <label className="room-film-search">
            <Search size={18} />
            <input
              aria-label="Поиск фильма для зала"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Название или оригинальное имя…"
            />
          </label>
          <div className="wrc-film-grid">
            {filtered.map((f) => (
              <button
                type="button"
                key={f.id}
                className={`wrc-film-item ${selectedId === f.id ? 'selected' : ''}`}
                aria-pressed={selectedId === f.id}
                onClick={() => setSelectedId(f.id)}
              >
                <MaterialCover
                  film={f}
                  badges={false}
                  preview={false}
                  className="room-picker-cover"
                />
                <span>
                  <b>{f.title}</b>
                  <small>
                    {f.year} · {f.category}
                  </small>
                </span>
                {selectedId === f.id && <Check size={17} />}
              </button>
            ))}
          </div>
          {!filtered.length && (
            <div className="empty-state">
              <h3>Историй не нашли</h3>
              <p>Попробуй другое название.</p>
              {query && (
                <button className="outline-btn" onClick={() => setQuery('')}>
                  Очистить поиск
                </button>
              )}
            </div>
          )}
        </section>
        <aside className="room-session-plan">
          <span className="eyebrow">02 / ПОДГОТОВЬ ПРЕДПРОСМОТР</span>
          {selected ? (
            <div className="wrc-selected">
              <MaterialCover
                film={selected}
                badges={false}
                preview={false}
                className="room-selection-cover"
              />
              <div>
                <h3>{selected.title}</h3>
                <p>
                  {selected.year} · {selected.category}
                </p>
              </div>
            </div>
          ) : (
            <div className="room-no-selection">
              <Film size={32} />
              <h3>Оставь место для истории.</h3>
              <p>
                Сначала выбери материал. Ни один фильм не будет подставлен
                автоматически.
              </p>
            </div>
          )}
          <button
            type="button"
            className="primary-btn wrc-start"
            disabled={!selected}
            onClick={open}
          >
            <MonitorPlay size={17} />
            {selected ? 'Открыть локальный зал' : 'Сначала выбери фильм'}
          </button>
          <p className="room-step-note">
            Затем добавь разрешённую ссылку YouTube, RuTube или VK. Просмотр не
            отмечается автоматически.
          </p>
          <div className="room-share-friends">
            <h3>Предложить фильм другу</h3>
            <p>
              Отправляется обычное уведомление о материале. Плеер и локальные
              заметки не передаются.
            </p>
            {friends.map((person) => (
              <button
                type="button"
                key={person.id}
                disabled={!selected || busy !== null}
                onClick={() => void share(person)}
              >
                {avatar(person)}
                <span>{person.username}</span>
                <Send size={16} />
              </button>
            ))}
            {!friends.length && (
              <button
                type="button"
                className="outline-btn"
                onClick={() => go('/friends')}
              >
                Найти своих зрителей <ArrowUpRight size={16} />
              </button>
            )}
            {notice && (
              <p role="status" className="room-status">
                {notice}
              </p>
            )}
          </div>
          <button
            type="button"
            className="room-text-link"
            onClick={() => go('/chat')}
          >
            <MessageCircle size={16} /> Для настоящей переписки — в чат
          </button>
        </aside>
      </div>
    </section>
  );
}
export function CinemaLocalRoom({
  roomId,
  movieId,
  films,
  viewer,
  go,
}: {
  roomId: string;
  movieId: number | null;
  films: Material[];
  viewer: CommunityPerson;
  go: Props['go'];
}) {
  const film = films.find((f) => f.id === movieId),
    [url, setUrl] = useState(''),
    [embed, setEmbed] = useState(''),
    [error, setError] = useState(''),
    [copyState, setCopyState] = useState(''),
    [note, setNote] = useState(''),
    [notes, setNotes] = useState<{ id: number; text: string }[]>([]),
    [reactions, setReactions] = useState<{ id: number; emoji: string }[]>([]);
  const counter = useRef(0),
    timers = useRef<ReturnType<typeof setTimeout>[]>([]),
    log = useRef<HTMLDivElement>(null);
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );
  useEffect(() => {
    log.current?.scrollTo({
      top: log.current.scrollHeight,
      behavior: 'instant',
    });
  }, [notes.length]);
  const apply = () => {
    const safe = playerEmbedUrl(url);
    if (!safe) {
      setError(
        'Нужна HTTPS-ссылка YouTube, RuTube или VK video_ext.php. Произвольные страницы не поддерживаются.',
      );
      return;
    }
    setEmbed(safe);
    setError('');
  };
  const reaction = (emoji: string) => {
    const id = ++counter.current;
    setReactions((old) => [...old.slice(-9), { id, emoji }]);
    const timer = setTimeout(() => {
      setReactions((old) => old.filter((r) => r.id !== id));
      timers.current = timers.current.filter((t) => t !== timer);
    }, 2500);
    timers.current.push(timer);
  };
  const addNote = () => {
    if (!note.trim()) return;
    setNotes((old) => [...old, { id: ++counter.current, text: note.trim() }]);
    setNote('');
  };
  return (
    <section className="cinema-local-room">
      <header className="room-session-heading">
        <div>
          <span className="eyebrow">ЛОКАЛЬНЫЙ КИНОЗАЛ / {roomId}</span>
          <h1>{film?.title || 'Выбери историю для зала'}</h1>
        </div>
        <button
          type="button"
          className="outline-btn"
          onClick={() => go('/watchroom')}
        >
          ← Выйти из зала
        </button>
      </header>
      <div className="room-honesty" role="note">
        <MonitorPlay size={19} />
        <p>
          <b>Только в этой вкладке.</b> Видео, заметки и реакции не передаются
          другим зрителям. Общая комната и синхронизация пока не реализованы.
        </p>
      </div>
      {!film ? (
        <div className="empty-state">
          <Sparkles size={32} />
          <h2>
            {movieId
              ? 'Материал больше недоступен'
              : 'Ссылка без выбранного фильма'}
          </h2>
          <p>Выбери историю в лобби. Случайный фильм не подставляется.</p>
          <button className="primary-btn" onClick={() => go('/watchroom')}>
            Выбрать фильм
          </button>
        </div>
      ) : (
        <>
          <div className="room-session-grid">
            <div className="room-screen-column">
              <div className="room-video-area">
                {embed ? (
                  <iframe
                    src={embed}
                    title="Локальный предпросмотр плеера"
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="room-iframe"
                  />
                ) : (
                  <div className="room-setup-prompt">
                    <MonitorPlay size={42} />
                    <span className="eyebrow">ЭКРАН ЖДЁТ ТЕБЯ</span>
                    <h2>Плеер — по твоему выбору.</h2>
                    <p>
                      Добавь разрешённую ссылку ниже. Ничего не запустится без
                      твоего действия.
                    </p>
                  </div>
                )}
                <div className="reaction-track" aria-hidden="true">
                  {reactions.map((r) => (
                    <span key={r.id} className="flying-reaction">
                      {r.emoji}
                    </span>
                  ))}
                </div>
              </div>
              <section
                className="room-player-controls"
                aria-label="Источник плеера"
              >
                <div>
                  <span className="eyebrow">ИСТОЧНИК ВИДЕО</span>
                  <h2>
                    {embed
                      ? 'Можно сменить историю в плеере.'
                      : 'Подготовь свой экран.'}
                  </h2>
                </div>
                <form
                  className="room-url-input"
                  onSubmit={(e) => {
                    e.preventDefault();
                    apply();
                  }}
                >
                  <input
                    aria-label="Ссылка на плеер"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    maxLength={4096}
                    placeholder="HTTPS-ссылка YouTube, RuTube или VK"
                  />
                  <button type="submit" className="primary-btn">
                    <Play size={15} />
                    {embed ? 'Сменить плеер' : 'Запустить'}
                  </button>
                  {!!embed && (
                    <button
                      type="button"
                      className="outline-btn"
                      onClick={() => {
                        setEmbed('');
                        setError('');
                      }}
                    >
                      Убрать плеер <X size={15} />
                    </button>
                  )}
                </form>
                {error && (
                  <p role="alert" className="room-status">
                    {error}
                  </p>
                )}
                <p>
                  Доступность внешнего видео зависит от его владельца. Сайт не
                  открывает произвольные страницы и не предоставляет фильм по
                  ссылке на карточку.
                </p>
              </section>
              <div className="room-session-material">
                <MaterialCover
                  film={film}
                  preview={false}
                  badges={false}
                  className="room-material-cover"
                />
                <div>
                  <h2>{film.title}</h2>
                  <p>
                    {film.year} · {film.category}
                  </p>
                  <button
                    className="room-text-link"
                    onClick={() => go('/movie/' + film.id)}
                  >
                    Открыть карточку <ArrowUpRight size={16} />
                  </button>
                </div>
              </div>
            </div>
            <aside className="room-notebook">
              <header>
                <span className="eyebrow">ЗАМЕТКИ ПО ХОДУ</span>
                <h2>Своя реплика.</h2>
                <p>
                  Локальные записи {viewer.username}. Исчезнут после
                  перезагрузки — это не переписка с друзьями.
                </p>
              </header>
              <div
                className="room-reactions"
                role="group"
                aria-label="Локальные реакции"
              >
                {['🍿', '😱', '😭', '🤯', '😍'].map((emoji) => (
                  <button
                    type="button"
                    key={emoji}
                    aria-label={'Локальная реакция ' + emoji}
                    onClick={() => reaction(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div
                className="room-messages"
                ref={log}
                role="log"
                aria-label="Заметки в этой вкладке"
                aria-live="polite"
              >
                {notes.length ? (
                  notes.map((n) => (
                    <p key={n.id} className="room-chat-msg">
                      {n.text}
                    </p>
                  ))
                ) : (
                  <div className="room-notes-empty">
                    <Sparkles size={24} />
                    <p>Что осталось после этой сцены?</p>
                  </div>
                )}
              </div>
              <form
                className="room-note-compose"
                onSubmit={(e) => {
                  e.preventDefault();
                  addNote();
                }}
              >
                <input
                  aria-label="Локальная заметка"
                  value={note}
                  maxLength={2000}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Записать для себя…"
                  onKeyDown={(e) => {
                    if (
                      e.key === 'Enter' &&
                      (e.nativeEvent.isComposing || e.shiftKey)
                    )
                      e.preventDefault();
                  }}
                />
                <button
                  type="submit"
                  disabled={!note.trim()}
                  aria-label="Добавить локальную заметку"
                >
                  <PlusIcon />
                </button>
              </form>
              <button className="room-text-link" onClick={() => go('/chat')}>
                <MessageCircle size={16} /> Написать другу в чат
              </button>
            </aside>
          </div>
          <section className="room-reference">
            <div>
              <span className="eyebrow">СОХРАНИТЬ ВЫБОР</span>
              <h2>Ссылка на материал в зале.</h2>
              <p>
                Сохраняет код и выбранный фильм, но не видео, заметки и реакции.
              </p>
            </div>
            <div>
              <button
                type="button"
                className="outline-btn"
                onClick={async () =>
                  setCopyState(
                    (await copyText(
                      location.origin + localRoomPath(roomId, film.id),
                    ))
                      ? 'Ссылка скопирована'
                      : 'Не удалось скопировать. Выдели адрес ниже вручную.',
                  )
                }
              >
                <Copy size={16} /> Копировать ссылку
              </button>
              <input
                aria-label="Ссылка на локальный зал"
                readOnly
                value={localRoomPath(roomId, film.id)}
                onFocus={(e) => e.currentTarget.select()}
              />
              {copyState && <p role="status">{copyState}</p>}
            </div>
          </section>
        </>
      )}
    </section>
  );
}
function PlusIcon() {
  return <ArrowRight size={18} />;
}
