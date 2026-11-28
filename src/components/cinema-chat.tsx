'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  ExternalLink,
  Film,
  MessageCircle,
  Search,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { CommunityNavigation } from './community-cinema';
import { useJsonResource } from './use-json-resource';
import {
  communityRelation,
  communityState,
  type CommunityPerson,
  type CommunityRelation,
} from '@/lib/community-directory';
import type { Film as Material } from '@/lib/data';
import { formatFilmRating } from '@/lib/rating-display';

type SharedFilm = Pick<
  Material,
  'id' | 'title' | 'poster' | 'year' | 'category'
>;
type Message = {
  id: number;
  fromId: number;
  toId: number;
  body: string;
  movieId: number | null;
  read: boolean;
  createdAt: string;
  film: SharedFilm | null;
};
type Conversation = {
  peer: CommunityPerson;
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
  hasFilm: boolean;
};
type Renderers = {
  avatar: (person: CommunityPerson, size: number) => ReactNode;
  poster: (film: SharedFilm) => ReactNode;
};
type Props = Renderers & {
  viewerId: number;
  people: CommunityPerson[];
  relations: CommunityRelation[];
  films: Material[];
  go: (href: string) => void;
};

/** Drafts and pending requests belong to their recipient, never to the currently selected pane. */
function useChatComposer() {
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [pending, setPending] = useState<number[]>([]),
    [errors, setErrors] = useState<Record<number, string>>({});
  const inFlight = useRef(new Set<number>());
  const send = async (
    peerId: number,
    movieId: number | undefined,
    onSent: () => void,
  ) => {
    const text = drafts[peerId] || '';
    if (inFlight.current.has(peerId) || (!text.trim() && !movieId))
      return false;
    inFlight.current.add(peerId);
    setPending((ids) => [...ids, peerId]);
    setErrors((old) => ({ ...old, [peerId]: '' }));
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toId: peerId,
          text: text.trim(),
          movieId: movieId || null,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.error || 'Сообщение не отправлено. Попробуй ещё раз.',
        );
      }
      setDrafts((old) =>
        old[peerId] === text ? { ...old, [peerId]: '' } : old,
      );
      onSent();
      return true;
    } catch (error) {
      setErrors((old) => ({
        ...old,
        [peerId]:
          error instanceof Error
            ? error.message
            : 'Ошибка отправки. Черновик сохранён.',
      }));
      return false;
    } finally {
      inFlight.current.delete(peerId);
      setPending((ids) => ids.filter((id) => id !== peerId));
    }
  };
  return {
    drafts,
    setDraft: (id: number, text: string) =>
      setDrafts((old) => ({ ...old, [id]: text })),
    pending,
    errors,
    send,
  };
}
type Composer = ReturnType<typeof useChatComposer>;

function ConversationPane({
  viewerId,
  peer,
  films,
  go,
  avatar,
  poster,
  composer,
  onSent,
  onBack,
  drawer = false,
}: {
  viewerId: number;
  peer: CommunityPerson;
  films: Material[];
  go: Props['go'];
  composer: Composer;
  onSent?: () => void;
  onBack?: () => void;
  drawer?: boolean;
} & Renderers) {
  const [snapshot, reload, status] = useJsonResource<{ messages: Message[] }>(
    '/api/chat?with=' + peer.id,
  );
  const [shareOpen, setShareOpen] = useState(false),
    [query, setQuery] = useState('');
  const heading = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!drawer && matchMedia('(max-width:800px)').matches)
      heading.current?.focus({ preventScroll: true });
  }, [drawer]);
  const scroll = useRef<HTMLDivElement>(null),
    wasNearEnd = useRef(true);
  const messages = snapshot?.messages || [],
    last = messages.at(-1),
    text = composer.drafts[peer.id] || '',
    busy = composer.pending.includes(peer.id);
  const choices = films
    .filter(
      (f) =>
        !query.trim() ||
        [f.title, f.originalTitle]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()),
    )
    .slice(0, 6);
  useEffect(() => {
    if (wasNearEnd.current)
      scroll.current?.scrollTo({
        top: scroll.current.scrollHeight,
        behavior: 'instant',
      });
  }, [last?.id]);
  useEffect(() => {
    if (snapshot) onSent?.();
  }, [snapshot, onSent]);
  const send = async (movieId?: number) => {
    const ok = await composer.send(peer.id, movieId, () => {
      wasNearEnd.current = true;
      reload();
      onSent?.();
    });
    if (ok) setShareOpen(false);
  };
  return (
    <div className={`cinema-conversation ${drawer ? 'is-drawer' : ''}`}>
      <header className="chat-header" ref={heading} tabIndex={-1}>
        {onBack && (
          <button
            type="button"
            className="cinema-chat-back"
            aria-label="Назад к диалогам"
            onClick={onBack}
          >
            <ArrowLeft size={19} />
          </button>
        )}
        <button
          type="button"
          className="chat-header-user"
          onClick={() => go('/user/' + peer.id)}
        >
          {avatar(peer, 40)}
          <span>
            <b>{peer.username}</b>
            <small>Личная переписка · только вы двое</small>
          </span>
        </button>
        {!drawer && (
          <button
            type="button"
            className="outline-btn small cinema-chat-profile"
            onClick={() => go('/user/' + peer.id)}
          >
            Профиль <ArrowUpRight size={14} />
          </button>
        )}
      </header>
      {status.error && (
        <div className="cinema-chat-error" role="alert">
          <span>{status.error} Сообщения доступны друзьям.</span>
          <button type="button" onClick={reload}>
            Повторить
          </button>
        </div>
      )}
      <div
        className="chat-messages"
        ref={scroll}
        role="log"
        aria-label={'Переписка с ' + peer.username}
        aria-live="polite"
        aria-relevant="additions"
        onScroll={() => {
          const el = scroll.current;
          if (el)
            wasNearEnd.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        {!snapshot && status.loading ? (
          <p role="status" className="cinema-thread-state">
            Загружаем переписку…
          </p>
        ) : !messages.length && !status.error ? (
          <div className="chat-empty-thread">
            <Sparkles size={28} />
            <h3>Первая реплика — за тобой.</h3>
            <p>Расскажи, что посмотрел, или отправь историю из каталога.</p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`chat-bubble ${m.fromId === viewerId ? 'mine' : 'theirs'}`}
            >
              <div className="bubble-body">
                <p>{m.body}</p>
                {m.film && (
                  <button
                    type="button"
                    className="shared-film-card"
                    onClick={() => go('/movie/' + m.film!.id)}
                  >
                    {poster(m.film)}
                    <span>
                      <b>{m.film.title}</b>
                      <small>
                        {m.film.year} · {m.film.category}
                      </small>
                    </span>
                    <ArrowUpRight size={14} />
                  </button>
                )}
              </div>
              <span className="bubble-time">
                {new Date(m.createdAt).toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {m.fromId === viewerId && (
                  <span aria-label={m.read ? 'Прочитано' : 'Отправлено'}>
                    {m.read ? ' · ✓✓' : ' · ✓'}
                  </span>
                )}
              </span>
            </div>
          ))
        )}
      </div>
      <div className="chat-compose">
        {composer.errors[peer.id] && (
          <p className="cinema-chat-error" role="alert">
            {composer.errors[peer.id]} Черновик не удалён.
          </p>
        )}
        {shareOpen && (
          <section
            className="chat-share-panel"
            aria-label="Выбрать фильм для отправки"
          >
            <div className="chat-share-head">
              <b>История для разговора</b>
              <button
                type="button"
                aria-label="Закрыть выбор фильма"
                onClick={() => setShareOpen(false)}
              >
                <X size={17} />
              </button>
            </div>
            <input
              aria-label="Найти фильм для отправки"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Название или оригинальное имя…"
            />
            <div className="chat-share-list">
              {choices.map((f) => (
                <button
                  type="button"
                  disabled={busy}
                  key={f.id}
                  onClick={() => void send(f.id)}
                  className="chat-share-item"
                >
                  {poster(f)}
                  <span>
                    <b>{f.title}</b>
                    <small>
                      {f.year} · ★ {formatFilmRating(f)} · отправить
                    </small>
                  </span>
                  <Send size={15} />
                </button>
              ))}
              {!choices.length && (
                <p className="cinema-thread-state">
                  По этому запросу историй нет.
                </p>
              )}
            </div>
          </section>
        )}
        <form
          className="chat-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <button
            type="button"
            className="chat-attach-btn"
            aria-label="Поделиться фильмом"
            aria-expanded={shareOpen}
            onClick={() => setShareOpen(!shareOpen)}
          >
            <Film size={19} />
          </button>
          <input
            aria-label="Сообщение"
            maxLength={2000}
            value={text}
            onChange={(e) => composer.setDraft(peer.id, e.target.value)}
            placeholder="Обсудим кино…"
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
            className="chat-send-btn"
            aria-label="Отправить сообщение"
            disabled={busy || !text.trim()}
          >
            <Send size={18} />
          </button>
        </form>
        <small className="cinema-compose-note">
          {busy ? 'Отправляем…' : 'Enter — отправить · до 2000 символов'}
        </small>
      </div>
    </div>
  );
}

export default function CinemaChat({
  viewerId,
  people,
  relations,
  films,
  go,
  avatar,
  poster,
  initialPeer,
}: Props & { initialPeer?: number | null }) {
  const [activePeer, setActivePeer] = useState<number | null>(
      initialPeer && Number.isSafeInteger(initialPeer) && initialPeer > 0
        ? initialPeer
        : null,
    ),
    [query, setQuery] = useState('');
  const [inbox, reload, status] = useJsonResource<{
    conversations: Conversation[];
  }>('/api/chat');
  const composer = useChatComposer(),
    contacts = inbox?.conversations || [];
  const eligible = people.filter(
    (p) =>
      p.id !== viewerId &&
      communityState(communityRelation(relations, viewerId, p.id), viewerId) ===
        'friends',
  );
  const noThread = eligible.filter(
    (p) => !contacts.some((c) => c.peer.id === p.id),
  );
  const peer =
    people.find((p) => p.id === activePeer) ||
    contacts.find((c) => c.peer.id === activePeer)?.peer;
  const needle = query.trim().toLocaleLowerCase();
  const shown = contacts.filter((c) =>
      c.peer.username.toLocaleLowerCase().includes(needle),
    ),
    newPeers = noThread.filter((p) =>
      p.username.toLocaleLowerCase().includes(needle),
    );
  const contact = (person: CommunityPerson, c?: Conversation) => (
    <button
      type="button"
      key={person.id}
      className={`chat-contact ${activePeer === person.id ? 'active' : ''}`}
      aria-pressed={activePeer === person.id}
      onClick={() => setActivePeer(person.id)}
    >
      {avatar(person, 42)}
      <span className="chat-contact-info">
        <b>{person.username}</b>
        <small>
          {c ? `${c.hasFilm ? '📎 ' : ''}${c.lastMessage}` : 'Начать разговор'}
        </small>
      </span>
      {c && (
        <span className="chat-time">
          {new Date(c.lastMessageAt).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
          })}
        </span>
      )}
      {!!c?.unread && (
        <span className="chat-unread" aria-label={`${c.unread} непрочитанных`}>
          {c.unread}
        </span>
      )}
    </button>
  );
  return (
    <section
      className={`cinema-messages ${activePeer ? 'has-active-peer' : ''}`}
    >
      <CommunityNavigation active="chat" go={go} />
      <header className="cinema-messages-heading">
        <div>
          <span className="eyebrow">ВМЕСТЕ / МЕЖДУ СТРОК</span>
          <h1>
            Кино заканчивается.
            <br />
            <em>Разговор — нет.</em>
          </h1>
        </div>
        <p>
          Личная переписка с друзьями.
          <br />
          Один фильм — уже повод написать.
        </p>
      </header>
      <div className="chat-layout">
        <aside className="chat-sidebar" aria-label="Собеседники">
          <div className="chat-sidebar-head">
            <h2>Диалоги</h2>
            <span>{contacts.reduce((n, c) => n + c.unread, 0)} непрочит.</span>
          </div>
          <label className="cinema-contact-search">
            <Search size={16} />
            <input
              aria-label="Найти диалог"
              placeholder="Имя собеседника…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {status.error && (
            <div className="cinema-chat-error" role="alert">
              <span>{status.error}</span>
              <button onClick={reload}>Повторить</button>
            </div>
          )}
          {!inbox && status.loading && (
            <p role="status" className="cinema-thread-state">
              Загружаем диалоги…
            </p>
          )}
          {shown.map((c) => contact(c.peer, c))}
          {!!newPeers.length && (
            <div className="chat-sidebar-divider">Ещё не говорили</div>
          )}
          {newPeers.map((p) => contact(p))}
          {!status.loading && !shown.length && !newPeers.length && (
            <div className="chat-empty-sidebar">
              <MessageCircle size={28} />
              <p>
                {needle
                  ? 'Собеседников не нашли'
                  : 'Добавь друзей, чтобы начать общение'}
              </p>
              <button
                className="outline-btn small"
                onClick={() => (needle ? setQuery('') : go('/friends'))}
              >
                {needle ? 'Очистить поиск' : 'Найти друзей'}
              </button>
            </div>
          )}
        </aside>
        <div className="chat-main">
          {peer ? (
            <ConversationPane
              key={peer.id}
              viewerId={viewerId}
              peer={peer}
              films={films}
              go={go}
              avatar={avatar}
              poster={poster}
              composer={composer}
              onSent={reload}
              onBack={() => {
                setActivePeer(null);
                requestAnimationFrame(() =>
                  document
                    .querySelector<HTMLInputElement>(
                      '.cinema-contact-search input',
                    )
                    ?.focus({ preventScroll: true }),
                );
              }}
            />
          ) : (
            <div className="chat-placeholder">
              <span className="eyebrow">МЕСТО ДЛЯ ВАШИХ ИСТОРИЙ</span>
              <MessageCircle size={44} />
              <h2>Начни с «что посмотрел?»</h2>
              <p>
                Выбери собеседника из списка. Фильмом можно поделиться прямо из
                переписки — без копирования ссылок.
              </p>
              <button className="outline-btn" onClick={() => go('/friends')}>
                Твои люди <ArrowUpRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function CinemaChatDrawer({
  peerId,
  close,
  ...props
}: Props & { peerId: number; close: () => void }) {
  const peer = props.people.find((p) => p.id === peerId),
    dialog = useRef<HTMLDialogElement>(null),
    returnTo = useRef<HTMLElement | null>(null),
    composer = useChatComposer();
  useEffect(() => {
    returnTo.current = document.activeElement as HTMLElement;
    const el = dialog.current;
    if (!el) return;
    el.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      el.close();
      document.body.style.overflow = overflow;
      const target = returnTo.current?.isConnected
        ? returnTo.current
        : document.getElementById('main-content');
      target?.focus({ preventScroll: true });
    };
  }, []);
  if (!peer) return null;
  const go = (href: string) => {
    close();
    props.go(href);
  };
  return (
    <dialog
      ref={dialog}
      className="chat-drawer cinema-chat-drawer"
      aria-label={'Личный чат: ' + peer.username}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const focusable = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]),input:not([disabled]),a[href],[tabindex="0"]',
          ),
        ].filter((el) => el.getClientRects().length > 0);
        const first = focusable[0],
          last = focusable.at(-1);
        if (!first) {
          event.preventDefault();
          event.currentTarget.focus();
          return;
        }
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            !focusable.includes(document.activeElement as HTMLElement))
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !focusable.includes(document.activeElement as HTMLElement))
        ) {
          event.preventDefault();
          first.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div className="cinema-drawer-toolbar">
        <span className="eyebrow">ЛИЧНЫЙ РАЗГОВОР</span>
        <div>
          <button
            type="button"
            aria-label="Открыть полный чат"
            onClick={() => go('/chat?with=' + peerId)}
          >
            <ExternalLink size={17} />
          </button>
          <button type="button" aria-label="Закрыть чат" onClick={close}>
            <X size={19} />
          </button>
        </div>
      </div>
      <ConversationPane
        key={peerId}
        viewerId={props.viewerId}
        peer={peer}
        films={props.films}
        go={go}
        avatar={props.avatar}
        poster={props.poster}
        composer={composer}
        drawer
      />
    </dialog>
  );
}
