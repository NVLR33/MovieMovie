'use client';
import MaterialCover from './material-cover';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus,
  RefreshCw,
  Search,
  Shield,
  Film,
  Users,
  MessageCircle,
  ClipboardList,
  LayoutDashboard,
  Pencil,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { permissionsFor } from '@/lib/permissions';
import type { Film as Material } from '@/lib/data';
import type { MovieSuggestion } from '@/lib/movie-suggestions';
import SuggestionsQueue from './suggestions-queue';
import './admin-workspace.css';
type Action = (
  payload: Record<string, unknown>,
  success?: string,
) => Promise<boolean>;
type Person = {
  id: number;
  username: string;
  email: string;
  role: string;
  isEditor: boolean;
  isSuspended: boolean;
  suspensionReason: string | null;
  xp: number;
  createdAt: string;
  watches: number;
  reviews: number;
};
type Review = {
  id: number;
  body: string;
  spoiler: boolean;
  parentId: number | null;
  createdAt: string;
  username: string;
  movieId: number;
  title: string;
};
type Audit = {
  id: number;
  actorName: string;
  action: string;
  targetType: string;
  targetId: number | null;
  summary: string;
  details: Record<string, unknown>;
  createdAt: string;
};
type PageData = {
  items?: (Person | Review | Audit)[];
  total?: number;
  pages?: number;
  catalogue?: Record<string, number>;
  moderation?: Record<string, number> | null;
  accounts?: Record<string, number> | null;
};
type Confirmation = {
  title: string;
  description: string;
  reason?: boolean;
  danger?: boolean;
  confirm: (reason: string) => Promise<boolean>;
};
const roles: Record<string, string> = {
  visitor: 'Посетитель',
  vip: 'VIP',
  moderator: 'Модератор',
  admin: 'Администратор',
};
const actions: Record<string, string> = {
  'user.role': 'Смена роли',
  'user.editor': 'Право редактора',
  'user.suspend': 'Блокировка / разблокировка',
  'user.revokeSessions': 'Отзыв сессий',
  'movie.create': 'Публикация материала',
  'movie.update': 'Правка материала',
  'movie.delete': 'Удаление материала',
  'movie.featured': 'Изменение витрины',
  'movie.club': 'Фильм недели',
  'comment.delete': 'Удаление комментария',
  'comment.spoiler': 'Отметка спойлера',
  'suggestion.approve': 'Принятие предложения',
  'suggestion.reject': 'Отклонение предложения',
  'series.saveSeason': 'Сезон: сохранение',
  'series.deleteSeason': 'Сезон: удаление',
  'series.saveEpisode': 'Серия: сохранение',
  'series.publish': 'Публикация списка серий',
};
const categories = [
  'Все категории',
  'Фильм',
  'Сериал',
  'Мультфильм',
  'Мультсериал',
  'Аниме-фильм',
  'Аниме-сериал',
];
const date = (value: string) =>
  new Date(value).toLocaleString('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
function ConfirmationDialog({
  config,
  close,
}: {
  config: Confirmation;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    pending = useRef(false);
  const [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="admin-confirm"
      aria-labelledby="admin-confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!pending.current) close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending.current) close();
      }}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (pending.current) return;
          pending.current = true;
          setBusy(true);
          try {
            if (await config.confirm(reason)) close();
          } finally {
            pending.current = false;
            setBusy(false);
          }
        }}
      >
        <h2 id="admin-confirm-title">{config.title}</h2>
        <p>{config.description}</p>
        {config.reason && (
          <label>
            Причина
            <textarea
              autoFocus
              required
              maxLength={500}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        )}
        <div className="admin-buttons">
          <button type="button" disabled={busy} onClick={close}>
            Отмена
          </button>
          <button
            className={config.danger ? 'admin-danger' : 'primary-btn'}
            disabled={busy || (config.reason && !reason.trim())}
          >
            {busy ? 'Выполняется…' : 'Подтвердить'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
function WorkspaceBody({
  data,
  go,
  action,
  edit,
  review,
  refresh,
}: {
  data: {
    user: { id: number; role: string; isEditor?: boolean } | null;
    films: Material[];
    suggestions: MovieSuggestion[];
    pendingSuggestionsCount: number;
  };
  go: (url: string) => void;
  action: Action;
  edit: (film: Material | null) => void;
  review: (proposal: MovieSuggestion) => void;
  refresh: () => Promise<void>;
}) {
  const router = useRouter(),
    params = useSearchParams(),
    permissions = permissionsFor(data.user);
  const tabs = [
    { id: 'overview', label: 'Обзор', icon: LayoutDashboard },
    { id: 'films', label: 'Материалы', icon: Film },
    ...(permissions.moderate
      ? [
          { id: 'suggestions', label: 'Предложения', icon: ClipboardList },
          { id: 'comments', label: 'Комментарии', icon: MessageCircle },
        ]
      : []),
    ...(permissions.manageUsers
      ? [
          { id: 'users', label: 'Пользователи и роли', icon: Users },
          { id: 'audit', label: 'Журнал действий', icon: Shield },
        ]
      : []),
  ];
  const tab = tabs.some((t) => t.id === params.get('tab'))
    ? params.get('tab')!
    : 'overview';
  const [query, setQuery] = useState(''),
    [debounced, setDebounced] = useState(''),
    [filter, setFilter] = useState('all'),
    [state, setState] = useState('all'),
    [sort, setSort] = useState('newest'),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0);
  const [result, setResult] = useState<PageData | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [confirmation, setConfirmation] = useState<Confirmation | null>(null),
    [selected, setSelected] = useState<number[]>([]);
  const pending = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(query);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    if (!permissions.access || ['films', 'suggestions'].includes(tab)) {
      return;
    }
    const controller = new AbortController();
    // Loading state belongs to this abortable remote-resource lifecycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError('');
    setResult(null);
    const search = new URLSearchParams({
      section: tab,
      page: String(page),
      q: debounced,
    });
    if (tab === 'users') {
      search.set('role', filter);
      search.set('state', state);
      search.set('sort', sort);
    }
    if (tab === 'comments') search.set('state', state);
    if (tab === 'audit' && filter !== 'all') search.set('action', filter);
    fetch(`/api/admin?${search}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const value = await response.json();
        if (!response.ok) throw new Error(value.error || 'Ошибка загрузки');
        return value;
      })
      .then((value: PageData) => {
        setResult(value);
        if (value.pages && page > value.pages) setPage(value.pages);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [
    tab,
    page,
    debounced,
    filter,
    state,
    sort,
    revision,
    permissions.access,
    data.user?.role,
  ]);
  const reload = () => setRevision((n) => n + 1);
  const changeTab = (id: string) => {
    router.replace(`/admin?tab=${id}`, { scroll: false });
  };
  const run = async (body: Record<string, unknown>) => {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || 'Не удалось сохранить');
      setNotice('Изменения сохранены');
      reload();
      await refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка запроса');
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const mutate: Action = async (payload, message) => {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    try {
      const ok = await action(payload, message);
      if (ok) reload();
      return ok;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  if (!permissions.access)
    return (
      <div className="gate">
        <Shield size={40} />
        <h1>Доступ закрыт</h1>
        <p>Для этого раздела нужны права команды или редактора.</p>
        <button onClick={() => go('/')} className="primary-btn">
          На главную
        </button>
      </div>
    );
  let films = data.films.filter(
    (f) =>
      (!debounced ||
        `${f.title} ${f.originalTitle || ''} ${f.id}`
          .toLowerCase()
          .includes(debounced.toLowerCase())) &&
      (filter === 'all' || f.category === filter) &&
      (state !== 'featured' || f.featured) &&
      (state !== 'incomplete' ||
        !f.description ||
        !f.genre ||
        !f.country ||
        !f.poster),
  );
  films = [...films].sort((a, b) =>
    sort === 'name'
      ? a.title.localeCompare(b.title, 'ru')
      : sort === 'oldest'
        ? a.id - b.id
        : sort === 'views'
          ? (b.views || 0) - (a.views || 0)
          : b.id - a.id,
  );
  const pages =
      tab === 'films' ? Math.ceil(films.length / 25) : result?.pages || 0,
    total = tab === 'films' ? films.length : result?.total || 0;
  const pageFilms = films.slice((page - 1) * 25, page * 25);
  const pickFilter = (value: string) => {
    setFilter(value);
    setPage(1);
    setSelected([]);
  };
  const pickState = (value: string) => {
    setState(value);
    setPage(1);
    setSelected([]);
  };
  const stats: [string, number | undefined][] = [
    ['Материалов', result?.catalogue?.materials],
    ['На витрине', result?.catalogue?.featured],
    ['Неполные карточки', result?.catalogue?.incomplete],
    ...(permissions.moderate
      ? ([
          ['Ждут проверки', result?.moderation?.pending],
          ['Участников', result?.moderation?.members],
          ['Новых за 7 дней', result?.moderation?.new_members],
          ['Просмотров за 7 дней', result?.moderation?.weekly_watches],
          ['Комментариев', result?.moderation?.comments],
        ] as [string, number | undefined][])
      : []),
    ...(permissions.manageUsers
      ? ([
          ['Редакторов', result?.accounts?.editors],
          ['Заблокировано', result?.accounts?.suspended],
        ] as [string, number | undefined][])
      : []),
  ];
  return (
    <section className="admin-workspace" aria-label="Центр управления">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ЦЕНТР УПРАВЛЕНИЯ</span>
          <h1>
            За кадром <em>moviemovie.</em>
          </h1>
          <p>Каталог, сообщество и порядок — в одном месте.</p>
        </div>
        <div className="admin-buttons">
          <button
            disabled={busy || loading}
            onClick={() => {
              reload();
              void refresh();
            }}
            title="Обновить данные"
          >
            <RefreshCw size={17} />
            <span>Обновить</span>
          </button>
          {permissions.create && (
            <button className="primary-btn" onClick={() => edit(null)}>
              <Plus size={18} />
              Добавить материал
            </button>
          )}
        </div>
      </div>
      <div className="admin-access-note">
        <Shield size={18} />
        <span>
          <b>
            {roles[data.user!.role]}
            {data.user!.isEditor ? ' · Редактор' : ''}.
          </b>{' '}
          {permissions.manageUsers
            ? 'Полный доступ. Важные действия фиксируются в журнале.'
            : permissions.moderate
              ? 'Материалы, предложка и модерация. Аккаунты и настройки витрины закрыты.'
              : 'Вы можете публиковать новые материалы. Редактирование чужих карточек и модерация недоступны.'}
        </span>
      </div>
      <nav className="admin-tabs" aria-label="Разделы управления">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => changeTab(id)}
          >
            <Icon size={17} />
            {label}
            {id === 'suggestions' && data.pendingSuggestionsCount > 0 && (
              <small>{data.pendingSuggestionsCount}</small>
            )}
          </button>
        ))}
      </nav>
      {error && (
        <div className="admin-error" role="alert">
          {error}
          <button onClick={reload}>Повторить загрузку</button>
        </div>
      )}
      {notice && (
        <p className="admin-notice" role="status">
          {notice}
        </p>
      )}
      {tab === 'overview' ? (
        <>
          {loading ? (
            <p role="status">Загружаем показатели…</p>
          ) : (
            result && (
              <>
                <div className="admin-metrics">
                  {stats.map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <b>{(value || 0).toLocaleString('ru-RU')}</b>
                    </div>
                  ))}
                </div>
                <div className="admin-overview-grid">
                  <article className="admin-panel">
                    <h2>С чего начнём?</h2>
                    <p>Быстрый переход к повседневным задачам.</p>
                    <div className="admin-quick-actions">
                      <button onClick={() => changeTab('films')}>
                        Каталог и качество карточек <ExternalLink size={16} />
                      </button>
                      {permissions.moderate && (
                        <button onClick={() => changeTab('suggestions')}>
                          Проверить предложенные материалы{' '}
                          <b>{data.pendingSuggestionsCount}</b>
                        </button>
                      )}
                      {permissions.manageUsers && (
                        <button onClick={() => changeTab('users')}>
                          Выдать право «Редактор» <ExternalLink size={16} />
                        </button>
                      )}
                    </div>
                  </article>
                  <article className="admin-panel">
                    <h2>Кто что может</h2>
                    <dl className="admin-permissions">
                      <dt>Администратор</dt>
                      <dd>
                        Все инструменты, роли, редакторы, блокировки, сессии,
                        витрина, фильм недели и журнал.
                      </dd>
                      <dt>Модератор</dt>
                      <dd>
                        Добавление и правка материалов, сезоны и серии,
                        предложка и комментарии. Без удаления материалов и
                        доступа к аккаунтам.
                      </dd>
                      <dt>Редактор — отдельная галочка</dt>
                      <dd>
                        Публикация новых материалов для пользователя любой роли.
                        Никаких административных полномочий.
                      </dd>
                    </dl>
                  </article>
                </div>
              </>
            )
          )}
        </>
      ) : tab === 'suggestions' ? (
        <SuggestionsQueue
          suggestions={data.suggestions}
          films={data.films}
          go={go}
          review={review}
          action={mutate}
        />
      ) : (
        <>
          <div className="admin-toolbar">
            <label className="admin-search">
              <Search size={17} />
              <input
                aria-label="Поиск в разделе"
                maxLength={150}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  tab === 'users'
                    ? 'Имя, почта или ID'
                    : tab === 'comments'
                      ? 'Текст, автор или материал'
                      : tab === 'audit'
                        ? 'Действие или участник'
                        : 'Название или ID материала'
                }
              />
            </label>
            {tab === 'films' && (
              <>
                <Select
                  label="Категория материалов"
                  value={filter}
                  onChange={pickFilter}
                  options={categories.map((c, i) => [i === 0 ? 'all' : c, c])}
                />
                <Select
                  label="Качество материалов"
                  value={state}
                  onChange={pickState}
                  options={[
                    ['all', 'Все карточки'],
                    ['featured', 'На витрине'],
                    ['incomplete', 'Неполные карточки'],
                  ]}
                />
              </>
            )}
            {tab === 'users' && (
              <>
                <Select
                  label="Роль или право"
                  value={filter}
                  onChange={pickFilter}
                  options={[
                    ['all', 'Все роли'],
                    ...Object.entries(roles),
                    ['editor', 'Только редакторы'],
                  ]}
                />
                <Select
                  label="Состояние аккаунта"
                  value={state}
                  onChange={pickState}
                  options={[
                    ['all', 'Любое состояние'],
                    ['active', 'Активные'],
                    ['suspended', 'Заблокированные'],
                  ]}
                />
              </>
            )}
            {tab === 'comments' && (
              <Select
                label="Тип комментариев"
                value={state}
                onChange={pickState}
                options={[
                  ['all', 'Все комментарии'],
                  ['spoiler', 'Со спойлером'],
                  ['reply', 'Ответы'],
                ]}
              />
            )}
            {tab === 'audit' && (
              <Select
                label="Тип действия"
                value={filter}
                onChange={pickFilter}
                options={[['all', 'Все действия'], ...Object.entries(actions)]}
              />
            )}
            {['films', 'users'].includes(tab) && (
              <Select
                label="Сортировка"
                value={sort}
                onChange={(v) => {
                  setSort(v);
                  setPage(1);
                }}
                options={[
                  ['newest', 'Сначала новые'],
                  ['oldest', 'Сначала старые'],
                  ['name', 'По имени'],
                  tab === 'films'
                    ? ['views', 'По посещениям']
                    : ['xp', 'По опыту'],
                ]}
              />
            )}
          </div>
          {tab === 'films' && permissions.curate && selected.length > 0 && (
            <div className="admin-selection">
              <b>Выбрано: {selected.length}</b>
              <button
                disabled={busy}
                onClick={() =>
                  void run({
                    command: 'featured',
                    ids: selected,
                    enabled: true,
                  })
                }
              >
                На витрину
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void run({
                    command: 'featured',
                    ids: selected,
                    enabled: false,
                  })
                }
              >
                Снять с витрины
              </button>
              <button onClick={() => setSelected([])}>Сбросить выбор</button>
            </div>
          )}
          {tab !== 'films' && loading ? (
            <p role="status">Загружаем…</p>
          ) : (
            <>
              <div className="admin-results">
                <span>Найдено: {total}</span>
                {tab === 'films' &&
                  permissions.curate &&
                  pageFilms.length > 0 && (
                    <label>
                      <input
                        type="checkbox"
                        checked={pageFilms.every((f) =>
                          selected.includes(f.id),
                        )}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked ? pageFilms.map((f) => f.id) : [],
                          )
                        }
                      />
                      Выбрать страницу
                    </label>
                  )}
              </div>
              {total === 0 && !error && (
                <div className="admin-empty">
                  <Search size={28} />
                  <h2>Пока пусто</h2>
                  <p>
                    Здесь появятся записи. Попробуйте изменить поиск или
                    фильтры.
                  </p>
                </div>
              )}
              <div className="admin-records">
                {tab === 'films' &&
                  pageFilms.map((f) => (
                    <article key={f.id} className="admin-material admin-panel">
                      {permissions.curate && (
                        <input
                          aria-label={`Выбрать «${f.title}»`}
                          type="checkbox"
                          checked={selected.includes(f.id)}
                          disabled={
                            !selected.includes(f.id) && selected.length >= 50
                          }
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? [...selected, f.id]
                                : selected.filter((id) => id !== f.id),
                            )
                          }
                        />
                      )}
                      <button
                        className="admin-poster"
                        onClick={() => go(`/movie/${f.id}`)}
                      >
                        <MaterialCover film={f} badges={false} preview={false} alt={f.title} />
                      </button>
                      <div className="admin-material-info">
                        <button
                          className="admin-title"
                          onClick={() => go(`/movie/${f.id}`)}
                        >
                          {f.title}
                        </button>
                        <p>
                          {f.year} · {f.category} · ID {f.id}
                        </p>
                        <div className="admin-tags">
                          {f.featured && <span>На витрине</span>}
                          {(!f.country ||
                            !f.genre ||
                            !f.description ||
                            !f.poster) && (
                            <span className="warning">Неполная карточка</span>
                          )}
                          <span>{f.views || 0} посещений</span>
                        </div>
                      </div>
                      <div className="admin-buttons">
                        {permissions.edit && (
                          <button
                            onClick={() => edit(f)}
                            aria-label={`Редактировать «${f.title}»`}
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                        {permissions.curate && (
                          <>
                            <button
                              disabled={busy}
                              onClick={() =>
                                void run({
                                  command: 'featured',
                                  ids: [f.id],
                                  enabled: !f.featured,
                                })
                              }
                            >
                              {f.featured ? 'Снять с витрины' : 'На витрину'}
                            </button>
                            <button
                              disabled={busy}
                              onClick={() =>
                                setConfirmation({
                                  title: 'Выбрать фильм недели?',
                                  description: `«${f.title}» заменит текущий фильм киноклуба.`,
                                  confirm: () =>
                                    run({ command: 'club', movieId: f.id }),
                                })
                              }
                            >
                              В киноклуб
                            </button>
                            <button
                              className="admin-danger"
                              aria-label={`Удалить «${f.title}»`}
                              onClick={() =>
                                setConfirmation({
                                  title: `Удалить «${f.title}»?`,
                                  description:
                                    'Необратимо: будут удалены оценки, просмотры, комментарии и связанные записи этого материала. Действие попадёт в журнал.',
                                  danger: true,
                                  confirm: () =>
                                    mutate(
                                      { action: 'movieDelete', id: f.id },
                                      'Материал удалён',
                                    ),
                                })
                              }
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  ))}
                {tab === 'users' &&
                  (result?.items as Person[] | undefined)?.map((p) => (
                    <article className="admin-panel admin-account" key={p.id}>
                      <div className="admin-account-heading">
                        <div>
                          <button
                            className="admin-title"
                            onClick={() => go(`/user/${p.id}`)}
                          >
                            {p.username}
                          </button>
                          <p>
                            {p.email} · ID {p.id}
                          </p>
                        </div>
                        <div className="admin-tags">
                          <span>{roles[p.role] || p.role}</span>
                          {p.isEditor && <span>Редактор</span>}
                          {p.isSuspended && (
                            <span className="warning">Заблокирован</span>
                          )}
                        </div>
                      </div>
                      <p className="admin-muted">
                        {p.xp || 0} XP · {p.watches} просмотров · {p.reviews}{' '}
                        комментариев · Регистрация: {date(p.createdAt)}
                      </p>
                      {p.isSuspended && (
                        <p className="admin-block-reason">
                          Причина: {p.suspensionReason}
                        </p>
                      )}
                      <div className="admin-account-controls">
                        <label>
                          Основная роль
                          <select
                            aria-label={`Роль ${p.username}`}
                            disabled={busy || p.id === data.user!.id}
                            value={p.role}
                            onChange={(e) => {
                              const role = e.target.value;
                              setConfirmation({
                                title: `Изменить роль ${p.username}?`,
                                description: `${roles[p.role]} → ${roles[role]}. ${role === 'admin' ? 'Полный доступ к аккаунтам и удалению материалов. ' : ''}Текущие сессии пользователя завершатся.`,
                                confirm: () =>
                                  run({ command: 'role', userId: p.id, role }),
                              });
                            }}
                          >
                            {Object.entries(roles).map(([v, l]) => (
                              <option key={v} value={v}>
                                {l}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="admin-editor-toggle">
                          <input
                            type="checkbox"
                            aria-label={`Редактор ${p.username}`}
                            checked={p.isEditor}
                            disabled={busy || p.id === data.user!.id}
                            onChange={(e) => {
                              const enabled = e.target.checked;
                              setConfirmation({
                                title: `${enabled ? 'Выдать' : 'Отозвать'} право редактора?`,
                                description: `${p.username}: право публиковать новые материалы, независимо от роли. Управление аккаунтами и модерация не предоставляются.`,
                                confirm: () =>
                                  run({
                                    command: 'editor',
                                    userId: p.id,
                                    enabled,
                                  }),
                              });
                            }}
                          />
                          <span>
                            <b>Редактор</b>
                            <small>Может добавлять материалы</small>
                          </span>
                        </label>
                        <div className="admin-buttons">
                          <button
                            disabled={
                              busy ||
                              p.id === data.user!.id ||
                              p.role === 'admin'
                            }
                            onClick={() =>
                              setConfirmation({
                                title: `${p.isSuspended ? 'Разблокировать' : 'Заблокировать'} ${p.username}?`,
                                description: p.isSuspended
                                  ? 'Пользователь снова сможет войти в аккаунт. Старые сессии не восстановятся.'
                                  : 'Пользователь будет немедленно выведен из аккаунта и не сможет войти до разблокировки. Публичные материалы сохранятся.',
                                reason: !p.isSuspended,
                                danger: !p.isSuspended,
                                confirm: (reason) =>
                                  run({
                                    command: 'suspend',
                                    userId: p.id,
                                    enabled: !p.isSuspended,
                                    reason,
                                  }),
                              })
                            }
                          >
                            {p.isSuspended ? 'Разблокировать' : 'Заблокировать'}
                          </button>
                          <button
                            disabled={busy || p.id === data.user!.id}
                            onClick={() =>
                              setConfirmation({
                                title: 'Завершить все сессии?',
                                description: `${p.username} потребуется снова войти на всех устройствах.`,
                                confirm: () =>
                                  run({
                                    command: 'revokeSessions',
                                    userId: p.id,
                                  }),
                              })
                            }
                          >
                            Завершить сессии
                          </button>
                        </div>
                      </div>
                      {p.id === data.user!.id && (
                        <small className="admin-muted">
                          Собственные права защищены от изменения.
                        </small>
                      )}
                    </article>
                  ))}
                {tab === 'comments' &&
                  (result?.items as Review[] | undefined)?.map((c) => (
                    <article className="admin-panel admin-comment" key={c.id}>
                      <div className="admin-account-heading">
                        <b>{c.username}</b>
                        <small>
                          {date(c.createdAt)} · #{c.id}
                        </small>
                      </div>
                      <button
                        className="admin-link"
                        onClick={() => go(`/movie/${c.movieId}`)}
                      >
                        {c.title} ↗
                      </button>
                      <p className="admin-comment-body">{c.body}</p>
                      <div className="admin-buttons">
                        {c.parentId && <small>Ответ на #{c.parentId}</small>}
                        <button
                          disabled={busy}
                          onClick={() =>
                            void mutate(
                              {
                                action: 'commentSpoiler',
                                commentId: c.id,
                                spoiler: !c.spoiler,
                              },
                              'Отметка спойлера изменена',
                            )
                          }
                        >
                          {c.spoiler ? 'Убрать спойлер' : 'Отметить спойлер'}
                        </button>
                        <button
                          disabled={busy}
                          className="admin-danger"
                          onClick={() =>
                            setConfirmation({
                              title: 'Удалить комментарий?',
                              description:
                                'Комментарий и его ветка ответов будут удалены. Автор получит уведомление с причиной.',
                              reason: true,
                              danger: true,
                              confirm: (reason) =>
                                mutate(
                                  {
                                    action: 'commentDelete',
                                    commentId: c.id,
                                    reason,
                                  },
                                  'Комментарий удалён',
                                ),
                            })
                          }
                        >
                          Удалить с причиной
                        </button>
                      </div>
                    </article>
                  ))}
                {tab === 'audit' &&
                  (result?.items as Audit[] | undefined)?.map((a) => (
                    <article className="admin-panel admin-audit" key={a.id}>
                      <div className="admin-account-heading">
                        <b>{actions[a.action] || a.action}</b>
                        <small>{date(a.createdAt)}</small>
                      </div>
                      <p>{a.summary}</p>
                      <small className="admin-muted">
                        {a.actorName} · {a.targetType} #{a.targetId} · запись #
                        {a.id}
                      </small>
                      <details>
                        <summary>Подробности</summary>
                        <pre>{JSON.stringify(a.details, null, 2)}</pre>
                      </details>
                    </article>
                  ))}
              </div>
              {pages > 1 && (
                <div className="admin-pagination">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Назад
                  </button>
                  <span>
                    Страница {page} из {pages}
                  </span>
                  <button
                    disabled={page >= pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Далее
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
      {confirmation && (
        <ConfirmationDialog
          config={confirmation}
          close={() => setConfirmation(null)}
        />
      )}
    </section>
  );
}
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map(([v, l]) => (
        <option value={v} key={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

export default function AdminWorkspace(
  props: Parameters<typeof WorkspaceBody>[0],
) {
  const params = useSearchParams();
  // Remount section-local filters on navigation (including browser back/forward).
  return (
    <WorkspaceBody
      key={`${params.get('tab') || 'overview'}:${props.data.user?.role}:${props.data.user?.isEditor}`}
      {...props}
    />
  );
}
