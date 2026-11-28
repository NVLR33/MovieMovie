'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import {
  ArrowUpRight,
  Check,
  Eye,
  MessageCircle,
  Search,
  Trophy,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  communityRelation,
  communityState,
  selectCommunityPeople,
  type CommunityPerson,
  type CommunityRelation,
  type CommunityScope,
} from '@/lib/community-directory';

export function CommunityNavigation({
  active,
  go,
}: {
  active: 'people' | 'leaders' | 'profile' | 'chat';
  go: (href: string) => void;
}) {
  return (
    <nav className="community-space-nav" aria-label="Сообщество">
      {[
        {
          href: '/friends',
          label: 'Твои люди',
          icon: Users,
          active: active === 'people',
        },
        {
          href: '/leaderboard',
          label: 'Зрители в цифрах',
          icon: Trophy,
          active: active === 'leaders',
        },
        {
          href: '/chat',
          label: 'Переписка',
          icon: MessageCircle,
          active: active === 'chat',
        },
      ].map((item) => (
        <Link
          key={item.href}
          href={item.href}
          prefetch={false}
          aria-current={item.active ? 'page' : undefined}
          onClick={(e) => {
            if (
              e.button === 0 &&
              !e.metaKey &&
              !e.ctrlKey &&
              !e.shiftKey &&
              !e.altKey
            ) {
              e.preventDefault();
              go(item.href);
            }
          }}
        >
          <item.icon size={16} />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function CommunityDirectory({
  viewerId,
  people,
  relations,
  go,
  action,
  openChat,
  avatar,
}: {
  viewerId: number;
  people: CommunityPerson[];
  relations: CommunityRelation[];
  go: (href: string) => void;
  action: (p: Record<string, unknown>, message?: string) => Promise<boolean>;
  openChat: (id: number) => void;
  avatar: (person: CommunityPerson) => ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<CommunityScope>('all');
  const [busy, setBusy] = useState<number | null>(null);
  const [failure, setFailure] = useState('');
  const all = selectCommunityPeople(people, relations, viewerId, '', 'all');
  const counts = { all: all.length, friends: 0, incoming: 0, outgoing: 0 };
  for (const person of all) {
    const state = communityState(
      communityRelation(relations, viewerId, person.id),
      viewerId,
    );
    if (state !== 'none' && state !== 'all') counts[state]++;
  }
  const peers = selectCommunityPeople(
    people,
    relations,
    viewerId,
    query,
    scope,
  );
  const act = async (person: CommunityPerson) => {
    if (busy !== null) return;
    const relation = communityRelation(relations, viewerId, person.id),
      incoming = communityState(relation, viewerId) === 'incoming';
    setBusy(person.id);
    setFailure('');
    try {
      const ok = await action(
        incoming
          ? { action: 'friendAccept', id: relation!.id }
          : { action: 'friend', userId: person.id },
        incoming ? 'Теперь вы друзья!' : 'Заявка отправлена',
      );
      if (!ok) setFailure('Не удалось изменить заявку. Попробуй ещё раз.');
    } catch {
      setFailure('Не удалось изменить заявку. Попробуй ещё раз.');
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="community-cinema community-people">
      <CommunityNavigation active="people" go={go} />
      <div className="community-people-stage">
        <header className="community-intro">
          <span className="eyebrow">ВМЕСТЕ / НЕ ТОЛЬКО О КИНО</span>
          <h1>
            Совпасть
            <br />
            по <em>впечатлениям.</em>
          </h1>
          <p>
            Находи своих зрителей. Обменивайся историями, сравнивай вкусы и
            продолжай разговор в чате.
          </p>
          <div className="community-totals">
            <div>
              <b>{counts.friends}</b>
              <span>в твоём круге</span>
            </div>
            <div>
              <b>{counts.all}</b>
              <span>других зрителей</span>
            </div>
          </div>
        </header>
        <aside className="community-invitation">
          <span className="eyebrow">ТВОЙ КРУГ</span>
          <h2>
            {counts.incoming
              ? 'Есть повод познакомиться.'
              : 'Одна история — начало разговора.'}
          </h2>
          <p>
            {counts.incoming
              ? `Входящие заявки: ${counts.incoming}. Ты решаешь, кого добавить в свой круг.`
              : 'Найди зрителя по имени или посмотри, кто уже рядом. Личные сообщения доступны друзьям.'}
          </p>
          <div className="community-invitation-actions">
            <button
              type="button"
              onClick={() => {
                setScope(counts.incoming ? 'incoming' : 'friends');
                setQuery('');
                document.getElementById('community-directory')?.focus();
              }}
            >
              {counts.incoming ? 'Посмотреть заявки' : 'Мои друзья'}{' '}
              <ArrowUpRight size={17} />
            </button>
            <button type="button" onClick={() => go('/chat')}>
              <MessageCircle size={17} /> Открыть переписку
            </button>
          </div>
          <small>
            Исходящие заявки: {counts.outgoing} · без автоматического добавления
          </small>
        </aside>
      </div>
      <section
        id="community-directory"
        tabIndex={-1}
        className="community-directory"
        aria-label="Каталог зрителей"
      >
        <header className="community-directory-heading">
          <div>
            <span className="eyebrow">ЛЮДИ, А НЕ АЛГОРИТМ</span>
            <h2>Найди свою компанию</h2>
          </div>
          <span className="community-directory-count" role="status">
            Показано {peers.length} из {counts[scope]}
          </span>
        </header>
        <div className="community-directory-tools">
          <div
            className="community-scope"
            role="group"
            aria-label="Круг общения"
          >
            {(
              [
                ['all', 'Все зрители'],
                ['friends', 'Друзья'],
                ['incoming', 'Входящие'],
                ['outgoing', 'Исходящие'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={scope === id}
                onClick={() => setScope(id)}
              >
                {label}
                <small>{counts[id]}</small>
              </button>
            ))}
          </div>
          <div className="community-people-search">
            <Search size={18} />
            <input
              aria-label="Найти зрителя"
              placeholder="Найти пользователя по имени..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                aria-label="Очистить поиск зрителей"
                onClick={() => setQuery('')}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        {failure && (
          <p role="alert" className="community-action-error">
            {failure}
          </p>
        )}
        <div className="people-grid">
          {peers.map((person) => {
            const relation = communityRelation(relations, viewerId, person.id),
              state = communityState(relation, viewerId);
            return (
              <article className="person-card" key={person.id}>
                {avatar(person)}
                <div className="community-person-identity">
                  <small>
                    {state === 'friends'
                      ? 'В ТВОЁМ КРУГЕ'
                      : state === 'incoming'
                        ? 'ХОЧЕТ ДРУЖИТЬ'
                        : state === 'outgoing'
                          ? 'ТВОЯ ЗАЯВКА'
                          : 'ЗРИТЕЛЬ'}
                  </small>
                  <b>{person.username}</b>
                  <span>
                    {person.role === 'admin'
                      ? 'Администратор'
                      : person.role === 'moderator'
                        ? 'Модератор'
                        : person.role === 'vip'
                          ? 'VIP участник'
                          : `Уровень ${Math.floor((person.xp || 0) / 500) + 1}`}
                  </span>
                </div>
                <div className="friend-actions">
                  <button
                    type="button"
                    className="outline-btn small"
                    onClick={() => go('/user/' + person.id)}
                  >
                    <Eye size={14} /> Профиль
                  </button>
                  {state === 'friends' ? (
                    <button
                      type="button"
                      className="outline-btn small"
                      onClick={() => openChat(person.id)}
                    >
                      <MessageCircle size={14} /> Чат
                    </button>
                  ) : state === 'outgoing' ? (
                    <span className="friend-state" role="status">
                      Заявка отправлена
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={
                        state === 'incoming'
                          ? 'primary-btn small'
                          : 'outline-btn small'
                      }
                      disabled={busy !== null}
                      onClick={() => void act(person)}
                    >
                      {state === 'incoming' ? (
                        <Check size={16} />
                      ) : (
                        <UserPlus size={16} />
                      )}
                      {busy === person.id
                        ? 'Сохраняем…'
                        : state === 'incoming'
                          ? 'Принять'
                          : 'Добавить'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        {!peers.length && (
          <div className="empty-state">
            <Users size={30} />
            <h3>
              {query.trim()
                ? 'Никого не нашли'
                : scope === 'friends'
                  ? 'Твой круг ещё впереди'
                  : scope === 'incoming'
                    ? 'Новых заявок нет'
                    : scope === 'outgoing'
                      ? 'Нет исходящих заявок'
                      : 'Пока здесь только ты'}
            </h3>
            <p>
              {query.trim()
                ? 'Попробуй другое имя или проверь выбранный раздел.'
                : 'Новые знакомства начинаются со зрителя и одной истории.'}
            </p>
            {(scope !== 'all' || query) && (
              <button
                type="button"
                className="outline-btn"
                onClick={() => {
                  setScope('all');
                  setQuery('');
                }}
              >
                Показать всех зрителей
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
