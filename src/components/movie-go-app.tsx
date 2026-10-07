'use client';
/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Home, Clapperboard, Compass, Trophy, Gamepad2, Users, Bookmark, Shield, Search,
  Bell, Sun, Moon, ChevronDown, ChevronRight, ArrowUpRight, ArrowRight, Play,
  Plus, Star, Clock3, CalendarDays, Sparkles, Shuffle, Heart, MessageCircle,
  Send, Settings2, LogOut, Menu, X, Film, Flame, Eye, SlidersHorizontal, Check,
  Pencil, Trash2, Upload, Copy, Share2, Crown, Zap, Award, GripVertical,
  RotateCcw, ExternalLink, Volume2, Timer, Layers3, MonitorPlay, UserPlus,
  CheckCircle2, LockKeyhole, TrendingUp, BarChart3, BookOpen, GitBranch, Globe2,
  CircleHelp, Tv2, Link2, UsersRound
} from 'lucide-react';
import type { Film as FilmType } from '@/lib/data';

// --- Types ---
type User = {
  id: number; email: string; username: string; role: string; bio: string | null; avatar: string | null;
  theme: string | null; language: string | null; headerStyle: number | null; headerImage: string | null;
  avatarFrame: string | null; headerFrame: string | null; profileEffect: string | null; nameEffect: string | null;
  nameColor: string | null; tileOrder: string | null; xp: number | null; createdAt: string;
};
type Watch = { id: number; movieId: number; watchedAt: string; };
type Rating = { id: number; movieId: number; value: number; };
type Comment = {
  id: number; movieId: number; parentId: number | null; body: string; likes: number | null; createdAt: string;
  author: { id: number; username: string; avatar: string | null; role: string; };
};
type Person = { id: number; username: string; avatar: string | null; role: string; xp: number | null; };
type Friend = { id: number; fromId: number; toId: number; status: string; };
type Notice = { id: number; message: string; link: string | null; read: boolean; createdAt: string; };
type Leader = Person & { watches: number; minutes: number; streak: number; ratings: number; gameScore: number; };
type FriendActivity = { id: number; username: string; avatar: string | null; watches: number; minutes: number; lastWatch: string | null; commonFilms: number; };
type ChatConversation = { peer: { id: number; username: string; avatar: string | null; role: string; xp: number | null; }; lastMessage: string; lastMessageAt: string; unread: number; hasFilm: boolean; };
type ChatMessage = { id: number; fromId: number; toId: number; body: string; movieId: number | null; read: boolean; createdAt: string; film: { id: number; title: string; poster: string; year: number; category: string; } | null; };
type ProfileData = {
  profile: User;
  stats: {
    totalWatches: number; uniqueFilms: number; totalMinutes: number; totalRatings: number; totalComments: number;
    totalBookmarks: number; activeDays: number; categories: { name: string; count: number; minutes: number; }[];
    topGenres: { genre: string; count: number; }[]; level: number;
  };
  recentWatches: { watchedAt: string; film: FilmType | null; }[];
  ratings: { movieId: number; value: number; title: string; }[];
  friendship: { status: string | null; id: number | null; };
  isSelf: boolean;
  compatibility?: number;
};
type Data = {
  films: FilmType[]; user: User | null; people: Person[]; watches: Watch[]; ratings: Rating[]; comments: Comment[];
  bookmarks: { movieId: number; }[]; friends: Friend[]; notifications: Notice[]; scores: { game: string; score: number; }[];
  leaderboard: Leader[]; friendsActivity: FriendActivity[]; unreadMessages: number; lists: any[]; club: any;
  onThisDay: { text: string; icon: string; }[]; cineDay: { label: string; filter?: string; icon: string; };
  monthlySummary: { watches: number; minutes: number; topGenre: string; avgRating: string; achievements: number; } | null;
  challenges: any[]; season: any;
};

// --- Constants & Helpers ---
const categories = ['Все', 'Фильм', 'Сериал', 'Мультфильм', 'Мультсериал', 'Аниме-сериал', 'Аниме-фильм'];
const genres = ['Все жанры', 'Фантастика', 'Драма', 'Приключения', 'Анимация', 'Боевик', 'Комедия', 'Аниме', 'Детектив', 'Фэнтези', 'Биография'];
const themes = ['dark', 'light', 'pink', 'purple', 'yellow'];
const blank: Data = {
  films: [], user: null, people: [], watches: [], ratings: [], comments: [], bookmarks: [], friends: [], notifications: [],
  scores: [], leaderboard: [], friendsActivity: [], unreadMessages: 0, lists: [], club: null, onThisDay: [],
  cineDay: { label: '', icon: '🎬' }, monthlySummary: null, challenges: [], season: null
};
const image = (f: FilmType) => f.poster || '/posters/dune.jpg';
const titleMinutes = (f: FilmType) => ['Сериал', 'Мультсериал', 'Аниме-сериал'].includes(f.category) ? f.duration * (f.episodes || 1) : f.duration;
const tone = (r: number) => r >= 8.5 ? 'gold' : r >= 7 ? 'teal' : r >= 5 ? 'blue' : 'red';
const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(n);
function initials(s: string) { return s.slice(0, 2).toUpperCase(); }
function titleFor(user: User | null, watches: number) {
  if (!user) return 'Гость';
  if (watches >= 30) return 'Легенда экрана';
  if (watches >= 15) return 'Мастер кадров';
  if (watches >= 5) return 'Киноискатель';
  return 'Начинающий зритель';
}

// --- WatchedIds global context (single source of truth for badges) ---
const WatchedIdsContext = createContext<Set<number>>(new Set());
const useWatchedIds = () => useContext(WatchedIdsContext);

function Avatar({ name, src, size = 36, frame = 'none' }: { name: string; src?: string | null; size?: number; frame?: string | null; }) {
  return (
    <span className={`avatar avatar-${frame || 'none'}`} style={{ width: size, height: size, fontSize: size * 0.28 }}>
      {src ? <img src={src} alt={name} /> : initials(name)}
    </span>
  );
}

/**
 * PosterThumb — универсальная миниатюра с галочкой "просмотрено"
 * Использовать везде, где раньше был <img ...poster.../>.
 * movieId опционален: если не передать — галочка не показывается.
 */
function PosterThumb({
  movieId,
  src,
  alt = '',
  wrapClassName,
  imgClassName,
  wrapStyle,
}: {
  movieId?: number | null;
  src?: string | null;
  alt?: string;
  wrapClassName?: string;
  imgClassName?: string;
  wrapStyle?: React.CSSProperties;
}) {
  const watchedIds = useWatchedIds();
  const watched = typeof movieId === 'number' && watchedIds.has(movieId);

  // если src пустой — не ломаем верстку
  const finalSrc = src || '/posters/dune.jpg';

  return (
    <span
      className={wrapClassName}
      style={{
        position: 'relative',
        display: 'inline-block',
        flex: 'none',
        ...wrapStyle,
      }}
    >
      <img className={imgClassName} src={finalSrc} alt={alt} />
      {watched && (
        <span
          title="Просмотрено"
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            width: 22,
            height: 22,
            borderRadius: 999,
            background: 'rgba(45, 212, 191, 0.95)',
            color: '#071018',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 25px rgba(0,0,0,.35)',
            zIndex: 2,
          }}
        >
          <CheckCircle2 size={14} />
        </span>
      )}
    </span>
  );
}

/* --- БРЕНД: НОВЫЙ ЛОГОТИП "moviemovie" (movie над movie) --- */
function BrandWordmark({ size = 15, align = 'left' }: { size?: number; align?: 'left' | 'center'; }) {
  return (
    <span
      className="brand-wordmark-stack"
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        lineHeight: 1.02,
        fontWeight: 800,
        letterSpacing: '-0.02em',
        fontSize: size,
        textAlign: align,
      }}
    >
      <span className="brand-wordmark-top" style={{ opacity: 1 }}>movie</span>
      <span className="brand-wordmark-bottom" style={{ opacity: 0.55, marginTop: Math.max(1, Math.round(size * 0.08)) }}>movie</span>
    </span>
  );
}

// --- Main Shell Component ---
export default function MovieGoApp({ initialFilms }: { initialFilms: FilmType[] }) {
  const router = useRouter(), path = usePathname(), searchParams = useSearchParams();
  const [data, setData] = useState<Data>({ ...blank, films: initialFilms });
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState('dark');
  const [lang, setLang] = useState('ru');
  const [search, setSearch] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [roulette, setRoulette] = useState(false);
  const [rouletteIndex, setRouletteIndex] = useState(0);
  const [rouletteDone, setRouletteDone] = useState(false);
  const [rouletteCategory, setRouletteCategory] = useState('Все');
  const [spinning, setSpinning] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState('');
  const [shareFilm, setShareFilm] = useState<FilmType | null>(null);
  const [editFilm, setEditFilm] = useState<FilmType | null | undefined>(undefined);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPeerId, setChatPeerId] = useState<number | null>(null);

  // оптимизация: один стабильный Set для watched
  const watchedIds = useMemo(() => new Set<number>(data.watches.map(w => w.movieId)), [data.watches]);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
const notify = (s: string) => {
  setToast(s);
  if (toastTimer.current) clearTimeout(toastTimer.current);
  toastTimer.current = setTimeout(() => setToast(''), 3700);
};

  const refresh = async () => {
    try {
      const r = await fetch('/api/data', { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        setData(d);
        if (d.user) {
          setTheme(localStorage.getItem('mg_theme') || d.user.theme || 'dark');
          setLang(localStorage.getItem('mg_lang') || d.user.language || 'ru');
        }
      }
    } catch {
      notify('Не удалось обновить данные');
    } finally {
      setLoading(false);
    }
  };

useEffect(() => {
  refresh()

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('mg_theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('mg_lang', lang); }, [lang]);

  const go = (url: string) => {
    router.push(url);
    setMobileNav(false);
    setNoticeOpen(false);
    setProfileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const action = async (payload: Record<string, unknown>, success?: string) => {
    try {
      const r = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const d = await r.json();
      if (!r.ok) {
        if (r.status === 401) setAuthOpen(true);
        notify(d.error || 'Ошибка');
        return false;
      }
      await refresh();
      if (success) notify(success);
      return true;
    } catch {
      notify('Ошибка соединения');
      return false;
    }
  };

  const requireAuth = (fn: () => void) => { if (!data.user) setAuthOpen(true); else fn(); };
  const changeTheme = (t: string) => { setTheme(t); if (data.user) action({ action: 'profile', theme: t }); };
  const changeLang = () => { const next = lang === 'ru' ? 'en' : 'ru'; setLang(next); if (data.user) action({ action: 'profile', language: next }); };

  const en = lang === 'en';
  const words = {
    home: en ? 'Home' : 'Главная',
    catalog: en ? 'Catalog' : 'Каталог',
    leaderboard: en ? 'Leaderboard' : 'Рейтинг',
    achievements: en ? 'Achievements' : 'Достижения',
    games: en ? 'Mini games' : 'Мини-игры',
    friends: en ? 'Friends' : 'Друзья',
    watchlist: en ? 'My list' : 'Мой список',
    profile: en ? 'My profile' : 'Мой профиль',
    admin: en ? 'Admin panel' : 'Админ-панель',
    search: en ? 'Search titles, genres, directors...' : 'Поиск фильмов, жанров, режиссёров...',
    login: en ? 'Sign in' : 'Войти'
  };

  const unread = data.notifications.filter(n => !n.read).length;
  const filmId = path?.startsWith('/movie/') ? Number(path.split('/')[2]) : 0;
  const viewUserId = path?.startsWith('/user/') ? Number(path.split('/')[2]) : 0;
  const compareId = path?.startsWith('/compare/') ? Number(path.split('/')[2]) : 0;
  const roomId = path?.startsWith('/room/') ? path.split('/')[2] : '';
  const active = filmId ? 'movie' : viewUserId ? 'viewuser' : compareId ? 'compare' : roomId ? 'room' : path?.split('/')[1] || 'home';
  const openChat = (peerId: number) => { setChatPeerId(peerId); setChatOpen(true); };

  const nav = [
    { id: 'home', label: words.home, icon: Home, url: '/' },
    { id: 'catalog', label: words.catalog, icon: Compass, url: '/catalog' },
    { id: 'watchlist', label: words.watchlist, icon: Bookmark, url: '/watchlist' },
    { id: 'collab', label: en ? 'Lists' : 'Подборки', icon: Layers3, url: '/collab' },
    { id: 'leaderboard', label: words.leaderboard, icon: BarChart3, url: '/leaderboard' },
    { id: 'achievements', label: words.achievements, icon: Trophy, url: '/achievements' },
    { id: 'challenges', label: en ? 'Challenges' : 'Челленджи', icon: Flame, url: '/challenges' },
    { id: 'games', label: words.games, icon: Gamepad2, url: '/games' }
  ];

const rouletteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
const spinningRef = useRef(false);

const startRoulette = () => {
  if (spinningRef.current) return; // защита от двойного запуска
  const pool = rouletteCategory === 'Все' ? data.films : data.films.filter(f => f.category === rouletteCategory);
  if (pool.length < 2) { notify('Нужно хотя бы два фильма для рулетки'); return; }
  spinningRef.current = true;
  setSpinning(true);
  setRoulette(true);
  setRouletteDone(false);

  let step = 0;
  const totalSteps = 25;
  const tick = () => {
    setRouletteIndex(Math.floor(Math.random() * pool.length));
    step++;
    if (step >= totalSteps) {
      spinningRef.current = false;
      setSpinning(false);
      setRouletteDone(true);
      return;
    }
    const delay = 50 + Math.pow(step / totalSteps, 2) * 450; // 50мс → ~500мс, честное торможение
    rouletteTimer.current = setTimeout(tick, delay);
  };
  tick();
};

const stopRoulette = () => {
  if (rouletteTimer.current) clearTimeout(rouletteTimer.current);
  spinningRef.current = false;
  setSpinning(false);
  setRoulette(false);
};

const pickCategory = (c: string) => { setRouletteCategory(c); setRouletteDone(false); };

useEffect(() => () => { if (rouletteTimer.current) clearTimeout(rouletteTimer.current); }, []);

  return (
    <WatchedIdsContext.Provider value={watchedIds}>
      <div className="app-shell">
        <aside className={`sidebar ${mobileNav ? 'mobile-open' : ''}`}>
          <div className="side-brand" onClick={() => go('/')}>
            <span className="brand-mark"><Clapperboard size={21} strokeWidth={2.4} /></span>
            <BrandWordmark size={17} />
          </div>
          <div className="side-scroll">
            <div className="nav-group-label">{en ? 'EXPLORE' : 'ИССЛЕДОВАТЬ'}</div>
            <nav className="nav-list">
              {nav.slice(0, 4).map(n => (
                <button key={n.id} className={`nav-item ${active === n.id ? 'active' : ''}`} onClick={() => go(n.url)}>
                  <n.icon size={19} />
                  <span>{n.label}</span>
                  {n.id === 'watchlist' && data.bookmarks.length > 0 && <small>{data.bookmarks.length}</small>}
                </button>
              ))}
            </nav>

            <div className="nav-group-label section-gap">{en ? 'COMMUNITY' : 'СООБЩЕСТВО'}</div>
            <nav className="nav-list">
              {nav.slice(4).map(n => (
                <button key={n.id} className={`nav-item ${active === n.id ? 'active' : ''}`} onClick={() => go(n.url)}>
                  <n.icon size={19} />
                  <span>{n.label}</span>
                </button>
              ))}
            </nav>

            <div className="nav-group-label section-gap">{en ? 'PERSONAL' : 'ЛИЧНОЕ'}</div>
            <nav className="nav-list">
              <button className={`nav-item ${active === 'profile' ? 'active' : ''}`} onClick={() => data.user ? go('/profile') : setAuthOpen(true)}>
                <Users size={19} /><span>{words.profile}</span>
              </button>
              <button className={`nav-item ${active === 'friends' ? 'active' : ''}`} onClick={() => data.user ? go('/friends') : setAuthOpen(true)}>
                <Users size={19} /><span>{words.friends}</span>
              </button>
              <button className={`nav-item ${active === 'chat' ? 'active' : ''}`} onClick={() => data.user ? go('/chat') : setAuthOpen(true)}>
                <MessageCircle size={19} /><span>{en ? 'Chat' : 'Чат'}</span>
                {data.unreadMessages > 0 && <small>{data.unreadMessages}</small>}
              </button>
              {['admin', 'moderator'].includes(data.user?.role || '') && (
                <button className={`nav-item ${active === 'admin' ? 'active' : ''}`} onClick={() => go('/admin')}>
                  <Shield size={19} /><span>{words.admin}</span>
                </button>
              )}
              {data.user?.role === 'admin' && (
                <button className={`nav-item ${active === 'about-admin' ? 'active' : ''}`} onClick={() => go('/about-admin')}>
                  <BookOpen size={19} /><span>О проекте</span>
                </button>
              )}
            </nav>

            <div className="sidebar-discover">
              <div className="discover-icon"><Sparkles size={18} /></div>
              <h4>Не знаешь, что посмотреть?</h4>
              <p>Доверь выбор киновселенной.</p>
              <button onClick={startRoulette}>Случайный фильм <ArrowUpRight size={14} /></button>
            </div>
          </div>

          <div className="sidebar-bottom">
            <div className="side-status"><span className="status-dot" /> ВСЁ РАБОТАЕТ КАК КИНО</div>
            <span>© 2026 moviemovie</span>
          </div>
        </aside>

        <div className="main-wrap">
          <header className="topbar">
            <button className="mobile-menu icon-button" onClick={() => setMobileNav(!mobileNav)}>
              <Menu size={21} />
            </button>

            <div className="top-search">
              <Search size={18} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    go('/catalog?search=' + encodeURIComponent(search));
                    setSearch('');
                  }
                }}
                placeholder={words.search}
              />
              <kbd>⌘ K</kbd>

              {search && (
                <button onClick={() => { go('/catalog?search=' + encodeURIComponent(search)); setSearch(''); }}>
                  <ArrowRight size={17} />
                </button>
              )}

              {search.length >= 2 && (
                <div className="hot-search-drop" onClick={e => e.stopPropagation()}>
                  {(() => {
                    const q = search.toLowerCase();
                    const results = data.films
                    .filter(f => [f.title, f.originalTitle, f.genre, f.director, f.studio || ''].join(' ').toLowerCase().includes(q))
                    .slice(0, 5);

                    return results.length ? results.map(f => (
                      <button key={f.id} className="hot-search-item" onClick={() => { go('/movie/' + f.id); setSearch(''); }}>
                        <PosterThumb movieId={f.id} src={f.poster} alt={f.title} />
                        <div className="hot-item-info">
                          <b>{f.title}</b>
                          <small>{f.year} · {f.category}</small>
                        </div>
                        <span className="hot-item-rating">{(f.rating || 0).toFixed(1)}</span>
                      </button>
                    )) : <div className="hot-search-empty">Ничего не найдено</div>;
                  })()}

                  <button className="hot-search-all" onClick={() => { go('/catalog?search=' + encodeURIComponent(search)); setSearch(''); }}>
                    Все результаты <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>

            <div className="top-actions">
              <div className="language-switch" onClick={changeLang}>
                {lang.toUpperCase()} <ChevronDown size={12} />
              </div>

              <div className="theme-menu">
                <button className="icon-button" title="Сменить тему" onClick={() => changeTheme(themes[(themes.indexOf(theme) + 1) % themes.length])}>
                  {theme === 'light' ? <Sun size={19} /> : <Moon size={19} />}
                </button>
                <div className="theme-pop">
                  {themes.map(t => (
                    <button key={t} onClick={() => changeTheme(t)}>
                      <i className={`theme-dot ${t}`} />
                      {({ dark: 'Тёмная', light: 'Светлая', pink: 'Розовая', purple: 'Фиолетовая', yellow: 'Жёлтая' } as Record<string, string>)[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="popover-anchor">
                <button className="icon-button notice-button" onClick={() => { setNoticeOpen(!noticeOpen); setProfileOpen(false); if (unread) action({ action: 'notifyRead' }); }}>
                  <Bell size={19} />
                  {unread > 0 && <i className="notice-dot" />}
                </button>
                {noticeOpen && (
                  <div className="header-pop notifications">
                    <div className="pop-head"><strong>Уведомления</strong><span>{data.notifications.length}</span></div>
                    {data.user ? data.notifications.length ? data.notifications.slice(0, 8).map(n => (
                      <button key={n.id} onClick={() => go(n.link || '/profile')} className="notice-row">
                        <span className="notice-ico"><Bell size={15} /></span>
                        <span>{n.message}<small>{new Date(n.createdAt).toLocaleDateString('ru-RU')}</small></span>
                      </button>
                    )) : <div className="empty-mini">Пока здесь тихо ✨</div> : <div className="empty-mini">Войдите, чтобы видеть уведомления</div>}
                  </div>
                )}
              </div>

              <span className="top-divider" />

              <div className="popover-anchor">
                <button className="user-trigger" onClick={() => data.user ? setProfileOpen(!profileOpen) : setAuthOpen(true)}>
                  <Avatar name={data.user?.username || 'G'} src={data.user?.avatar} size={34} frame={data.user?.avatarFrame} />
                  <span className="user-trigger-name">{data.user?.username || words.login}</span>
                  <ChevronDown size={14} />
                </button>
                {profileOpen && (
                  <div className="header-pop user-pop">
                    <strong>{data.user?.username}</strong>
                    <small>{data.user?.email}</small>
                    <button onClick={() => go('/profile')}><Users size={16} /> Мой профиль</button>
                    <button onClick={() => go('/watchlist')}><Bookmark size={16} /> Мой список</button>
                    <button onClick={async () => {
                      await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
                      await refresh();
                      setProfileOpen(false);
                      go('/');
                    }}><LogOut size={16} /> Выйти</button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main className="content">
            {active === 'home' ? <HomePage films={data.films} data={data} go={go} roulette={startRoulette} auth={() => setAuthOpen(true)} en={en} />
              : active === 'catalog' ? <Catalog films={data.films} go={go} searchValue={search} en={en} userRole={data.user?.role || ''} onAdd={() => setEditFilm(null)} watchedIds={watchedIds} />
              : active === 'movie' ? <MovieDetail film={data.films.find(f => f.id === filmId)} data={data} go={go} action={action} requireAuth={requireAuth} share={setShareFilm} edit={setEditFilm} />
              : active === 'profile' ? <Profile key={data.user?.id || 'guest'} data={data} go={go} action={action} notify={notify} auth={() => setAuthOpen(true)} refresh={refresh} />
              : active === 'watchlist' ? <Watchlist data={data} go={go} auth={() => setAuthOpen(true)} />
              : active === 'leaderboard' ? <Leaderboard data={data} go={go} />
              : active === 'achievements' ? <Achievements data={data} auth={() => setAuthOpen(true)} go={go} />
              : active === 'challenges' ? <ChallengesPage data={data} go={go} action={action} auth={() => setAuthOpen(true)} />
              : active === 'games' ? <Games films={data.films} action={action} user={data.user} auth={() => setAuthOpen(true)} notify={notify} />
              : active === 'friends' ? <Friends data={data} action={action} auth={() => setAuthOpen(true)} go={go} openChat={openChat} />
              : active === 'viewuser' ? <ViewUserProfile key={viewUserId} userId={viewUserId} data={data} go={go} action={action} openChat={openChat} auth={() => setAuthOpen(true)} />
              : active === 'compare' ? <ComparePage data={data} compareId={compareId} go={go} auth={() => setAuthOpen(true)} />
              : active === 'wrapped' ? <WrappedPage data={data} go={go} auth={() => setAuthOpen(true)} />
              : active === 'collab' ? <CollabLists data={data} go={go} action={action} auth={() => setAuthOpen(true)} />
              : active === 'watchroom' ? <WatchRoomLobby data={data} go={go} action={action} auth={() => setAuthOpen(true)} />
              : active === 'room' ? <WatchRoom roomId={roomId} data={data} go={go} action={action} auth={() => setAuthOpen(true)} />
              : active === 'games' ? <Games films={data.films} action={action} user={data.user} auth={() => setAuthOpen(true)} notify={notify} />
              : active === 'admin' ? <Admin data={data} go={go} action={action} edit={setEditFilm} />
              : active === 'about-admin' ? <AboutAdmin data={data} go={go} />
              : <HomePage films={data.films} data={data} go={go} roulette={startRoulette} auth={() => setAuthOpen(true)} en={en} />
            }
          </main>

          <footer className="footer">
            <div className="footer-logo"><BrandWordmark size={20} /></div>
            <p>Твоя история. Твоё кино. Твоя вселенная.</p>
            <span>Сделано с любовью к кино · 2026</span>
          </footer>
        </div>

        {mobileNav && <div className="mobile-scrim" onClick={() => setMobileNav(false)} />}
        {authOpen && <AuthModal close={() => setAuthOpen(false)} refresh={refresh} notify={notify} />}

        {roulette && (
          <div className="modal-backdrop" onClick={() => setRoulette(false)}>
            <div className="roulette-modal glass-modal fancy-roulette" onClick={e => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setRoulette(false)}><X size={20} /></button>
              <div className="roulette-head">
                <span className="eyebrow"><Sparkles size={14} /> КИНО-СЛУЧАЙ</span>
                <h2>Чего желает душа?</h2>
                <div className="roulette-tabs">
                  {['Все', 'Фильм', 'Сериал', 'Аниме-сериал'].map(cat => (
                  <button key={cat} disabled={spinning} className={rouletteCategory === cat ? 'active' : ''} onClick={() => pickCategory(cat)}>{cat}</button>
                  ))}
                </div>
              </div>

              <div className="roulette-container">
                <div className={`roulette-strip ${!rouletteDone ? 'spinning' : ''}`}>
                  {!rouletteDone ? (
                    Array.from({ length: 10 }).map((_, idx) => {
                      const f = data.films[(rouletteIndex + idx) % (data.films.length || 1)];
                      return (
                        <div key={idx} className="strip-item">
                          <PosterThumb movieId={f?.id} src={f?.poster} alt="" wrapStyle={{ width: '100%', height: '100%' }} />
                        </div>
                      );
                    })
                  ) : (
                    (() => {
                      const pool = rouletteCategory === 'Все' ? data.films : data.films.filter(x => x.category === rouletteCategory);
                      const winner = pool[rouletteIndex] || data.films[0];
                      return (
                        <div className="strip-winner">
                          <div className="winner-glow" />
                          <PosterThumb movieId={winner?.id} src={image(winner)} alt="" wrapStyle={{ width: '100%', height: '100%' }} />
                        </div>
                      );
                    })()
                  )}
                </div>
                <div className="roulette-pointer"><ChevronDown size={24} /></div>
              </div>

              {rouletteDone && (
                <div className="roulette-result-card">
                  {(() => {
                    const pool = rouletteCategory === 'Все' ? data.films : data.films.filter(f => f.category === rouletteCategory);
                    const win = pool[rouletteIndex];
                    return win ? (
                      <>
                        <span className="win-cat">{win.category} · {win.year}</span>
                        <h3>{win.title}</h3>
                        <p>{win.genre}</p>
                        <div className="win-actions">
                          <button className="primary-btn" onClick={() => { setRoulette(false); go('/movie/' + win.id); }}>
                            Открыть карточку <ArrowRight size={17} />
                          </button>
                          <button className="outline-btn" onClick={startRoulette}>
                            <RotateCcw size={16} /> Ещё раз
                          </button>
                        </div>
                      </>
                    ) : null;
                  })()}
                </div>
              )}

              {!rouletteDone && (
                <button className="primary-btn start-spin-btn" onClick={startRoulette}>
                  Запустить барабан <RotateCcw size={17} />
                </button>
              )}
            </div>
          </div>
        )}

        {shareFilm && (
          <div className="modal-backdrop" onClick={() => setShareFilm(null)}>
            <div className="glass-modal share-modal" onClick={e => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShareFilm(null)}><X size={20} /></button>
              <span className="eyebrow">ПОДЕЛИТЬСЯ ВПЕЧАТЛЕНИЕМ</span>
              <h2>Расскажи друзьям</h2>
              <p>«{shareFilm.title}» стоит увидеть.</p>
              <button className="share-copy" onClick={() => { navigator.clipboard.writeText(window.location.origin + '/movie/' + shareFilm.id); notify('Ссылка скопирована'); }}>
                <Copy size={17} /> Скопировать ссылку <ArrowRight size={16} />
              </button>
              <h4>Отправить пользователю</h4>
              {data.people.filter(p => p.id !== data.user?.id).slice(0, 6).map(p => (
                <button
                  className="share-person"
                  key={p.id}
                  onClick={async () => { if (await action({ action: 'share', movieId: shareFilm.id, userId: p.id }, 'Рекомендация отправлена')) setShareFilm(null); }}
                >
                  <Avatar name={p.username} src={p.avatar} size={32} />
                  {p.username}<Send size={15} />
                </button>
              ))}
            </div>
          </div>
        )}

        {editFilm !== undefined && <MovieForm film={editFilm} close={() => setEditFilm(undefined)} action={action} notify={notify} />}
        {chatOpen && chatPeerId && data.user && <ChatDrawer peerId={chatPeerId} data={data} go={go} close={() => { setChatOpen(false); setChatPeerId(null); }} notify={notify} />}
        {toast && <div className="toast"><Sparkles size={16} />{toast}<button onClick={() => setToast('')}><X size={14} /></button></div>}
        {loading && <div className="loading-line" />}
      </div>
    </WatchedIdsContext.Provider>
  );
}

// --- Helper Components ---
function SectionTitle({ kicker, title, link, onClick }: { kicker?: string; title: string; link?: string; onClick?: () => void; }) {
  return (
    <div className="section-heading">
      <div>{kicker && <div className="eyebrow">{kicker}</div>}<h2>{title}</h2></div>
      {link && <button className="text-link" onClick={onClick}>{link} <ArrowUpRight size={17} /></button>}
    </div>
  );
}

function FilmCard({ film, go, rank, watched }: { film: FilmType; go: (url: string) => void; rank?: number; watched?: boolean; }) {
  const primaryGenre = film.genre.split(',')[0]?.trim();

  // если watched не передан — берем из глобального контекста
  const watchedIds = useWatchedIds();
  const isWatched = watched ?? watchedIds.has(film.id);

  return (
    <div
      className={`film-card tone-${tone(film.rating)}`}
      role="button"
      tabIndex={0}
      onClick={() => go('/movie/' + film.id)}
      onKeyDown={e => { if (e.key === 'Enter') go('/movie/' + film.id); }}
    >
      <div className="poster-wrap">
        <img src={image(film)} alt={film.title} />
        <span className="card-shade" />
        {rank && <span className="rank-num">{String(rank).padStart(2, '0')}</span>}
        <span className="card-score"><Star size={12} fill="currentColor" />{film.rating.toFixed(1)}</span>
        <span className="card-play"><Play size={19} fill="currentColor" /></span>
        {isWatched && <span className="card-watched-badge"><CheckCircle2 size={14} /></span>}
      </div>
      <div className="card-info">
        <h3>{film.title}</h3>
        <p>
          {film.year} <span>·</span> {film.category} <span>·</span>{' '}
          {['Сериал', 'Мультсериал', 'Аниме-сериал'].includes(film.category) && film.episodes
            ? `${film.episodes} сер.`
            : `${film.duration} мин`}
        </p>
        <div className="card-tags">
          {primaryGenre && (
            <button type="button" onClick={e => { e.stopPropagation(); go('/catalog?search=' + encodeURIComponent(primaryGenre)); }}>
              {primaryGenre}
            </button>
          )}
          {film.studio && film.studio.split(',').map((st, i) => (
            <button key={i} type="button" onClick={e => { e.stopPropagation(); go('/catalog?search=' + encodeURIComponent(st.trim())); }}>
              {st.trim()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function FilmGrid({ films, go, watchedIds }: { films: FilmType[]; go: (url: string) => void; watchedIds?: Set<number>; }) {
  return (
    <div className="film-grid">
      {films.map(f => <FilmCard key={f.id} film={f} go={go} watched={watchedIds?.has(f.id)} />)}
    </div>
  );
}

function Gate({ title, description, auth }: { title: string; description: string; auth: () => void; }) {
  return (
    <div className="gate">
      <div><LockKeyhole size={32} /></div>
      <span className="eyebrow">ТОЛЬКО ДЛЯ УЧАСТНИКОВ</span>
      <h1>{title}</h1>
      <p>{description}</p>
      <button className="primary-btn" onClick={auth}>Войти или зарегистрироваться <ArrowRight size={17} /></button>
    </div>
  );
}

// --- Pages ---

function HomePage({ films, data, go, roulette, auth, en }: { films: FilmType[]; data: Data; go: (s: string) => void; roulette: () => void; auth: () => void; en: boolean; }) {
  const featured = useMemo(() => films.find(f => (f as any).featured) || films[0], [films]);
  const trending = useMemo(() => [...films].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5), [films]);
  const [capsule, setCapsule] = useState<string | null>(null);

  if (!featured) return null;

  return (
    <>
      <div className="welcome-line">
        <div>
          <span className="eyebrow"><span className="pulse-dot" /> {en ? 'YOUR CINEMATIC UNIVERSE STARTS HERE' : 'ТВОЯ КИНОВСЕЛЕННАЯ НАЧИНАЕТСЯ ЗДЕСЬ'}</span>
          <h1>{en ? 'Welcome back' : 'Добро пожаловать'}{data.user ? `, ${data.user.username}` : ''}<span className="muted-h1">.</span></h1>
          <p>{en ? 'Discover stories, collect moments, find your next favorite.' : 'Открывай истории, сохраняй впечатления, находи своё кино.'}</p>
        </div>
        <span className="date-pill"><CalendarDays size={15} />{new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>

      <div className="hero" style={{ backgroundImage: `linear-gradient(90deg,rgba(8,10,15,.97) 0%,rgba(8,10,15,.81) 37%,rgba(8,10,15,.16) 83%),linear-gradient(0deg,rgba(8,10,15,.52),transparent 50%),url('${featured.backdrop || featured.poster}')` }}>
        <div className="hero-grain" />
        <div className="hero-content">
          <span className="hero-tag"><span className="pulse-dot" /> В ЦЕНТРЕ ВНИМАНИЯ <span className="tag-line" /> 01 / 05</span>
          <div className="hero-bottom">
            <div className="hero-topline"><span>{en ? 'THE NEXT CHAPTER OF YOUR STORY' : 'НОВЫЙ ЭПИЗОД ТВОЕЙ ИСТОРИИ'}</span><span>✦</span></div>
            <h2>{featured.title}</h2>
            <p>{featured.description}</p>
            <div className="hero-meta">
              <span><Star size={15} fill="currentColor" /> {featured.rating.toFixed(1)} <i>/ 10</i></span>
              <span>{featured.year}</span>
              <span>{featured.category}</span>
              <span>{featured.duration} мин</span>
            </div>
            <div className="hero-buttons">
              <button className="primary-btn" onClick={() => go('/movie/' + featured.id)}><Play size={17} fill="currentColor" /> {en ? 'Explore this story' : 'Подробнее о фильме'} <ArrowRight size={17} /></button>
              <button className="hero-icon-btn" onClick={roulette} title="Случайный материал"><Shuffle size={19} /></button>
            </div>
          </div>
        </div>
        <div className="hero-corner">moviemovie ORIGINAL SELECTION <span>↗</span></div>
      </div>

      <div className="quick-stats">
        <div className="quick-stat"><span className="quick-icon violet"><Clapperboard size={19} /></span><div><b>{fmt(films.length)}</b><small>{en ? 'stories in the library' : 'историй в каталоге'}</small></div></div>
        <div className="quick-stat"><span className="quick-icon amber"><Star size={19} /></span><div><b>{films.length ? (films.reduce((n, f) => n + f.rating, 0) / films.length).toFixed(1) : '—'}</b><small>{en ? 'average rating' : 'средний рейтинг'}</small></div></div>
        <div className="quick-stat"><span className="quick-icon blue"><Users size={19} /></span><div><b>{fmt(data.people.length)}</b><small>{en ? 'movie lovers' : 'кинолюбителей'}</small></div></div>
        <div className="quick-stat"><span className="quick-icon green"><Sparkles size={19} /></span><div><b>{data.user ? fmt(data.watches.length) : '∞'}</b><small>{data.user ? (en ? 'your watches' : 'твоих просмотров') : (en ? 'moments ahead' : 'впечатлений впереди')}</small></div></div>
      </div>

      {data.cineDay?.label && (
        <div className="cine-day-banner">
          <span className="cine-day-icon">{data.cineDay.icon}</span>
          <div><b>{data.cineDay.label}</b><small>Подборка на каждый день в кинотеатре</small></div>
          {data.cineDay.filter && <button className="outline-btn small" onClick={() => go('/catalog?search=' + encodeURIComponent(data.cineDay.filter || ''))}>Открыть <ArrowRight size={14} /></button>}
        </div>
      )}

      {data.challenges?.length > 0 && (
        <div className="challenges-bar">
          <div className="challenges-header">
            <Flame size={18} /><h3>Челленджи месяца</h3>
            <button className="text-link" onClick={() => go('/challenges')}>Все челленджи <ArrowUpRight size={14} /></button>
          </div>
          <div className="challenges-row">
            {data.challenges.slice(0, 3).map((c: any) => (
              <div className={`challenge-pill ${c.completed ? 'done' : ''}`} key={c.id}>
                <span>{c.icon}</span>
                <div><b>{c.title}</b><small>{c.progress}/{c.target}</small><div className="bar-track"><i style={{ width: `${Math.min(100, (c.progress / c.target) * 100)}%` }} /></div></div>
                {c.completed && <Check size={15} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {data.season && data.user && (
        <div className="season-pass">
          <div className="season-head">
            <span>{data.season.icon}</span><b>{data.season.name}</b><small>Закрой сезон — открой эксклюзивную рамку</small>
          </div>
        </div>
      )}

      {data.monthlySummary && (
        <div className="monthly-wrap">
          <div className="mw-head"><Sparkles size={18} /><h3>Итоги прошлого месяца</h3></div>
          <div className="mw-stats">
            <div><b>{data.monthlySummary.watches}</b><small>просмотров</small></div>
            <div><b>{Math.floor(data.monthlySummary.minutes / 60)} ч</b><small>в кино</small></div>
            <div><b>{data.monthlySummary.topGenre}</b><small>топ-жанр</small></div>
            <div><b>{data.monthlySummary.avgRating}</b><small>ср. оценка</small></div>
          </div>
        </div>
      )}

      <section className="home-section">
        <SectionTitle kicker={en ? 'WHAT EVERYONE IS WATCHING' : 'ТО, ЧТО СЕЙЧАС СМОТРЯТ'} title={en ? 'In the spotlight' : 'В центре внимания'} link={en ? 'Full catalog' : 'Весь каталог'} onClick={() => go('/catalog')} />
        <div className="featured-grid">
          {trending.map((f, i) => <FilmCard key={f.id} film={f} go={go} rank={i + 1} />)}
        </div>
      </section>

      {data.user && data.onThisDay.length > 0 && (
        <div className="otd-section">
          <div className="otd-heading"><CalendarDays size={18} /><h3>В этот день</h3></div>
          <div className="otd-cards">
            {data.onThisDay.map((o, i) => (
              <div className="otd-card" key={i}><span className="otd-icon">{o.icon}</span><p>{o.text}</p></div>
            ))}
          </div>
        </div>
      )}

      <div className="editorial-row">
        <div className="editorial-feature" onClick={() => films[2] && go('/movie/' + films[2].id)} style={{ backgroundImage: `linear-gradient(90deg,rgba(10,12,19,.94),rgba(10,12,19,.55)),url('${films[2]?.poster || ''}')` }}>
          <div className="editorial-icon"><Sparkles size={21} /></div>
          <span className="eyebrow">{en ? 'EDITOR’S PICK' : 'ВЫБОР РЕДАКЦИИ'}</span>
          <h3>{en ? <>Stories that<br />stay with you</> : <>Истории, которые<br />остаются с тобой</>}</h3>
          <p>{en ? 'More than watching. A journey beyond the screen.' : 'Не просто просмотр. Настоящее путешествие за пределы экрана.'}</p>
          <span className="editorial-link">{en ? 'Explore the collection' : 'Открыть подборку'} <ArrowUpRight size={17} /></span>
        </div>
        <div className="roulette-banner">
          <div className="roulette-orbit"><Shuffle size={30} /></div>
          <div>
            <span className="eyebrow">{en ? 'CAN’T DECIDE?' : 'НЕ МОЖЕШЬ РЕШИТЬ?'}</span>
            <h3>{en ? 'Leave it to chance.' : 'Пусть решит случай.'}</h3>
            <p>{en ? 'One click away from your next favorite story.' : 'Один клик — и новая история уже ждёт тебя.'}</p>
            <button className="primary-btn" onClick={roulette}>{en ? 'Spin the roulette' : 'Крутить рулетку'} <ArrowRight size={17} /></button>
          </div>
          <span className="banner-decoration">{"//"}</span>
        </div>
      </div>

      {data.user && data.watches.length > 0 && (
        <div className="time-capsule-banner" onClick={() => {
          const rw = data.watches[Math.floor(Math.random() * data.watches.length)];
          const f = data.films.find(x => x.id === rw.movieId);
          if (f) {
            const d = new Date(rw.watchedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
            const r = data.ratings.find(x => x.movieId === f.id);
            alert(`🕰 Капсула времени!\n\n${d} ты посмотрел(а) «${f.title}»${r ? ' и поставил(а) ' + r.value + '/10' : ''}\n\nЖанр: ${f.genre}\nГод: ${f.year}`);
          }
        }}>
          <RotateCcw size={20} />
          <div><b>Капсула времени</b><small>Перемотай время и вспомни случайный сеанс</small></div>
        </div>
      )}

      <section className="home-section pulse-section">
        <SectionTitle kicker={en ? 'CINEMA PULSE' : 'КИНОПУЛЬС'} title={en ? 'This week' : 'На этой неделе'} />
        <div className="pulse-grid">
          {[
            { tag: 'ФИЛЬМ НЕДЕЛИ', icon: '✦', film: [...films].sort((a, b) => b.rating - a.rating)[0], kind: 'best', caption: 'История, в которую влюбились зрители' },
            { tag: 'САМЫЙ СПОРНЫЙ', icon: '↘', film: [...films].sort((a, b) => a.rating - b.rating)[0], kind: 'worst', caption: 'А что скажешь ты?' },
            { tag: 'СВЕЖЕЕ ПОПОЛНЕНИЕ', icon: '＋', film: [...films].sort((a, b) => b.year - a.year)[0], kind: 'new', caption: 'Недавно добавлено в каталог' },
            { tag: 'ВЫСОКИЙ РЕЙТИНГ', icon: '★', film: [...films].sort((a, b) => b.rating - a.rating)[1], kind: 'rated', caption: 'Рекомендовано сообществом' }
          ].filter(item => item.film).map((item, i) => (
            <button key={i} className={`pulse-card pulse-${item.kind}`} onClick={() => go('/movie/' + item.film!.id)}>
              <PosterThumb movieId={item.film!.id} src={item.film!.poster} alt="" wrapStyle={{ display: 'block' }} />
              <div>
                <span className="eyebrow">{item.icon} {item.tag}</span>
                <h3>{item.film!.title}</h3>
                <p>{item.caption}</p>
                <b><Star size={13} fill="currentColor" /> {item.film!.rating.toFixed(1)} <ArrowUpRight size={16} /></b>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="home-section">
        <SectionTitle kicker={en ? 'JUST ADDED' : 'ТОЛЬКО ЧТО В КОЛЛЕКЦИИ'} title={en ? 'Fresh discoveries' : 'Свежие находки'} link={en ? 'See all' : 'Смотреть всё'} onClick={() => go('/catalog?sort=new')} />
        <FilmGrid films={[...films].sort((a, b) => b.year - a.year).slice(0, 5)} go={go} />
      </section>

      <section className="home-section community-section">
        <SectionTitle kicker={en ? 'THE moviemovie COMMUNITY' : 'СООБЩЕСТВО moviemovie'} title={en ? 'Movies are better together' : 'Кино лучше вместе'} link={en ? 'Leaderboard' : 'Таблица лидеров'} onClick={() => go('/leaderboard')} />
        <div className="community-cards">
          <div className="community-card">
            <span className="cc-icon"><Trophy size={24} /></span>
            <h3>{en ? 'Every watch moves you forward' : 'Каждый просмотр — шаг вперёд'}</h3>
            <p>{en ? 'Collect achievements, level up, and unlock new ways to express yourself.' : 'Собирай достижения, прокачивай уровень и открывай новые элементы для профиля.'}</p>
            <button onClick={() => go('/achievements')}>{en ? 'All achievements' : 'Все достижения'} <ArrowRight size={16} /></button>
          </div>
          <div className="community-card">
            <span className="cc-icon pink-icon"><Gamepad2 size={24} /></span>
            <h3>{en ? 'Play between screenings' : 'Играй между сеансами'}</h3>
            <p>{en ? 'Test your movie knowledge in ten cinematic mini games.' : 'Проверь, насколько хорошо ты знаешь кино, в десяти тематических мини-играх.'}</p>
            <button onClick={() => go('/games')}>{en ? 'Play now' : 'Играть сейчас'} <ArrowRight size={16} /></button>
          </div>
          <div className="community-card">
            <span className="cc-icon blue-icon"><Users size={24} /></span>
            <h3>{en ? 'Share discoveries' : 'Делись открытиями'}</h3>
            <p>{en ? 'Find friends, share recommendations and discuss your favorite stories.' : 'Находи друзей, отправляй рекомендации и обсуждай любимые истории.'}</p>
            <button onClick={() => data.user ? go('/friends') : auth()}>{en ? 'Find friends' : 'Найти друзей'} <ArrowRight size={16} /></button>
          </div>
        </div>
      </section>
    </>
  );
}

function Catalog({ films, go, searchValue, en, userRole = '', onAdd, watchedIds = new Set() }: { films: FilmType[]; go: (s: string) => void; searchValue: string; en: boolean; userRole?: string; onAdd?: () => void; watchedIds?: Set<number>; }) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('search') || searchValue || '');
  const [category, setCategory] = useState(searchParams.get('category') || 'Все');
  const [genre, setGenre] = useState(searchParams.get('genre') || 'Все жанры');
  const [studio, setStudio] = useState(searchParams.get('studio') || 'Все студии');
  const [year, setYear] = useState(searchParams.get('year') || 'Любой год');
  const [sort, setSort] = useState('popular');
  const [minRating, setMinRating] = useState('0');
  const [watchFilter, setWatchFilter] = useState('all');

  useEffect(() => {
    setQuery(searchParams.get('search') || searchValue || '');
    setCategory(searchParams.get('category') || 'Все');
    setGenre(searchParams.get('genre') || 'Все жанры');
    setStudio(searchParams.get('studio') || 'Все студии');
    setYear(searchParams.get('year') || 'Любой год');
  }, [searchParams, searchValue]);

  const filtered = useMemo(() => films.filter(f =>
    (!query || [f.title, f.originalTitle, f.genre, f.director, f.description, f.category, f.studio || ''].join(' ').toLowerCase().includes(query.toLowerCase())) &&
    (category === 'Все' || f.category === category) &&
    (genre === 'Все жанры' || f.genre.includes(genre)) &&
    (studio === 'Все студии' || (f.studio || '') === studio) &&
    (year === 'Любой год' || String(f.year) === year) &&
    f.rating >= Number(minRating) &&
    (watchFilter === 'all' || (watchFilter === 'watched' && watchedIds.has(f.id)) || (watchFilter === 'unwatched' && !watchedIds.has(f.id)))
  ).sort((a, b) => sort === 'rating' ? b.rating - a.rating : sort === 'new' ? b.year - a.year : sort === 'old' ? a.year - b.year : (b.views || 0) - (a.views || 0)), [films, query, category, genre, studio, year, sort, minRating, watchFilter, watchedIds]);

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{en ? 'THE STORY LIBRARY' : 'БИБЛИОТЕКА ВПЕЧАТЛЕНИЙ'}</span>
          <h1>{en ? 'Explore the' : 'Исследуй'} <em>{en ? 'cinematic universe.' : 'киновселенную.'}</em></h1>
          <p>{en ? 'Your next favorite story is waiting right here.' : 'Твоё следующее любимое кино уже где-то здесь.'}</p>
        </div>
        <div className="heading-count"><Film size={19} />{films.length} {en ? 'stories' : 'историй'}</div>
        {['admin', 'moderator'].includes(userRole) && onAdd && (
          <button className="primary-btn" onClick={onAdd}><Plus size={17} /> {en ? 'Add content' : 'Добавить материал'}</button>
        )}
      </div>

      <div className="catalog-search">
        <Search size={20} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder={en ? 'Title, genre, director or keyword...' : 'Название, жанр, режиссёр или ключевое слово...'} />
        {query && <button onClick={() => setQuery('')}><X size={17} /></button>}
        <span>ENTER ↵</span>
      </div>

      <div className="category-tabs">
        {categories.map(c => <button key={c} className={category === c ? 'selected' : ''} onClick={() => setCategory(c)}>{c}</button>)}
      </div>

      <div className="filter-bar">
        <span><SlidersHorizontal size={17} /> {en ? 'Filters' : 'Фильтры'}</span>
        <select value={genre} onChange={e => setGenre(e.target.value)}>
          {genres.map(g => <option key={g}>{g}</option>)}
        </select>
        <select value={studio} onChange={e => setStudio(e.target.value)}>
          <option>Все студии</option>
          {[...new Set(films.map(f => f.studio).filter(Boolean) as string[])].sort().map(st => <option key={st}>{st}</option>)}
        </select>
        <select value={year} onChange={e => setYear(e.target.value)}>
          <option>Любой год</option>
          {[...new Set(films.map(f => f.year))].sort((a, b) => b - a).map(y => <option key={y}>{y}</option>)}
        </select>
        <select value={minRating} onChange={e => setMinRating(e.target.value)}>
          <option value="0">Любой рейтинг</option>
          <option value="7">От 7.0</option>
          <option value="8">От 8.0</option>
          <option value="9">От 9.0</option>
        </select>
        <select value={watchFilter} onChange={e => setWatchFilter(e.target.value)}>
          <option value="all">Все материалы</option>
          <option value="watched">✓ Просмотренные</option>
          <option value="unwatched">○ Непросмотренные</option>
        </select>
        <span className="filter-spacer" />
        <span className="result-count">{en ? 'Found' : 'Найдено'}: {filtered.length}</span>
        <select value={sort} onChange={e => setSort(e.target.value)}>
          <option value="popular">Популярные</option>
          <option value="rating">По рейтингу</option>
          <option value="new">Сначала новые</option>
          <option value="old">Сначала старые</option>
        </select>
      </div>

      {filtered.length ? (
        <FilmGrid films={filtered} go={go} watchedIds={watchedIds} />
      ) : (
        <div className="empty-state">
          <Search size={36} />
          <h3>{en ? 'Nothing found yet' : 'Пока ничего не найдено'}</h3>
          <p>{en ? 'Try another search or clear your filters.' : 'Попробуй другой запрос или сбрось фильтры.'}</p>
          <button className="outline-btn" onClick={() => { setQuery(''); setCategory('Все'); setGenre('Все жанры'); setStudio('Все студии'); setYear('Любой год'); setMinRating('0'); }}>
            {en ? 'Clear filters' : 'Сбросить фильтры'}
          </button>
        </div>
      )}
    </>
  );
}

function MovieDetail({ film, data, go, action, requireAuth, share, edit }: { film?: FilmType; data: Data; go: (s: string) => void; action: (p: Record<string, unknown>, s?: string) => Promise<boolean>; requireAuth: (f: () => void) => void; share: (f: FilmType) => void; edit: (f: FilmType) => void; }) {
  const [comment, setComment] = useState('');
  const [reply, setReply] = useState<number | null>(null);
  const [hover, setHover] = useState(0);

  useEffect(() => {
    if (film) fetch('/api/visit?movieId=' + film.id).catch(() => {});
  }, [film?.id]);

  if (!film) return <div className="empty-state"><h2>История не найдена</h2><button className="primary-btn" onClick={() => go('/catalog')}>К каталогу</button></div>;

  const saved = useMemo(() => data.bookmarks.some(b => b.movieId === film.id), [data.bookmarks, film.id]);
  const myRating = useMemo(() => data.ratings.find(r => r.movieId === film.id)?.value || 0, [data.ratings, film.id]);
  const isWatched = useMemo(() => data.watches.some(w => w.movieId === film.id), [data.watches, film.id]);

  const movieComments = useMemo(() => data.comments.filter(c => c.movieId === film.id), [data.comments, film.id]);
  const topComments = useMemo(() => movieComments.filter(c => !c.parentId), [movieComments]);

  const related = useMemo(() => {
    const genres = new Set(film.genre.split(',').map(x => x.trim()).filter(Boolean));
    return data.films
      .filter(f => f.id !== film.id && f.genre.split(',').some(g => genres.has(g.trim())))
      .slice(0, 5);
  }, [data.films, film.id, film.genre]);

  const submit = async () => {
    if (!comment.trim()) return;
    if (await action({ action: 'comment', movieId: film.id, text: comment, parentId: reply }, 'Комментарий опубликован')) {
      setComment('');
      setReply(null);
    }
  };

  return (
    <div className="movie-detail-page">
      <button className="back-link" onClick={() => go('/catalog')}>← Назад в каталог</button>

      <div className={`detail-hero tone-${tone(film.rating)}`} style={{ backgroundImage: `linear-gradient(90deg,var(--bg) 1%,rgba(12,14,20,.95) 33%,rgba(12,14,20,.55) 70%),linear-gradient(0deg,var(--bg),transparent 60%),url('${film.backdrop || film.poster}')` }}>
        <div className="detail-poster">
          <PosterThumb movieId={film.id} src={image(film)} alt={film.title} wrapStyle={{ display: 'block' }} />
        </div>

        <div className="detail-intro">
          <div className="detail-badges"><span className="eyebrow">{film.category.toUpperCase()}</span><span>·</span><span>{film.year}</span><span>·</span><span>{film.country}</span></div>
          <h1>{film.title}</h1>
          <p className="original-title">{film.originalTitle}</p>

          <div className="detail-rating">
            <span className="big-rating"><Star size={22} fill="currentColor" />{film.rating.toFixed(1)}</span>
            <span className="rating-of">/ 10<br /><small>рейтинг сообщества</small></span>
            <span className="detail-views"><Eye size={17} />{fmt(film.views || 0)} просмотров</span>
          </div>

          <p className="detail-description">{film.description}</p>

          <div className="genre-list">
            {film.genre.split(',').map(g => <button key={g} onClick={() => go('/catalog?search=' + encodeURIComponent(g.trim()))}>{g.trim()}</button>)}
            {film.studio && film.studio.split(',').map((st, i) => <button key={i} onClick={() => go('/catalog?search=' + encodeURIComponent(st.trim()))}>{st.trim()}</button>)}
          </div>

          <div className="detail-actions">
            <button
              className={isWatched ? 'outline-btn watched-done' : 'primary-btn'}
              onClick={() => requireAuth(() => action(
                { action: isWatched ? 'unwatch' : 'watch', movieId: film.id },
                isWatched ? 'Просмотр убран' : 'Просмотр добавлен'
              ))}
            >
              <CheckCircle2 size={17} /> {isWatched ? 'Просмотрено' : 'Отметить просмотренным'}
            </button>

            <button className="outline-btn" onClick={() => requireAuth(() => action({ action: 'bookmark', movieId: film.id }, saved ? 'Удалено из списка' : 'Добавлено в список'))}>
              <Bookmark size={17} fill={saved ? 'currentColor' : 'none'} />{saved ? 'В списке' : 'В мой список'}
            </button>

            <button className="square-btn" onClick={() => requireAuth(() => share(film))} title="Поделиться"><Share2 size={18} /></button>

            <button className="outline-btn" onClick={() => requireAuth(() => go('/room/' + Math.random().toString(36).slice(2, 8)))} title="Смотреть вместе с другом">
              <Tv2 size={17} /> Кинозал
            </button>
          </div>

          {film.watchUrl && <a className="watch-external" href={film.watchUrl} target="_blank" rel="noopener noreferrer"><MonitorPlay size={17} /> Где посмотреть <ExternalLink size={15} /></a>}
        </div>
      </div>

      <div className="detail-lower">
        <div className="detail-main">

          <div className="rating-panel-advanced">
            <div className="rating-selector-box">
              <span className="eyebrow">ТВОЙ ВЕРДИКТ</span>
              <h3>{myRating ? "Твоя оценка" : "Оцени историю"}</h3>
              <div className="fancy-stars">
                {Array.from({ length: 10 }).map((_, i) => {
                  const val = i + 1;
                  return (
                    <div key={i} className="star-wrapper">
                      <button
                        className={`star-half left ${myRating >= val - 0.5 ? "active" : ""}`}
                        onMouseEnter={() => setHover(val - 0.5)}
                        onClick={() => requireAuth(() => action({ action: "rate", movieId: film.id, value: val - 0.5 }, "Оценка сохранена"))}
                      />
                      <button
                        className={`star-half right ${myRating >= val ? "active" : ""}`}
                        onMouseEnter={() => setHover(val)}
                        onClick={() => requireAuth(() => action({ action: "rate", movieId: film.id, value: val }, "Оценка сохранена"))}
                      />
                      <Star size={32} className={`base-star ${(hover || myRating) >= val ? "filled" : (hover || myRating) >= val - 0.5 ? "half" : ""}`} />
                    </div>
                  );
                })}
              </div>
              <div className="rating-current-value">{hover || myRating || "—"} <span>/ 10</span></div>
            </div>

            {film.ratingCount > 0 ? (
              <div className="rating-stats-box" style={{ minWidth: "0px", overflow: "hidden" }}>
                <span className="eyebrow">СТАТИСТИКА ГОЛОСОВ</span>
                <div className="rating-histogram" style={{ width: "100%", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((score) => {
                    const dist = (film as any).ratingDist || {};
                    const count = Number(dist[score] || 0) + Number(dist[score - 0.5] || 0);
                    const pct = film.ratingCount ? (count / film.ratingCount) * 100 : 0;
                    return (
                      <div key={score} className="hist-row" style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", minWidth: "0px" }}>
                        <span style={{ width: "16px", textAlign: "right", flexShrink: 0, fontSize: "11px" }}>{score}</span>
                        <div className="hist-bar-wrap" style={{ flex: "1 1 0%", minWidth: "0px", height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "10px", overflow: "hidden", position: "relative" }}>
                          <div className="hist-bar" style={{ width: pct + "%", height: "100%", background: "var(--primary, #a855f7)", borderRadius: "10px" }} />
                        </div>
                        <small style={{ width: "20px", textAlign: "left", flexShrink: 0, fontSize: "11px", opacity: 0.5 }}>{count}</small>
                      </div>
                    );
                  })}
                </div>
                <div className="total-votes-count">Всего голосов: {film.ratingCount}</div>
              </div>
            ) : null}
          </div>

          <div className="discussion">
            <SectionTitle kicker="ДЕЛИСЬ ВПЕЧАТЛЕНИЯМИ" title={`Обсуждение · ${movieComments.length}`} />
            <div className="comment-compose">
              <Avatar name={data.user?.username || 'G'} src={data.user?.avatar} size={40} />
              <div>
                <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder={reply ? 'Напиши ответ...' : 'Что ты думаешь об этой истории? Напиши свой отзыв...'} />
                <div className="emoji-bar">
                  {['😍', '🔥', '👏', '😂', '😢', '🤯', '💀', '👎', '❤️', '🍿', '⭐', '💯', '🎬', '😱', '🤔', '👀', '✨', '🏆'].map(e => (
                    <button key={e} type="button" onClick={() => setComment(prev => prev + e)}>{e}</button>
                  ))}
                </div>
                <div className="compose-footer">
                  <span>
                    {reply ? `Ответ на комментарий #${reply}` : 'Будь добрым к другим зрителям ✨'}
                    {reply && <button onClick={() => setReply(null)}>Отмена</button>}
                  </span>
                  <button className="primary-btn small" onClick={() => requireAuth(submit)}><Send size={15} /> Опубликовать</button>
                </div>
              </div>
            </div>

            {topComments.length ? topComments.map(c => (
              <div key={c.id}>
                <CommentRow
                  c={c}
                  reply={() => { setReply(c.id); document.querySelector('.comment-compose')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
                  react={() => requireAuth(() => action({ action: 'react', commentId: c.id }))}
                />
                {movieComments.filter(r => r.parentId === c.id).map(r => (
                  <div className="comment-reply" key={r.id}>
                    <CommentRow
                      c={r}
                      reply={() => { setReply(c.id); document.querySelector('.comment-compose')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
                      react={() => requireAuth(() => action({ action: 'react', commentId: r.id }))}
                    />
                  </div>
                ))}
              </div>
            )) : <p className="muted">Начни разговор первым!</p>}
          </div>
        </div>

        <aside className="detail-side">
          <div className="info-panel-fancy">
            <div className="info-panel-header"><Sparkles size={18} /> <h3>Детали истории</h3></div>
            <div className="info-grid">

              <div className="info-item">
                <span className="info-icon"><Users size={15} /></span>
                <div>
                  <small>Режиссёр</small>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                    {(film.director || 'Неизвестно').split(',').map((val, idx) => {
                      const item = val.trim();
                      if (!item) return null;
                      return (
                        <button key={idx} type="button" className="info-tag" onClick={() => go('/catalog?search=' + encodeURIComponent(item))}>
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="info-item">
                <span className="info-icon"><CalendarDays size={15} /></span>
                <div>
                  <small>Год выпуска</small>
                  <button type="button" className="info-tag" onClick={() => go('/catalog?year=' + film.year)}>{film.year}</button>
                </div>
              </div>

              <div className="info-item">
                <span className="info-icon"><Clock3 size={15} /></span>
                <div>
                  <small>Длительность</small>
                  <b>{film.duration} мин</b>
                </div>
              </div>

              {film.episodes && (
                <div className="info-item">
                  <span className="info-icon"><Layers3 size={15} /></span>
                  <div>
                    <small>Кол-во серий</small>
                    <b>{film.episodes}</b>
                  </div>
                </div>
              )}

              <div className="info-item">
                <span className="info-icon"><Globe2 size={15} /></span>
                <div>
                  <small>Страна</small>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                    {(film.country || 'Неизвестно').split(',').map((val, idx) => {
                      const item = val.trim();
                      if (!item) return null;
                      return (
                        <button key={idx} type="button" className="info-tag" onClick={() => go('/catalog?search=' + encodeURIComponent(item))}>
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="info-item">
                <span className="info-icon"><Film size={15} /></span>
                <div>
                  <small>Категория</small>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                    {(film.category || '').split(',').map((val, idx) => {
                      const item = val.trim();
                      if (!item) return null;
                      return (
                        <button key={idx} type="button" className="info-tag" onClick={() => go('/catalog?category=' + encodeURIComponent(item))}>
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {film.studio && (
                <div className="info-item">
                  <span className="info-icon"><Clapperboard size={15} /></span>
                  <div>
                    <small>Студия</small>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                      {film.studio.split(',').map((val, idx) => {
                        const item = val.trim();
                        if (!item) return null;
                        return (
                          <button key={idx} type="button" className="info-tag" onClick={() => go('/catalog?studio=' + encodeURIComponent(item))}>
                            {item}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
          {['admin', 'moderator'].includes(data.user?.role || '') && (
            <button className="outline-btn manage-film" onClick={() => edit(film)}><Pencil size={16} /> Редактировать материал</button>
          )}
        </aside>
      </div>

      {related.length > 0 && (
        <section className="home-section">
          <SectionTitle kicker="ТЕБЕ МОЖЕТ ПОНРАВИТЬСЯ" title="Похожие истории" link="Весь каталог" onClick={() => go('/catalog')} />
          <FilmGrid films={related} go={go} />
        </section>
      )}
    </div>
  );
}

function CommentRow({ c, reply, react }: { c: Comment; reply: () => void; react: () => void; }) {
  return (
    <div className="comment-row">
      <Avatar name={c.author?.username || 'User'} src={c.author?.avatar} size={40} />
      <div className="comment-content">
        <div className="comment-by"><b>{c.author?.username || 'Зритель'}</b><span>{new Date(c.createdAt).toLocaleDateString('ru-RU')}</span></div>
        <p>{c.body}</p>
        <div className="comment-buttons">
          <button onClick={react}><Heart size={15} /> {c.likes || 0}</button>
          <button onClick={reply}><MessageCircle size={15} /> Ответить</button>
        </div>
      </div>
    </div>
  );
}

function Profile({ data, go, action, notify, auth }: { data: Data; go: (s: string) => void; action: (p: Record<string, unknown>, s?: string) => Promise<boolean>; notify: (s: string) => void; auth: () => void; }) {
  const u = data.user;
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(u?.bio || '');
  const [name, setName] = useState(u?.username || '');
  const [order, setOrder] = useState((u?.tileOrder || 'stats,genres,history,achievements,friends').split(','));
  const [dragged, setDragged] = useState('');
  const [statTab, setStatTab] = useState('all');
  const upload = useRef<HTMLInputElement>(null);

  if (!u) return <Gate title="Твоя киновселенная ждёт" description="Войди, чтобы вести историю просмотров, собирать достижения и создавать профиль мечты." auth={auth} />;

  const watched = data.watches.map(w => ({ ...w, film: data.films.find(f => f.id === w.movieId) })).filter(x => x.film);
  const minutes = watched.reduce((n, w) => n + (w.film ? titleMinutes(w.film) : 0), 0);
  const level = Math.floor((u.xp || 0) / 500) + 1;
  const progress = ((u.xp || 0) % 500) / 5;
  const achieved = achievementDefs.filter(a => a.progress(data) >= a.targets[0]).length;
  const categoryCounts = categories.slice(1).map(c => ({
    name: c,
    count: watched.filter(w => w.film?.category === c).length,
    mins: watched.filter(w => w.film?.category === c).reduce((n, w) => n + (w.film ? titleMinutes(w.film) : 0), 0)
  }));

  const save = (payload: Record<string, unknown>) => action({ action: 'profile', ...payload }, 'Профиль обновлён');
  const handleUpload = async (file?: File) => {
    if (!file) return;
    const fd = new FormData(); fd.append('file', file); fd.append('kind', 'avatar');
    const r = await fetch('/api/upload', { method: 'POST', body: fd });
    const v = await r.json();
    if (r.ok) { notify('Аватар обновлён'); await fetch('/api/data').then(() => window.location.reload()); }
    else notify(v.error || 'Не удалось загрузить');
  };

  const getCatGroup = (c: string) => { if (c.includes('Аниме')) return 'anime'; if (c.includes('Мульт')) return 'cartoon'; if (c.includes('Сериал')) return 'tv'; return 'movie'; };
  const tabData = watched.filter(w => statTab === 'all' || getCatGroup(w.film?.category || '') === statTab);
  const tabMins = tabData.reduce((n, w) => n + (w.film ? titleMinutes(w.film) : 0), 0);
  const tabRatings = data.ratings.filter(r => tabData.some(w => w.movieId === r.movieId));
  const tabAvgRating = tabRatings.length ? (tabRatings.reduce((a, b) => a + b.value, 0) / tabRatings.length).toFixed(1) : '—';
  const tabGenres = new Map<string, number>();
  tabData.forEach(w => w.film?.genre.split(',').forEach(g => tabGenres.set(g.trim(), (tabGenres.get(g.trim()) || 0) + 1)));
  const tabTopGenre = [...tabGenres.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  const tiles: Record<string, React.ReactNode> = {
    stats: (
      <div className="profile-tile">
        <div className="tile-heading"><span><BarChart3 size={18} /> Детальная статистика</span>{editing && <GripVertical size={18} />}</div>
        <div className="stats-tabs">
          <button className={statTab === 'all' ? 'active' : ''} onClick={() => setStatTab('all')}>Общая</button>
          <button className={statTab === 'movie' ? 'active' : ''} onClick={() => setStatTab('movie')}>Фильмы</button>
          <button className={statTab === 'tv' ? 'active' : ''} onClick={() => setStatTab('tv')}>Сериалы</button>
          <button className={statTab === 'anime' ? 'active' : ''} onClick={() => setStatTab('anime')}>Аниме</button>
          <button className={statTab === 'cartoon' ? 'active' : ''} onClick={() => setStatTab('cartoon')}>Мультфильмы</button>
        </div>
        <div className="profile-stats-grid expanded-stats">
          <div><span className="stat-icon"><Clapperboard size={18} /></span><b>{tabData.length}</b><small>просмотров</small></div>
          <div><span className="stat-icon amber"><Clock3 size={18} /></span><b>{Math.floor(tabMins / 60)}<small>ч</small> {tabMins % 60}<small>м</small></b><small>{statTab === 'all' ? 'в кино' : 'потрачено'}</small></div>
          <div><span className="stat-icon pink-icon"><Star size={18} /></span><b>{tabAvgRating}</b><small>ср. оценка</small></div>
          <div><span className="stat-icon green"><Sparkles size={18} /></span><b>{tabTopGenre}</b><small>топ-жанр</small></div>
          <div><span className="stat-icon"><Film size={18} /></span><b>{new Set(tabData.map(w => w.movieId)).size}</b><small>уникальных</small></div>
          <div><span className="stat-icon amber"><Trophy size={18} /></span><b>{tabRatings.length > 0 ? Math.max(...tabRatings.map(r => r.value)).toFixed(1) : '—'}</b><small>макс. оценка</small></div>
          <div><span className="stat-icon green"><TrendingUp size={18} /></span><b>{tabData.length > 0 ? Math.round(tabMins / Math.max(1, tabData.length)) : 0}<small>м</small></b><small>ср. длительность</small></div>
          <div><span className="stat-icon pink-icon"><Flame size={18} /></span><b>{new Set(tabData.map(w => new Date(w.watchedAt).toDateString())).size}</b><small>активных дней</small></div>
        </div>
      </div>
    ),
    genres: (
      <div className="profile-tile">
        <div className="tile-heading"><span><Layers3 size={18} /> По категориям</span>{editing && <GripVertical size={18} />}</div>
        <div className="category-bars">
          {categoryCounts.map((c, i) => (
            <div className="category-bar" key={c.name}>
              <div><span>{c.name}</span><b>{c.count} <small>· {Math.floor(c.mins / 60)} ч {c.mins % 60} мин</small></b></div>
              <div className="bar-track"><i style={{ width: `${watched.length ? Math.max(3, c.count / watched.length * 100) : 0}%`, background: ['#a78bfa', '#67d8c7', '#f8b687', '#f490bc', '#88acff', '#f9d37d'][i] }} /></div>
            </div>
          ))}
        </div>
      </div>
    ),
    history: (
      <div className="profile-tile">
        <div className="tile-heading"><span><Clock3 size={18} /> История просмотров</span>{editing && <GripVertical size={18} />}</div>
        {watched.length ? (
          <div className="history-list">
            {watched.slice(0, 5).map(w => (
              <button key={w.id} onClick={() => go('/movie/' + w.movieId)}>
                <PosterThumb movieId={w.movieId} src={w.film?.poster} alt="" />
                <span><b>{w.film?.title}</b><small>{new Date(w.watchedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })} · {w.film?.duration} мин</small></span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        ) : <div className="tile-empty">Твоя история начнётся с первого просмотра. <button onClick={() => go('/catalog')}>В каталог →</button></div>}
      </div>
    ),
    achievements: (
      <div className="profile-tile">
        <div className="tile-heading"><span><Trophy size={18} /> Достижения</span>{editing && <GripVertical size={18} />}</div>
        <div className="profile-badges">
          {achievementDefs.slice(0, 4).map(a => (
            <div key={a.id} className={a.progress(data) >= a.targets[0] ? 'earned' : ''}>
              <span>{a.icon}</span><b>{a.name}</b><small>{a.progress(data) >= a.targets[0] ? 'Открыто' : 'Не открыто'}</small>
            </div>
          ))}
        </div>
        <button className="tile-link" onClick={() => go('/achievements')}>Смотреть все достижения <ArrowRight size={15} /></button>
      </div>
    ),
    friends: (
      <div className="profile-tile">
        <div className="tile-heading"><span><Users size={18} /> Друзья</span>{editing && <GripVertical size={18} />}</div>
        {data.friendsActivity.length ? (
          <>
            <div className="friends-stats-summary">
              <div><b>{data.friendsActivity.length}</b><small>друзей</small></div>
              <div><b>{data.friendsActivity.reduce((n, f) => n + f.commonFilms, 0)}</b><small>общих фильмов</small></div>
              <div><b>{Math.floor(data.friendsActivity.reduce((n, f) => n + f.minutes, 0) / 60)}</b><small>часов у друзей</small></div>
            </div>
            <div className="friends-activity-list">
              {data.friendsActivity.slice(0, 4).map(f => (
                <button key={f.id} className="friend-activity-row" onClick={() => go('/user/' + f.id)}>
                  <Avatar name={f.username} src={f.avatar} size={36} />
                  <span className="friend-activity-info"><b>{f.username}</b><small>{f.watches} просмотров · {f.commonFilms} общих · {f.lastWatch ? `был(а) ${new Date(f.lastWatch).toLocaleDateString('ru-RU')}` : 'нет активности'}</small></span>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
          </>
        ) : <div className="tile-empty">Добавь друзей, чтобы видеть их активность. <button onClick={() => go('/friends')}>Найти друзей →</button></div>}
        <button className="tile-link" onClick={() => go('/friends')}>Все друзья <ArrowRight size={15} /></button>
      </div>
    )
  };

  return (
    <>
      <div className={`profile-cover header-style- effect-${u.profileEffect || 'none'} ${u.headerImage && u.headerStyle === 5 ? 'custom-header' : ''}`} style={u.headerImage && u.headerStyle === 5 ? { backgroundImage: `linear-gradient(120deg,rgba(10,12,18,.55),rgba(10,12,18,.2)),url(${u.headerImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined} data-style={u.headerStyle || 1} data-frame={u.headerFrame || 'none'}>
        <div className="cover-noise" />
        <div className="cover-effect-layer" />
        <span className="cover-label">moviemovie · MEMBER PROFILE</span>
        <div className="cover-orbit">✦</div>
        <div className="profile-cover-content">
          <div className="cover-main">
            <div className="cover-badges">
              <span className="role-badge">{u.role === 'admin' ? 'АДМИНИСТРАТОР' : u.role === 'moderator' ? 'МОДЕРАТОР' : u.role === 'vip' ? 'VIP УЧАСТНИК' : 'УЧАСТНИК'}</span>
              <span className="title-badge">✦ {titleFor(u, watched.length)}</span>
            </div>
            <h1 className={`profile-name name-fx-${u.nameEffect || 'none'} name-clr-${u.nameColor || 'default'}`}>{u.username}<span className="verified">✦</span></h1>
            <p>{u.bio}</p>
          </div>
          <div className="cover-side">
            <div className="avatar-edit" onClick={() => upload.current?.click()}>
              <Avatar name={u.username} src={u.avatar} size={100} frame={u.avatarFrame} />
              <span><Upload size={15} /></span>
            </div>
            <input ref={upload} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => handleUpload(e.target.files?.[0])} />
            <div className="cover-actions-bar">
              <button className="cover-edit" onClick={() => go("/wrapped")}><Sparkles size={16} /> Итоги года</button>
              <button className="cover-edit" onClick={() => setEditing(!editing)}>{editing ? <><Check size={16} /> Готово</> : <><Pencil size={16} /> Настроить профиль</>}</button>
            </div>
          </div>
        </div>
      </div>

      <div className="profile-level-row">
        <div className="level-card">
          <div className="level-emblem"><Zap size={23} fill="currentColor" /></div>
          <div>
            <span>УРОВЕНЬ {level} · {titleFor(u, watched.length)}</span>
            <div className="level-track"><i style={{ width: `${progress}%` }} /></div>
            <small>{(u.xp || 0) % 500} / 500 XP до следующего уровня</small>
          </div>
          <strong>{fmt(u.xp || 0)} XP</strong>
        </div>
        <div className="profile-mini-stat"><Trophy size={21} /><b>{achieved}</b><small>достижения</small></div>
        <div className="profile-mini-stat"><Flame size={21} /><b>{new Set(data.watches.map(w => new Date(w.watchedAt).toISOString().slice(0, 10))).size}</b><small>активных дней</small></div>
      </div>

      {editing && (
        <div className="customize-panel">
          <div className="tile-heading"><span><Settings2 size={18} /> Твоя студия оформления</span><small>Создай профиль под своё настроение</small></div>
          <div className="custom-grid">
            <div>
              <label>Имя и описание</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Имя" />
              <textarea maxLength={100} value={bio} onChange={e => setBio(e.target.value.slice(0, 100))} placeholder="Расскажи о себе" />
              <small className="field-counter">{bio.length}/100</small>
              <button className="primary-btn small" onClick={() => save({ username: name, bio })}>Сохранить текст</button>
            </div>
            <div>
              <label>Шапка профиля · 5 стилей</label>
              <div className="style-picks">
                {[1, 2, 3, 4, 5].map(n => <button key={n} className={`style-pick style-${n} ${u.headerStyle === n ? 'picked' : ''}`} title={n === 4 ? 'Откроется за 1000 XP' : n === 5 ? 'Откроется за 2000 XP' : 'Доступно'} disabled={(n === 4 && (u.xp || 0) < 1000) || (n === 5 && (u.xp || 0) < 2000)} onClick={() => save({ headerStyle: n })}><span>0{n}</span>{u.headerStyle === n && <Check size={14} />}</button>)}
              </div>
              <label>Рамка аватара · 16 стилей</label>
              <div className="frame-picks">
                {([['none', 'Нет', 0], ['gold', 'Золото', 500], ['neon', 'Неон', 1500], ['violet', 'Аметист', 2500], ['sakura', 'Сакура', 800], ['fire', 'Огонь', 1200], ['ice', 'Лёд', 1800], ['rainbow', 'Радуга', 3000], ['cyberpunk', 'Киберпанк', 2000], ['blood', 'Кровь', 1600], ['emerald', 'Изумруд', 900], ['sunset', 'Закат', 1100], ['diamond', 'Алмаз', 3500], ['galaxy', 'Галактика', 2800], ['glitch', 'Глитч', 2200], ['anime', 'Аниме', 1400]] as [string, string, number][]).map(([f, label, cost]) => <button key={f} className={`frame-btn frame-preview-${f} ${u.avatarFrame === f ? 'picked' : ''}`} disabled={(u.xp || 0) < cost} title={cost ? cost + ' XP' : 'Бесплатно'} onClick={() => save({ avatarFrame: f })}>{label}{cost > 0 && <small>{cost}</small>}</button>)}
              </div>
              <label>Рамка шапки</label>
              <div className="frame-picks">
                {([['none', 'Нет', 0], ['gold', 'Золото', 500], ['neon', 'Неон', 1500], ['violet', 'Люкс', 2500], ['sakura', 'Сакура', 800], ['fire', 'Огонь', 1200], ['ice', 'Лёд', 1800], ['rainbow', 'Радуга', 3000], ['cyberpunk', 'Киберпанк', 2000], ['diamond', 'Алмаз', 3500]] as [string, string, number][]).map(([f, label, cost]) => <button key={f} className={`frame-btn frame-preview-${f} ${u.headerFrame === f ? 'picked' : ''}`} disabled={(u.xp || 0) < cost} title={cost ? cost + ' XP' : 'Бесплатно'} onClick={() => save({ headerFrame: f })}>{label}{cost > 0 && <small>{cost}</small>}</button>)}
              </div>
              {u.headerStyle === 5 && (
                <>
                  <label>Свой фон для шапки</label>
                  <div className="upload-input header-upload-row">
                    <input value={u.headerImage || ''} readOnly placeholder="Загрузи фон для стиля 05" />
                    <label className="upload-button"><Upload size={17} /><input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={async e => { const file = e.target.files?.[0]; if (!file) return; const fd = new FormData(); fd.append('file', file); fd.append('kind', 'header'); const r = await fetch('/api/upload', { method: 'POST', body: fd }); const v = await r.json(); if (r.ok) save({ headerImage: v.url }); else notify(v.error || 'Ошибка загрузки фона'); }} /></label>
                  </div>
                </>
              )}
              <label>Эффект шапки · анимации</label>
              <div className="frame-picks">
                {([['none', 'Нет', 0], ['particles', 'Частицы', 600], ['rain', 'Дождь', 800], ['fireflies', 'Светлячки', 1000], ['snow', 'Снег', 700], ['stars', 'Звёзды', 900], ['aurora', 'Северное сияние', 1500], ['matrix', 'Матрица', 2000], ['cinema', 'Кинолента', 1200], ['spotlight', 'Прожектор', 1400]] as [string, string, number][]).map(([f, label, cost]) => <button key={f} className={`frame-btn ${u.profileEffect === f ? 'picked' : ''}`} disabled={(u.xp || 0) < cost} title={cost ? cost + ' XP' : 'Бесплатно'} onClick={() => save({ profileEffect: f })}>{label}{cost > 0 && <small>{cost}</small>}</button>)}
              </div>
              <label>Эффект имени</label>
              <div className="frame-picks">
                {([['none', 'Обычное', 0], ['glow', 'Свечение', 300], ['typewriter', 'Печатная машинка', 400], ['gradient', 'Градиент', 500], ['shake', 'Тряска', 600], ['rainbow', 'Радужное', 1000], ['neon-flicker', 'Неоновое мерцание', 800], ['fire-text', 'Огненный текст', 1200], ['ice-text', 'Ледяной текст', 1100], ['glitch-text', 'Глитч текст', 1500]] as [string, string, number][]).map(([f, label, cost]) => <button key={f} className={`frame-btn ${u.nameEffect === f ? 'picked' : ''}`} disabled={(u.xp || 0) < cost} title={cost ? cost + ' XP' : 'Бесплатно'} onClick={() => save({ nameEffect: f })}>{label}{cost > 0 && <small>{cost}</small>}</button>)}
              </div>
              <label>Цвет имени</label>
              <div className="frame-picks">
                {([['default', 'Стандартный', 0], ['gold', 'Золотой', 200], ['rose', 'Розовый', 200], ['cyan', 'Голубой', 300], ['lime', 'Зелёный', 300], ['orange', 'Оранжевый', 400], ['purple-pink', 'Фиолетово-розовый', 600], ['fire-gradient', 'Огненный градиент', 800], ['ocean-gradient', 'Океанский градиент', 900], ['aurora-gradient', 'Северное сияние', 1200]] as [string, string, number][]).map(([f, label, cost]) => <button key={f} className={`frame-btn name-color-${f} ${u.nameColor === f ? 'picked' : ''}`} disabled={(u.xp || 0) < cost} title={cost ? cost + ' XP' : 'Бесплатно'} onClick={() => save({ nameColor: f })}>{label}{cost > 0 && <small>{cost}</small>}</button>)}
              </div>
              <div className="widget-manager-section">
                <label>Управление блоками (Визуализация профиля)</label>
                <div className="widget-toggles">
                  {[{ id: 'stats', label: 'Статистика' }, { id: 'genres', label: 'Категории' }, { id: 'history', label: 'История' }, { id: 'achievements', label: 'Достижения' }, { id: 'friends', label: 'Друзья' }].map(w => <button key={w.id} className={`widget-toggle ${order.includes(w.id) ? 'active' : ''}`} onClick={() => { const next = order.includes(w.id) ? order.filter(x => x !== w.id) : [...order, w.id]; setOrder(next); save({ tileOrder: next.join(',') }); }}>{order.includes(w.id) ? <CheckCircle2 size={14} /> : <Plus size={14} />} {w.label}</button>)}
                </div>
              </div>
            </div>
          </div>
          <p className="custom-hint"><GripVertical size={14} /> Перетаскивай блоки ниже, чтобы изменить их порядок. Новые украшения открываются за достижения.</p>
        </div>
      )}

      <div className="profile-section-heading">
        <div><span className="eyebrow">ЗАПИСИ И ДОСТИЖЕНИЯ</span><h2>Мой кинодневник</h2></div>
        {editing && <span className="drag-hint"><GripVertical size={16} /> Перетащи, чтобы изменить порядок</span>}
      </div>

      <div className="profile-tiles">
        {order.filter(id => tiles[id]).map(id => (
          <div key={id} draggable={editing} onDragStart={() => setDragged(id)} onDragOver={e => e.preventDefault()} onDrop={() => { if (!dragged || dragged === id) return; const next = [...order]; next.splice(next.indexOf(dragged), 1); next.splice(next.indexOf(id), 0, dragged); setOrder(next); save({ tileOrder: next.join(',') }); setDragged(''); }} className={editing ? 'draggable-tile' : ''}>
            {tiles[id]}
          </div>
        ))}
      </div>
    </>
  );
}

function Watchlist({ data, go, auth }: { data: Data; go: (s: string) => void; auth: () => void; }) {
  if (!data.user) return <Gate title="Сохраняй то, что вдохновляет" description="Все истории, которые ты хочешь увидеть, в одном месте." auth={auth} />;
  const saved = data.films.filter(f => data.bookmarks.some(b => b.movieId === f.id));
  return (
    <>
      <div className="page-heading">
        <div><span className="eyebrow">ТВОЯ ПОДБОРКА</span><h1>Мой <em>список.</em></h1><p>Истории, которые ты отложил на потом.</p></div>
        <div className="heading-count"><Bookmark size={18} />{saved.length} сохранено</div>
      </div>
      {saved.length ? <FilmGrid films={saved} go={go} /> : (
        <div className="empty-state"><Bookmark size={38} /><h3>Здесь пока пусто</h3><p>Найди что-нибудь интересное и добавь в свой список.</p><button className="primary-btn" onClick={() => go('/catalog')}>Исследовать каталог <ArrowRight size={17} /></button></div>
      )}
    </>
  );
}

function Leaderboard({ data, go }: { data: Data; go: (s: string) => void; }) {
  const [metric, setMetric] = useState<'minutes' | 'watches' | 'streak' | 'xp' | 'ratings' | 'gameScore'>('minutes');
  const labels = { minutes: 'Часы просмотра', watches: 'Просмотры', streak: 'Активные дни', xp: 'Опыт XP', ratings: 'Оценки', gameScore: 'Игровые очки' };
  const sorted = useMemo(() => [...data.leaderboard].sort((a, b) => Number(b[metric] || 0) - Number(a[metric] || 0)), [data.leaderboard, metric]);
  const value = (p: Leader) => metric === 'minutes' ? `${Math.floor(p.minutes / 60)} ч ${p.minutes % 60} мин` : fmt(Number(p[metric] || 0));

  return (
    <>
      <div className="page-heading">
        <div><span className="eyebrow">ЛУЧШИЕ ИЗ ЛУЧШИХ</span><h1>Зал <em>славы.</em></h1><p>Каждый час просмотра — новая строчка в истории сообщества.</p></div>
        <div className="heading-count"><Trophy size={18} />{sorted.length} участников</div>
      </div>
      <div className="leader-filters">
        {(Object.keys(labels) as (keyof typeof labels)[]).map(k => <button key={k} className={metric === k ? 'selected' : ''} onClick={() => setMetric(k)}>{labels[k]}</button>)}
      </div>
      <div className="podium">
        {[sorted[1], sorted[0], sorted[2]].map((p, i) => p && (
          <div key={p.id} className={`podium-person podium-${i}`}>
            <span className="podium-crown">{i === 1 ? <Crown size={22} fill="currentColor" /> : <Trophy size={18} />}</span>
            <Avatar name={p.username} src={p.avatar} size={i === 1 ? 76 : 62} frame={i === 1 ? 'gold' : 'none'} />
            <b>{p.username}</b><small>{titleFor({ xp: p.xp } as User, p.watches)}</small>
            <strong>{value(p)}</strong>
            <span className="podium-place">#{i === 1 ? 1 : i === 0 ? 2 : 3}</span>
          </div>
        ))}
      </div>
      <div className="rank-list">
        <div className="rank-header"><span>МЕСТО / УЧАСТНИК</span><span>{labels[metric].toUpperCase()}</span></div>
        {sorted.map((p, i) => (
          <div className={`rank-row ${p.id === data.user?.id ? 'is-me' : ''}`} key={p.id}>
            <span className="rank-position">{String(i + 1).padStart(2, '0')}</span>
            <Avatar name={p.username} src={p.avatar} size={40} />
            <span className="rank-person"><b>{p.username} {p.id === data.user?.id && <small>ТЫ</small>}</b><small>{p.role === 'admin' ? 'Администратор' : p.role === 'vip' ? 'VIP зритель' : titleFor({ xp: p.xp } as User, p.watches)}</small></span>
            <strong>{value(p)}</strong>
          </div>
        ))}
      </div>
    </>
  );
}

const achievementDefs = [
  { id: 'watch', icon: '🎬', name: 'Первый кадр', description: 'Отмечай просмотренные истории', targets: [1, 10, 30], unit: 'просмотров', progress: (d: Data) => d.watches.length, category: 'Просмотры' },
  { id: 'hundred', icon: '💯', name: 'Сотня историй', description: 'Посмотри 100 материалов', targets: [25, 50, 100], unit: 'просмотров', progress: (d: Data) => d.watches.length, category: 'Просмотры' },
  { id: 'binge', icon: '🔁', name: 'Марафонец', description: 'Смотри кино каждый день', targets: [2, 7, 30], unit: 'дней подряд', progress: (d: Data) => new Set(d.watches.map(w => new Date(w.watchedAt).toDateString())).size, category: 'Просмотры' },
  { id: 'night', icon: '🌙', name: 'Ночной сеанс', description: 'Смотри истории после 20:00', targets: [1, 5, 20], unit: 'ночных сеансов', progress: (d: Data) => d.watches.filter(w => new Date(w.watchedAt).getHours() >= 20).length, category: 'Просмотры' },
  { id: 'hours', icon: '⏳', name: 'Повелитель времени', description: 'Проводи часы в другом мире', targets: [3, 25, 100], unit: 'часов', progress: (d: Data) => Math.floor(d.watches.reduce((n, w) => n + (d.films.find(f => f.id === w.movieId)?.duration || 0), 0) / 60), category: 'Просмотры' },
  { id: 'weekend', icon: '📅', name: 'Уикенд-синефил', description: 'Посмотри 5 фильмов за выходные', targets: [1, 5, 20], unit: 'выходных сеансов', progress: (d: Data) => d.watches.filter(w => { const day = new Date(w.watchedAt).getDay(); return day === 0 || day === 6; }).length, category: 'Просмотры' },
  { id: 'explorer', icon: '🪐', name: 'Исследователь', description: 'Открывай уникальные истории', targets: [3, 15, 40], unit: 'уникальных историй', progress: (d: Data) => new Set(d.watches.map(w => w.movieId)).size, category: 'Просмотры' },
  { id: 'speed', icon: '⚡', name: 'Скоростной просмотр', description: 'Посмотри 3 материала за один день', targets: [1, 5, 15], unit: 'таких дней', progress: (d: Data) => { const byDay: Record<string, number> = {}; d.watches.forEach(w => { const k = new Date(w.watchedAt).toDateString(); byDay[k] = (byDay[k] || 0) + 1; }); return Object.values(byDay).filter(v => v >= 3).length; }, category: 'Просмотры' },
  { id: 'anime', icon: '🌸', name: 'Путь аниме', description: 'Открывай мир японской анимации', targets: [1, 10, 30], unit: 'аниме', progress: (d: Data) => d.watches.filter(w => d.films.find(f => f.id === w.movieId)?.category.includes('Аниме')).length, category: 'Жанры' },
  { id: 'cartoon', icon: '🎨', name: 'Мультяшник', description: 'Смотри мультфильмы и мультсериалы', targets: [1, 5, 20], unit: 'мультфильмов', progress: (d: Data) => d.watches.filter(w => d.films.find(f => f.id === w.movieId)?.category.includes('Мульт')).length, category: 'Жанры' },
  { id: 'series', icon: '📺', name: 'Сериальный маньяк', description: 'Смотри сериалы', targets: [1, 5, 15], unit: 'сериалов', progress: (d: Data) => d.watches.filter(w => d.films.find(f => f.id === w.movieId)?.category === 'Сериал').length, category: 'Жанры' },
  { id: 'genre_all', icon: '🎭', name: 'Всеядный зритель', description: 'Посмотри что-то из каждой категории', targets: [2, 4, 6], unit: 'категорий', progress: (d: Data) => new Set(d.watches.map(w => d.films.find(f => f.id === w.movieId)?.category).filter(Boolean)).size, category: 'Жанры' },
  { id: 'thriller', icon: '😱', name: 'Адреналиновый наркоман', description: 'Смотри триллеры и хорроры', targets: [1, 5, 15], unit: 'триллеров', progress: (d: Data) => d.watches.filter(w => d.films.find(f => f.id === w.movieId)?.genre.toLowerCase().includes('триллер') || d.films.find(f => f.id === w.movieId)?.genre.toLowerCase().includes('ужас')).length, category: 'Жанры' },
  { id: 'scifi', icon: '🚀', name: 'Космический путешественник', description: 'Открывай фантастические миры', targets: [1, 5, 15], unit: 'фантастик', progress: (d: Data) => d.watches.filter(w => d.films.find(f => f.id === w.movieId)?.genre.toLowerCase().includes('фантастика')).length, category: 'Жанры' },
  { id: 'drama', icon: '🎭', name: 'Чувствительная душа', description: 'Переживай драматические истории', targets: [1, 5, 20], unit: 'драм', progress: (d: Data) => d.watches.filter(w => d.films.find(f => f.id === w.movieId)?.genre.toLowerCase().includes('драма')).length, category: 'Жанры' },
  { id: 'action', icon: '💥', name: 'Экшен-машина', description: 'Смотри боевики и экшены', targets: [1, 5, 15], unit: 'боевиков', progress: (d: Data) => d.watches.filter(w => d.films.find(f => f.id === w.movieId)?.genre.toLowerCase().includes('боевик') || d.films.find(f => f.id === w.movieId)?.genre.toLowerCase().includes('экшен')).length, category: 'Жанры' },
  { id: 'ratings', icon: '⭐', name: 'Кинокритик', description: 'Делись своими оценками', targets: [1, 10, 30], unit: 'оценок', progress: (d: Data) => d.ratings.length, category: 'Критика' },
  { id: 'perfectionist', icon: '🏆', name: 'Перфекционист', description: 'Поставь несколько оценок 10/10', targets: [1, 3, 10], unit: 'оценок 10/10', progress: (d: Data) => d.ratings.filter(r => r.value === 10).length, category: 'Критика' },
  { id: 'harsh', icon: '🔥', name: 'Суровый критик', description: 'Поставь низкую оценку — быть честным важно', targets: [1, 3, 10], unit: 'низких оценок', progress: (d: Data) => d.ratings.filter(r => r.value <= 4).length, category: 'Критика' },
  { id: 'voice', icon: '💬', name: 'Голос зала', description: 'Оставляй комментарии и отзывы', targets: [1, 10, 30], unit: 'комментариев', progress: (d: Data) => d.comments.filter(c => c.author?.id === d.user?.id).length, category: 'Критика' },
  { id: 'popular_comment', icon: '❤️', name: 'Народный любимец', description: 'Получи лайки на комментарии', targets: [1, 10, 50], unit: 'лайков', progress: (d: Data) => d.comments.filter(c => c.author?.id === d.user?.id).reduce((n, c) => n + (c.likes || 0), 0), category: 'Критика' },
  { id: 'social', icon: '🤝', name: 'Душа компании', description: 'Заводи новых друзей', targets: [1, 5, 20], unit: 'друзей', progress: (d: Data) => d.friends.filter(f => f.status === 'accepted').length, category: 'Социальное' },
  { id: 'collector', icon: '💎', name: 'Коллекционер', description: 'Сохраняй любимые истории', targets: [1, 10, 30], unit: 'в списке', progress: (d: Data) => d.bookmarks.length, category: 'Социальное' },
  { id: 'ambassador', icon: '📢', name: 'Посол кино', description: 'Делись рекомендациями с друзьями', targets: [1, 5, 20], unit: 'рекомендаций', progress: (d: Data) => d.notifications.filter(n => n.message?.includes('рекомендует')).length, category: 'Социальное' },
  { id: 'chatty', icon: '💌', name: 'Болтун', description: 'Общайся с друзьями в чате', targets: [5, 25, 100], unit: 'сообщений', progress: (d: Data) => d.scores.filter(s => s.game === 'chat').reduce((n, s) => n + s.score, 0) || 0, category: 'Социальное' },
  { id: 'player', icon: '🎮', name: 'Игрок', description: 'Играй в кино-игры', targets: [1, 10, 50], unit: 'игр', progress: (d: Data) => d.scores.length, category: 'Игры' },
  { id: 'champion', icon: '🥇', name: 'Чемпион', description: 'Набирай высокие очки в играх', targets: [1, 5, 20], unit: 'игр с 5/5', progress: (d: Data) => d.scores.filter(s => s.score >= 5).length, category: 'Игры' },
  { id: 'allgames', icon: '🎯', name: 'Коллекционер игр', description: 'Попробуй все игровые режимы', targets: [4, 8, 16], unit: 'режимов', progress: (d: Data) => new Set(d.scores.map(s => s.game)).size, category: 'Игры' },
  { id: 'master', icon: '👑', name: 'Легенда экрана', description: 'Зарабатывай XP в киновселенной', targets: [500, 2000, 5000], unit: 'XP', progress: (d: Data) => d.user?.xp || 0, category: 'Прогрессия' },
  { id: 'level10', icon: '🔟', name: 'Ветеран', description: 'Достигни 10 уровня', targets: [5, 10, 20], unit: 'уровень', progress: (d: Data) => Math.floor((d.user?.xp || 0) / 500) + 1, category: 'Прогрессия' },
  { id: 'challenges_done', icon: '🎯', name: 'Мастер испытаний', description: 'Выполни ежемесячные челленджи', targets: [1, 5, 15], unit: 'челленджей', progress: (d: Data) => d.challenges.filter((c: any) => c.completed).length, category: 'Прогрессия' },
];

function Achievements({ data, auth, go }: { data: Data; auth: () => void; go: (s: string) => void; }) {
  const [expandedAch, setExpandedAch] = useState<string | null>(null);
  if (!data.user) return <Gate title="Собирай свою историю" description="Открывай достижения, улучшай их до новых тиров и получай награды." auth={auth} />;

  const unlocked = achievementDefs.filter(a => a.progress(data) >= a.targets[0]).length;
  const total = achievementDefs.length;
  const pct = Math.round(unlocked / total * 100);
  const cats = [...new Set(achievementDefs.map(a => (a as any).category || 'Прочее'))];

  return (
    <>
      <div className="page-heading">
        <div><span className="eyebrow">ТВОИ ПОБЕДЫ</span><h1>Коллекция <em>достижений.</em></h1><p>Маленькие победы складываются в большую историю.</p></div>
        <div className="heading-count"><Award size={19} />{unlocked} / {total} открыто</div>
      </div>

      <div className="achievement-summary">
        <span className="achievement-summary-icon">✦</span>
        <div><h3>Твоя коллекция растёт</h3><p>Каждое из {total} достижений имеет 3 тира. Исследуй все категории кино, чтобы собрать коллекцию полностью.</p></div>
        <strong>{pct}%</strong>
      </div>

      <div className="ach-progress-outer"><div className="ach-progress-inner" style={{ width: pct + '%' }} /></div>

      <div className="ach-cats-row">
        {cats.map(cat => {
          const catDefs = achievementDefs.filter(a => (a as any).category === cat);
          const catUnlocked = catDefs.filter(a => a.progress(data) >= a.targets[0]).length;
          return <div key={cat} className="ach-cat-pill"><span>{cat}</span><b>{catUnlocked}/{catDefs.length}</b></div>;
        })}
      </div>

      {cats.map(cat => {
        const catDefs = achievementDefs.filter(a => (a as any).category === cat);
        return (
          <div key={cat} className="ach-category-section">
            <div className="ach-category-header"><h3>{cat}</h3><span>{catDefs.filter(a => a.progress(data) >= a.targets[0]).length}/{catDefs.length}</span></div>
            <div className="achievement-grid">
              {catDefs.map(a => {
                const value = a.progress(data);
                const tier = a.targets.filter(t => value >= t).length;
                const next = a.targets[Math.min(tier, 2)];
                const pctBar = Math.min(100, (value / next) * 100);

                return (
                  <div
                    className={`achievement-card ${tier ? 'unlocked' : 'locked'} ${tier === 3 ? 'maxed' : ''} ${expandedAch === a.id ? 'expanded' : ''}`}
                    key={a.id}
                    onClick={() => setExpandedAch(expandedAch === a.id ? null : a.id)}
                  >
                    <div className="achievement-top">
                      <span className="achievement-icon">{a.icon}</span>
                      <span className="achievement-tier">{tier === 3 ? '✦ МАКС' : tier ? `ТИР ${['', 'I', 'II', 'III'][tier]}` : 'ЗАКРЫТО'}</span>
                    </div>
                    <h3>{a.name}</h3><p>{a.description}</p>

                    <div className="achievement-progress">
                      <div><span>{Math.min(value, next)} / {next} {a.unit}</span><b>{tier === 3 ? 'Максимальный тир' : `До тира ${['I', 'II', 'III'][Math.min(tier, 2)]}`}</b></div>
                      <div className="bar-track"><i style={{ width: `${pctBar}%` }} /></div>
                    </div>

                    <div className="tier-dots">{a.targets.map((t, i) => <span key={t} className={value >= t ? 'filled' : ''}>{['I', 'II', 'III'][i]}</span>)}</div>

                    {expandedAch === a.id && (
                      <div className="ach-detail" onClick={e => e.stopPropagation()}>
                        <div className="ach-tiers-detail">
                          {a.targets.map((t, i) => (
                            <div key={i} className={`ach-tier-row ${value >= t ? 'done' : ''}`}>
                              <span>Тир {['I', 'II', 'III'][i]}</span><b>{t} {a.unit}</b>
                              {value >= t ? <Check size={14} /> : <small>{Math.max(0, t - value)} осталось</small>}
                            </div>
                          ))}
                        </div>
                        <button className="outline-btn small" onClick={() => go('/catalog?search=' + encodeURIComponent((a as any).category || ''))}><Compass size={14} /> Открыть каталог</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

function Friends({ data, action, auth, go, openChat }: { data: Data; action: (p: Record<string, unknown>, s?: string) => Promise<boolean>; auth: () => void; go: (s: string) => void; openChat: (id: number) => void; }) {
  const [query, setQuery] = useState('');
  if (!data.user) return <Gate title="Кино лучше вместе" description="Находи единомышленников, делись фильмами и собирай своё сообщество." auth={auth} />;
  const pending = data.friends.filter(f => f.toId === data.user?.id && f.status === 'pending');
  const peers = data.people.filter(p => p.id !== data.user?.id && p.username.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <div className="page-heading">
        <div><span className="eyebrow">ОДНО КИНО · ТЫСЯЧИ ИСТОРИЙ</span><h1>Твои <em>люди.</em></h1><p>Делиться впечатлениями лучше с теми, кто поймёт.</p></div>
        <div className="heading-count"><Users size={18} />{data.friends.filter(f => f.status === 'accepted').length} друзей</div>
      </div>

      {pending.length > 0 && (
        <section className="friend-section">
          <SectionTitle kicker="ЖДУТ ТВОЕГО ОТВЕТА" title="Заявки в друзья" />
          <div className="people-grid">
            {pending.map(f => {
              const p = data.people.find(p => p.id === f.fromId);
              return p && (
                <div className="person-card" key={f.id}>
                  <Avatar name={p.username} src={p.avatar} size={48} />
                  <div><b>{p.username}</b><small>Хочет дружить с тобой</small></div>
                  <button className="primary-btn small" onClick={() => action({ action: 'friendAccept', id: f.id }, 'Теперь вы друзья!')}><Check size={16} /> Принять</button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="friend-section">
        <SectionTitle kicker="НАЙДИ СВОЮ КОМПАНИЮ" title="Кинолюбители" />
        <div className="catalog-search compact"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Найти пользователя по имени..." /></div>
        <div className="people-grid">
          {peers.map(p => {
            const relation = data.friends.find(f => (f.fromId === p.id || f.toId === p.id));
            return (
              <div className="person-card" key={p.id}>
                <Avatar name={p.username} src={p.avatar} size={48} />
                <div><b>{p.username}</b><small>{p.role === 'admin' ? 'Администратор' : p.role === 'vip' ? 'VIP участник' : `Уровень ${Math.floor((p.xp || 0) / 500) + 1}`}</small></div>
                {relation ? (
                  <div className="friend-actions">
                    {relation.status === 'accepted' && (
                      <>
                        <button className="outline-btn small" onClick={() => go('/user/' + p.id)}><Eye size={14} /> Профиль</button>
                        <button className="outline-btn small" onClick={() => openChat(p.id)}><MessageCircle size={14} /> Чат</button>
                      </>
                    )}
                    {relation.status === 'pending' && <span className="friend-state">⏳ Заявка</span>}
                  </div>
                ) : (
                  <button className="outline-btn small" onClick={() => action({ action: 'friend', userId: p.id }, 'Заявка отправлена')}><UserPlus size={16} /> Добавить</button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

const gameModes = [
  { id: 'story', icon: '📖', name: 'Угадай по сюжету', description: 'Узнай фильм по описанию истории', color: 'violet' },
  { id: 'year', icon: '📅', name: 'Год премьеры', description: 'В каком году это вышло?', color: 'amber' },
  { id: 'director', icon: '🎥', name: 'Кто режиссёр?', description: 'Угадай автора за кадром', color: 'blue' },
  { id: 'genre', icon: '🎭', name: 'Жанровый детектив', description: 'Подбери правильный жанр', color: 'pink' },
  { id: 'poster', icon: '🖼️', name: 'Угадай по постеру', description: 'Узнай кино по кадру без подсказок', color: 'green' },
  { id: 'duration', icon: '⏱️', name: 'Хронометраж', description: 'Сколько идёт эта история?', color: 'amber' },
  { id: 'country', icon: '🌎', name: 'Карта кино', description: 'Угадай страну производства', color: 'blue' },
  { id: 'original', icon: '🔤', name: 'Оригинальное имя', description: 'Как называется фильм в оригинале?', color: 'violet' },
  { id: 'category', icon: '🎞️', name: 'Тип истории', description: 'Фильм, сериал или аниме?', color: 'pink' },
  { id: 'higher', icon: '🏆', name: 'Рейтинговая битва', description: 'У кого оценка выше?', color: 'green' },
  { id: 'wordle', icon: '🟩', name: 'Кино-Вордли', description: 'Угадай зашифрованный фильм дня за 6 попыток', color: 'green' },
  { id: 'hangman', icon: '🔡', name: 'Кино-Поле Чудес', description: 'Угадай название по буквам', color: 'amber' },
  { id: 'anagram', icon: '🔀', name: 'Кино-Анаграмма', description: 'Собери буквы названия в правильном порядке', color: 'violet' },
  { id: 'truths', icon: '🤥', name: 'Две правды, одна ложь', description: 'Найди ложный факт о фильме', color: 'pink' },
  { id: 'chrono', icon: '⏳', name: 'Хроно-Слайдер', description: 'Расставь фильмы от старого к нового', color: 'blue' },
  { id: 'connections', icon: '🧩', name: 'Кино-Связи', description: 'Найди 4 группы по 4 фильма по скрытому признаку', color: 'green' }
];

function Games({ films, action, user, auth }: { films: FilmType[]; action: (p: Record<string, unknown>, s?: string) => Promise<boolean>; user: User | null; auth: () => void; }) {
  const [mode, setMode] = useState<typeof gameModes[number] | null>(null);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [questions, setQuestions] = useState<{ movieId?: number; question: string; options: string[]; correct: string; poster?: string }[]>([]);

  const make = (id: string) => {
    const usable = films.length >= 5 ? films : [...films, ...films, ...films].slice(0, 5);
    const source = [...usable].sort(() => Math.random() - 0.5).slice(0, 5);
    const pool = (field: (f: FilmType) => string, current: FilmType) =>
      [...new Set([field(current), ...usable.filter(f => f.id !== current.id).sort(() => Math.random() - 0.5).map(field)])]
        .slice(0, 4)
        .sort(() => Math.random() - 0.5);

    const qs = source.map(f => {
      let question = '', correct = '', options: string[] = [], poster: string | undefined;
      switch (id) {
        case 'story': { question = `Какая история скрывается за этим описанием? «${f.description.slice(0, 120)}...»`; correct = f.title; options = pool(x => x.title, f); break; }
        case 'year': { question = `В каком году вышло «${f.title}»?`; correct = String(f.year); options = pool(x => String(x.year), f); break; }
        case 'director': { question = `Кто снял «${f.title}»?`; correct = f.director || 'Неизвестно'; options = pool(x => x.director || 'Неизвестно', f); break; }
        case 'genre': { question = `Какой жанр есть у «${f.title}»?`; correct = f.genre.split(',')[0].trim(); options = pool(x => x.genre.split(',')[0].trim(), f); break; }
        case 'poster': { question = 'Как называется этот фильм?'; correct = f.title; options = pool(x => x.title, f); poster = f.poster; break; }
        case 'duration': { question = `Сколько длится «${f.title}»?`; correct = `${f.duration} мин`; options = pool(x => `${x.duration} мин`, f); break; }
        case 'country': { question = `Какая страна создала «${f.title}»?`; correct = f.country || 'Неизвестно'; options = pool(x => x.country || 'Неизвестно', f); break; }
        case 'original': { question = `Как звучит оригинальное название «${f.title}»?`; correct = f.originalTitle || f.title; options = pool(x => x.originalTitle || x.title, f); break; }
        case 'category': { question = `К какой категории относится «${f.title}»?`; correct = f.category; options = pool(x => x.category, f); break; }
        case 'wordle': { question = `Угадай фильм: жанр «${f.genre.split(',')[0].trim()}», ${f.year} год, ${f.country}`; correct = f.title; options = pool(x => x.title, f); break; }
        case 'hangman': { const hidden = f.title.replace(/[а-яёa-z]/gi, '_'); question = `Угадай: ${hidden} (${f.category}, ${f.year})`; correct = f.title; options = pool(x => x.title, f); break; }
        case 'anagram': { const shuffled = f.title.split('').sort(() => Math.random() - 0.5).join(''); question = `Собери название: «${shuffled}» (${f.category})`; correct = f.title; options = pool(x => x.title, f); break; }
        case 'truths': { const lie = `Режиссёр — ${usable.filter(x => x.director !== f.director)[0]?.director || 'неизвестно'}`; question = `Найди ЛОЖЬ о «${f.title}»:`; correct = lie; options = [`Год выпуска — ${f.year}`, `Категория — ${f.category}`, lie].sort(() => Math.random() - 0.5); break; }
        case 'chrono': { question = `Какой из этих фильмов вышел раньше всех?`; correct = source.sort((a, b) => a.year - b.year)[0].title; options = source.slice(0, 4).map(x => x.title).sort(() => Math.random() - 0.5); break; }
        case 'connections': {
          question = `Какой фильм НЕ связан общим жанром «${f.genre.split(',')[0].trim()}»?`;
          const outsider = usable.filter(x => !x.genre.includes(f.genre.split(',')[0].trim()))[0] || usable[0];
          correct = outsider.title;
          options = [...source.filter(x => x.genre.includes(f.genre.split(',')[0].trim())).slice(0, 3).map(x => x.title), outsider.title].sort(() => Math.random() - 0.5);
          break;
        }
        default: {
          const others = usable.filter(x => x.rating !== f.rating);
          const opponent = others[Math.floor(Math.random() * others.length)] || usable[0];
          correct = f.rating >= opponent.rating ? f.title : opponent.title;
          options = [f.title, opponent.title];
          question = `Что оценили выше: «${f.title}» или другое кино?`;
        }
      }
      return { movieId: f.id, question, correct, options, poster };
    });

    setQuestions(qs);
    setMode(gameModes.find(g => g.id === id) || null);
    setRound(0);
    setScore(0);
    setChoice(null);
  };

  const next = async () => {
    if (round === 4) {
      if (user) await action({ action: 'game', game: mode?.id, score }, `+${score * 10} XP за игру!`);
      setRound(5);
    } else {
      setRound(round + 1);
      setChoice(null);
    }
  };

  return (
    <>
      <div className="page-heading">
        <div><span className="eyebrow">ИГРА НАЧИНАЕТСЯ</span><h1>Проверь свой <em>кинорадар.</em></h1><p>16 игр. Сотни вопросов. Сколько историй ты узнаешь?</p></div>
        <div className="heading-count"><Gamepad2 size={19} />{gameModes.length} режимов</div>
      </div>
      <div className="games-intro">
        <span className="games-intro-icon"><Zap size={27} /></span>
        <div><h3>Играй. Побеждай. Прокачивайся.</h3><p>За каждый верный ответ получай очки. За прохождение — опыт XP для профиля.</p></div>
        <span>+ XP</span>
      </div>

      <div className="games-grid">
        {gameModes.map((g, i) => (
          <button key={g.id} className={`game-card game-${g.color}`} onClick={() => make(g.id)}>
            <div className="game-card-top"><span className="game-emoji">{g.icon}</span><small>ИГРА {String(i + 1).padStart(2, '0')}</small></div>
            <div><h3>{g.name}</h3><p>{g.description}</p></div>
            <span className="game-launch">Играть <ArrowUpRight size={17} /></span>
          </button>
        ))}
      </div>

      {mode && (
        <div className="modal-backdrop" onClick={() => setMode(null)}>
          <div className="glass-modal game-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setMode(null)}><X size={20} /></button>
            <span className="eyebrow">{mode.icon} {mode.name.toUpperCase()}</span>

            {round < 5 && questions[round] ? (
              <>
                <div className="game-counter"><span>ВОПРОС {round + 1} / 5</span><b>{score} ОЧКОВ</b></div>
                <div className="game-progress"><i style={{ width: `${(round + 1) * 20}%` }} /></div>

                {questions[round].poster && (
                  <PosterThumb
                    movieId={questions[round].movieId}
                    src={questions[round].poster}
                    alt="Загадочный постер"
                    imgClassName="game-poster"
                    wrapStyle={{ display: 'block', width: '100%' }}
                  />
                )}

                <h2>{questions[round].question}</h2>

                <div className="game-options">
                  {questions[round].options.map((option, i) => (
                    <button
                      key={i}
                      disabled={choice !== null}
                      className={choice !== null ? (option === questions[round].correct ? 'correct' : choice === option ? 'incorrect' : '') : ''}
                      onClick={() => {
                        if (choice !== null) return;
                        setChoice(option);
                        if (option === questions[round].correct) setScore(score + 1);
                      }}
                    >
                      <span>{String.fromCharCode(65 + i)}</span>{option}
                      {choice !== null && option === questions[round].correct && <Check size={18} />}
                    </button>
                  ))}
                </div>

                {choice !== null && (
                  <div className="game-next">
                    <span>{choice === questions[round].correct ? 'Верно! Ты знаешь своё кино ✨' : 'Не совсем. Но теперь ты знаешь ответ!'}</span>
                    <button className="primary-btn small" onClick={next}>{round === 4 ? 'Результат' : 'Следующий вопрос'} <ArrowRight size={15} /></button>
                  </div>
                )}
              </>
            ) : (
              <div className="game-result">
                <span>🏆</span><h2>Игра окончена!</h2><p>Ты ответил правильно на <b>{score} из 5</b> вопросов.</p>
                <div className="result-points">+{user ? score * 10 : 0} XP</div>
                {!user && <p>Войди, чтобы сохранять результаты и получать XP.</p>}
                <button className="primary-btn" onClick={() => make(mode.id)}><RotateCcw size={17} /> Сыграть ещё</button>
                <button className="text-link" onClick={() => { setMode(null); if (!user) auth(); }}>{user ? 'К другим играм' : 'Войти в аккаунт'}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Admin({ data, go, action, edit }: { data: Data; go: (s: string) => void; action: (p: Record<string, unknown>, s?: string) => Promise<boolean>; edit: (f: FilmType | null) => void; }) {
  const [tab, setTab] = useState('films');
  if (!['admin', 'moderator'].includes(data.user?.role || '')) return <div className="gate"><Shield size={40} /><h1>Доступ закрыт</h1><p>Этот раздел доступен только команде moviemovie.</p><button className="primary-btn" onClick={() => go('/')}>На главную</button></div>;

  return (
    <>
      <div className="page-heading">
        <div><span className="eyebrow">ЦЕНТР УПРАВЛЕНИЯ</span><h1>За кадром <em>moviemovie.</em></h1><p>Управляй историями и заботься о нашем сообществе.</p></div>
        <button className="primary-btn" onClick={() => edit(null)}><Plus size={18} /> Добавить материал</button>
      </div>
      <div className="admin-stats">
        <div><Film size={21} /><b>{data.films.length}</b><small>материалов</small></div>
        <div><Users size={21} /><b>{data.people.length}</b><small>участников</small></div>
        <div><Eye size={21} /><b>{fmt(data.films.reduce((n, f) => n + (f.views || 0), 0))}</b><small>посещений</small></div>
        <div><MessageCircle size={21} /><b>{data.comments.length}</b><small>комментариев</small></div>
      </div>
      <div className="category-tabs">
        <button className={tab === 'films' ? 'selected' : ''} onClick={() => setTab('films')}>Материалы</button>
        {data.user?.role === 'admin' && <button className={tab === 'users' ? 'selected' : ''} onClick={() => setTab('users')}>Пользователи и роли</button>}
      </div>

      {tab === 'films' ? (
        <div className="admin-list">
          {data.films.map(f => (
            <div className="admin-row" key={f.id}>
              <PosterThumb movieId={f.id} src={f.poster} alt="" />
              <div><b>{f.title}</b><small>{f.year} · {f.category} · ★ {f.rating.toFixed(1)}</small></div>
              <span>{f.views} просмотров</span>
              <button onClick={() => edit(f)} title="Редактировать"><Pencil size={18} /></button>
              {data.user?.role === 'admin' && <button className="danger" onClick={() => { if (window.confirm(`Удалить «${f.title}»?`)) action({ action: 'movieDelete', id: f.id }, 'Материал удалён'); }} title="Удалить"><Trash2 size={18} /></button>}
            </div>
          ))}
        </div>
      ) : (
        <div className="admin-list">
          {data.people.map(p => (
            <div className="admin-row user-admin-row" key={p.id}>
              <Avatar name={p.username} src={p.avatar} size={42} />
              <div><b>{p.username}</b><small>{p.xp} XP · ID {p.id}</small></div>
              <select value={p.role} disabled={p.id === data.user?.id} onChange={e => action({ action: 'role', userId: p.id, role: e.target.value }, 'Роль изменена')}>
                <option value="visitor">Посетитель</option>
                <option value="vip">VIP</option>
                <option value="moderator">Модератор</option>
                <option value="admin">Администратор</option>
              </select>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function AuthModal({ close, refresh, notify }: { close: () => void; refresh: () => Promise<void>; notify: (s: string) => void; }) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const tgRef = useRef<HTMLDivElement>(null);
  const botName = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: tab, email, password, username }) });
      const d = await r.json();
      if (!r.ok) notify(d.error || 'Ошибка входа');
      else { await refresh(); notify(tab === 'login' ? 'С возвращением!' : 'Добро пожаловать в moviemovie!'); close(); }
    } catch {
      notify('Ошибка соединения');
    } finally {
      setBusy(false);
    }
  };

  const finishTelegram = async (telegramData: { id: number; first_name?: string; username?: string; photo_url?: string; }) => {
    setBusy(true);
    try {
      const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'telegram', telegramData }) });
      const d = await r.json();
      if (!r.ok) notify(d.error || 'Ошибка Telegram-входа');
      else { await refresh(); notify('Вход через Telegram выполнен'); close(); }
    } catch {
      notify('Ошибка соединения с Telegram');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    (globalThis as { MovieGoTelegramAuth?: (user: { id: number; first_name?: string; username?: string; photo_url?: string; }) => void; }).MovieGoTelegramAuth = (user) => { void finishTelegram(user); };
    if (!botName || !tgRef.current) return;
    tgRef.current.innerHTML = '';
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '20');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-onauth', 'MovieGoTelegramAuth(user)');
    tgRef.current.appendChild(script);
    return () => { if (tgRef.current) tgRef.current.innerHTML = ''; delete (globalThis as { MovieGoTelegramAuth?: unknown; }).MovieGoTelegramAuth; };
  }, [botName]);

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="glass-modal auth-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={close}><X size={20} /></button>
        <span className="auth-symbol"><Clapperboard size={24} /></span>
        <span className="eyebrow">ТВОЯ ИСТОРИЯ НАЧИНАЕТСЯ ЗДЕСЬ</span>
        <h2>{tab === 'login' ? 'С возвращением!' : 'Присоединяйся к нам.'}</h2>
        <p>Кино лучше, когда есть с кем им поделиться.</p>
        <div className="auth-tabs">
          <button className={tab === 'login' ? 'selected' : ''} onClick={() => setTab('login')}>Войти</button>
          <button className={tab === 'register' ? 'selected' : ''} onClick={() => setTab('register')}>Регистрация</button>
        </div>
        <form onSubmit={submit}>
          {tab === 'register' && (
            <label>Имя пользователя<input required minLength={3} maxLength={24} value={username} onChange={e => setUsername(e.target.value)} placeholder="Как к тебе обращаться?" /></label>
          )}
          <label>Электронная почта<input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
          <label>Пароль<input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="Не менее 8 символов" /></label>
          <button className="primary-btn auth-submit" disabled={busy}>{busy ? 'Подождите...' : tab === 'login' ? 'Войти в киновселенную' : 'Создать аккаунт'} <ArrowRight size={17} /></button>
        </form>
        <div className="auth-separator">или продолжить с</div>
        <div className="oauth-row">
          <div className="telegram-login-box">
            {botName ? <div ref={tgRef} /> : <button type="button" className="telegram-fallback" onClick={() => void finishTelegram({ id: 12345678, first_name: 'Test', username: 'moviego_test_user', photo_url: '' })}><span className="telegram-badge">✈</span> Telegram<small>Sandbox login</small></button>}
          </div>
          <button type="button" className="yandex-login-btn" onClick={() => { window.location.href = '/api/oauth/yandex'; }}><b className="yandex-y">Я</b> Яндекс</button>
        </div>
      </div>
    </div>
  );
}

function MovieForm({ film, close, action, notify }: { film: FilmType | null; close: () => void; action: (p: Record<string, unknown>, s?: string) => Promise<boolean>; notify: (s: string) => void; }) {
  const [form, setForm] = useState({
    title: film?.title || '',
    originalTitle: (film as any)?.originalTitle || '',
    description: (film as any)?.description || '',
    category: film?.category || 'Фильм',
    genre: (film as any)?.genre || '',
    studio: (film as any)?.studio || '',
    year: film?.year || 2026,
    duration: film?.duration || 90,
    episodes: (film as any)?.episodes || 0,
    mood: (film as any)?.mood || '',
    poster: film?.poster || '',
    backdrop: (film as any)?.backdrop || '',
    watchUrl: (film as any)?.watchUrl || '',
    director: (film as any)?.director || '',
    country: (film as any)?.country || ''
  });
  const [busy, setBusy] = useState(false);
  const field = (key: keyof typeof form, value: string | number) => setForm(v => ({ ...v, [key]: value }));

  const upload = async (file?: File) => {
    if (!file) return;
    const fd = new FormData(); fd.append('file', file); fd.append('kind', 'poster');
    const r = await fetch('/api/upload', { method: 'POST', body: fd });
    const d = await r.json();
    if (r.ok) { field('poster', d.url); notify('Обложка загружена'); }
    else notify(d.error || 'Ошибка загрузки');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await action({ action: 'movieSave', id: (film as any)?.id, ...form }, film ? 'Материал обновлён' : 'Материал добавлен');
    setBusy(false);
    if (ok) close();
  };

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="glass-modal editor-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={close}><X size={20} /></button>
        <span className="eyebrow">КУРАТОР КАТАЛОГА</span>
        <h2>{film ? 'Редактировать историю' : 'Новая история'}</h2>
        <form onSubmit={submit} className="editor-form">
          <div className="form-two">
            <label>Название *<input required value={form.title} onChange={e => field('title', e.target.value)} /></label>
            <label>Оригинальное название<input value={form.originalTitle} onChange={e => field('originalTitle', e.target.value)} /></label>
          </div>
          <label>Описание *<textarea required rows={3} value={form.description} onChange={e => field('description', e.target.value)} /></label>
          <div className="form-three">
            <label>Категория *<select value={form.category} onChange={e => field('category', e.target.value)}>{categories.slice(1).map(c => <option key={c}>{c}</option>)}</select></label>
            <label>Год<input type="number" min="1900" max="2100" value={form.year} onChange={e => field('year', Number(e.target.value))} /></label>
            <label>Минуты<input type="number" min="1" value={form.duration} onChange={e => field('duration', Number(e.target.value))} /></label>
            <label>Серии<input type="number" min="0" value={form.episodes} onChange={e => field('episodes', Number(e.target.value))} /></label>
          </div>
          <div className="form-two">
            <label>Настроение<select value={form.mood} onChange={e => field('mood', e.target.value)}><option value="">Без настроения</option><option value="cry">Поплакать</option><option value="mind-blowing">Взрыв мозга</option><option value="cozy">Уютно</option><option value="fast-paced">На одном дыхании</option></select></label>
          </div>
          <div className="form-two">
            <label>Жанры (через запятую)<input value={form.genre} onChange={e => field('genre', e.target.value)} /></label>
            <label>Студия<input value={form.studio} onChange={e => field('studio', e.target.value)} placeholder="Warner Bros / MAPPA / Pixar" /></label>
          </div>
          <div className="form-two">
            <label>Режиссёр<input value={form.director} onChange={e => field('director', e.target.value)} /></label>
            <label>Страна<input value={form.country} onChange={e => field('country', e.target.value)} /></label>
          </div>
          <div className="form-two">
            <label>Ссылка на просмотр<input type="url" value={form.watchUrl} onChange={e => field('watchUrl', e.target.value)} /></label>
          </div>
          <label>Обложка * <span className="label-help">URL или загрузи файл</span>
            <div className="upload-input">
              <input required value={form.poster} onChange={e => field('poster', e.target.value)} placeholder="https://... или загрузить →" />
              <label className="upload-button"><Upload size={17} /><input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => upload(e.target.files?.[0])} /></label>
            </div>
          </label>
          <button className="primary-btn auth-submit" disabled={busy}>{busy ? 'Сохранение...' : 'Сохранить материал'} <Check size={17} /></button>
        </form>
      </div>
    </div>
  );
}

function ViewUserProfile({ userId, data, go, action, openChat, auth }: { userId: number; data: Data; go: (s: string) => void; action: (p: Record<string, unknown>, s?: string) => Promise<boolean>; openChat: (id: number) => void; auth: () => void; }) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/profile?id=' + userId).then(r => r.json()).then(d => {
      if (d.profile) setProfile(d);
      else setProfile(null);
    }).catch(() => setProfile(null)).finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div className="empty-state"><h3>Загрузка...</h3></div>;
  if (!profile) return <div className="empty-state"><h3>Пользователь не найден</h3><button className="primary-btn" onClick={() => go('/friends')}>Назад</button></div>;

  const p = profile.profile;
  const s = profile.stats;
  const level = s.level;

  const myWatchedIds = useWatchedIds(); // оптимизация: берем из контекста
  const commonFilms = profile.recentWatches.filter(w => w.film && myWatchedIds.has(w.film.id)).length;

  return (
    <>
      <button className="back-link" onClick={() => go('/friends')}>← Назад к друзьям</button>

      <div className={`profile-cover header-style- effect-${p.profileEffect || 'none'} ${p.headerImage && p.headerStyle === 5 ? 'custom-header' : ''}`} style={p.headerImage && p.headerStyle === 5 ? { backgroundImage: `linear-gradient(120deg,rgba(10,12,18,.55),rgba(10,12,18,.2)),url(${p.headerImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined} data-style={p.headerStyle || 1} data-frame={p.headerFrame || 'none'}>
        <div className="cover-noise" />
        <div className="cover-effect-layer" />
        <span className="cover-label">moviemovie · ПРОФИЛЬ УЧАСТНИКА</span>
        <div className="cover-orbit">✦</div>
        <div className="profile-cover-content">
          <Avatar name={p.username} src={p.avatar} size={90} frame={p.avatarFrame} />
          <div className="cover-identity">
            <div className="cover-badges">
              <span className="role-badge">{p.role === 'admin' ? 'АДМИНИСТРАТОР' : p.role === 'moderator' ? 'МОДЕРАТОР' : p.role === 'vip' ? 'VIP УЧАСТНИК' : 'УЧАСТНИК'}</span>
              <span className="title-badge">✦ {titleFor({ xp: p.xp } as User, s.totalWatches)}</span>
            </div>
            <h1 className={`profile-name name-fx-${p.nameEffect || 'none'} name-clr-${p.nameColor || 'default'}`}>{p.username}</h1>
            <p>{p.bio}</p>
          </div>
          <div className="cover-actions">
            {profile.friendship.status === 'accepted' ? (
              <>
                <button className="cover-edit" onClick={() => openChat(p.id)}><MessageCircle size={16} /> Написать</button>
                <button className="cover-edit" onClick={() => go('/chat')}><Send size={16} /> Чат</button>
                <button className="cover-edit" onClick={() => go("/compare/" + p.id)}><Zap size={16} /> Кино-Баттл</button>
              </>
            ) : profile.friendship.status === 'pending' ? (
              <span className="cover-edit">⏳ Заявка отправлена</span>
            ) : !profile.isSelf && data.user ? (
              <button className="cover-edit" onClick={() => action({ action: 'friend', userId: p.id }, 'Заявка отправлена')}><UserPlus size={16} /> Добавить в друзья</button>
            ) : !data.user ? (
              <button className="cover-edit" onClick={auth}>Войти</button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="profile-level-row">
        <div className="level-card">
          <div className="level-emblem"><Zap size={23} fill="currentColor" /></div>
          <div>
            <span>УРОВЕНЬ {level} · {titleFor({ xp: p.xp } as User, s.totalWatches)}</span>
            <div className="level-track"><i style={{ width: `${((p.xp || 0) % 500) / 5}%` }} /></div>
            <small>{fmt(p.xp || 0)} XP</small>
          </div>
        </div>
        <div className="profile-mini-stat"><Trophy size={21} /><b>{s.totalRatings}</b><small>оценок</small></div>
        <div className="profile-mini-stat"><Flame size={21} /><b>{s.activeDays}</b><small>активных дней</small></div>
      </div>

      <div className="profile-columns">
        <div className="profile-column">
          <div className="profile-tile">
            <div className="tile-heading"><span><BarChart3 size={18} /> Развернутая статистика</span></div>
            <div className="profile-stats-grid expanded-stats">
              <div><span className="stat-icon"><Clapperboard size={18} /></span><b>{s.totalWatches}</b><small>просмотров</small></div>
              <div><span className="stat-icon amber"><Clock3 size={18} /></span><b>{Math.floor(s.totalMinutes / 60)}ч {s.totalMinutes % 60}м</b><small>времени</small></div>
              <div><span className="stat-icon pink-icon"><Star size={18} /></span><b>{s.totalRatings}</b><small>оценок</small></div>
              <div><span className="stat-icon green"><MessageCircle size={18} /></span><b>{s.totalComments}</b><small>отзывов</small></div>
              <div><span className="stat-icon"><Bookmark size={18} /></span><b>{s.totalBookmarks}</b><small>в списке</small></div>
              <div><span className="stat-icon amber"><TrendingUp size={18} /></span><b>{s.totalWatches > 0 ? Math.round(s.totalMinutes / s.totalWatches) : 0}м</b><small>ср. время</small></div>
              <div><span className="stat-icon green"><Zap size={18} /></span><b>{p.xp}</b><small>опыт XP</small></div>
              <div><span className="stat-icon pink-icon"><Flame size={18} /></span><b>{s.activeDays}</b><small>дней стрик</small></div>
            </div>
          </div>

          <div className="profile-tile">
            <div className="tile-heading"><span><Sparkles size={18} /> Жанровые предпочтения</span></div>
            <div className="top-genres-list">
              {s.topGenres.map(g => (
                <div className="top-genre-item" key={g.genre}>
                  <span>{g.genre}</span>
                  <div className="bar-track"><i style={{ width: `${Math.max(5, g.count / Math.max(1, s.topGenres[0].count) * 100)}%` }} /></div>
                  <b>{Math.round(g.count / Math.max(1, s.totalWatches) * 100)}%</b>
                </div>
              ))}
            </div>
          </div>

          <div className="profile-tile">
            <div className="tile-heading"><span><TrendingUp size={18} /> Лучшее из просмотренного</span></div>
            <div className="history-list">
              {profile.ratings.sort((a, b) => b.value - a.value).slice(0, 5).map((r, i) => (
                <button key={i} onClick={() => go('/movie/' + r.movieId)}>
                  <PosterThumb movieId={r.movieId} src={data.films.find(f => f.id === r.movieId)?.poster} alt="" />
                  <span><b>{r.title}</b><small>Оценка: {r.value.toFixed(1)} / 10</small></span>
                  <Star size={14} fill="var(--gold)" color="var(--gold)" />
                </button>
              ))}
              {!profile.ratings.length && <div className="tile-empty">Нет оценок.</div>}
            </div>
          </div>
        </div>

        <div className="profile-column">
          <div className="profile-tile">
            <div className="tile-heading"><span><Layers3 size={18} /> Распределение по категориям</span></div>
            <div className="category-bars">
              {s.categories.map((c, i) => (
                <div className="category-bar" key={c.name}>
                  <div><span>{c.name}</span><b>{c.count} ({Math.floor(c.minutes / 60)}ч)</b></div>
                  <div className="bar-track"><i style={{ width: `${s.totalWatches ? Math.max(2, c.count / s.totalWatches * 100) : 0}%`, background: ['#a78bfa', '#67d8c7', '#f8b687', '#f490bc', '#88acff', '#f9d37d'][i] }} /></div>
                </div>
              ))}
            </div>
          </div>

          <div className="profile-tile">
            <div className="tile-heading"><span><Clock3 size={18} /> История просмотров</span></div>
            {profile.recentWatches.length ? (
              <div className="history-list">
                {profile.recentWatches.map((w, i) => w.film && (
                  <button key={i} onClick={() => go('/movie/' + w.film!.id)}>
                    <PosterThumb movieId={w.film!.id} src={w.film!.poster} alt="" />
                    <span><b>{w.film!.title}</b><small>{new Date(w.watchedAt).toLocaleDateString('ru-RU')} · {w.film!.category}</small></span>
                    <ChevronRight size={16} />
                  </button>
                ))}
              </div>
            ) : <div className="tile-empty">Нет просмотров.</div>}
          </div>

          {data.user && commonFilms > 0 && (
            <div className="profile-tile common-films-tile">
              <div className="tile-heading"><span><Heart size={18} /> Кино-связь</span></div>
              <div className="common-films-visual">
                <Avatar name={data.user.username} src={data.user.avatar} size={50} />
                <div className="common-heart"><Heart size={20} fill="var(--accent)" /></div>
                <Avatar name={p.username} src={p.avatar} size={50} />
              </div>
              <p className="common-count">У вас <b>{commonFilms}</b> общих {commonFilms === 1 ? 'фильм' : commonFilms < 5 ? 'фильма' : 'фильмов'}.</p>
              <p className="muted" style={{ fontSize: 11 }}>Ваши вкусы совпадают на {profile.compatibility}%!</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ChatPage({ data, go, openChat, auth }: { data: Data; go: (s: string) => void; openChat: (id: number) => void; auth: () => void; }) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activePeer, setActivePeer] = useState<number | null>(null);
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [shareSearch, setShareSearch] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadInbox = async () => { const r = await fetch('/api/chat'); if (r.ok) { const d = await r.json(); setConversations(d.conversations || []); } };
  const loadThread = async (peerId: number) => { const r = await fetch('/api/chat?with=' + peerId); if (r.ok) { const d = await r.json(); setThread(d.messages || []); setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 80); } };

  useEffect(() => { loadInbox(); }, []);
  useEffect(() => {
    if (activePeer) { loadThread(activePeer); pollRef.current = setInterval(() => loadThread(activePeer), 4000); }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activePeer]);

  const sendMessage = async (movieId?: number) => {
    if (!activePeer) return;
    if (!text.trim() && !movieId) return;
    setSending(true);
    try {
      await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toId: activePeer, text: text.trim() || '', movieId: movieId || null }) });
      setText(''); setShareOpen(false); await loadThread(activePeer); await loadInbox();
    } catch { } finally { setSending(false); }
  };

  const peer = activePeer ? data.people.find(p => p.id === activePeer) : null;
  const acceptedFriendIds = data.friends.filter(f => f.status === 'accepted').map(f => f.fromId === data.user?.id ? f.toId : f.fromId);
  const friendsWithoutConvo = data.people.filter(p => acceptedFriendIds.includes(p.id) && !conversations.some(c => c.peer.id === p.id));
  const shareFilms = data.films.filter(f => !shareSearch || f.title.toLowerCase().includes(shareSearch.toLowerCase())).slice(0, 6);

  if (!data.user) return <Gate title="Общайся с друзьями" description="Войди, чтобы писать друзьям и делиться впечатлениями." auth={auth} />;

  return (
    <>
      <div className="page-heading">
        <div><span className="eyebrow">КИНОБЕСЕДЫ</span><h1>Личные <em>сообщения.</em></h1><p>Обсуждай кино с друзьями и делись впечатлениями.</p></div>
        <div className="heading-count"><MessageCircle size={18} />{conversations.length} диалогов</div>
      </div>

      <div className="chat-layout">
        <div className="chat-sidebar">
          <div className="chat-sidebar-head"><h3>Диалоги</h3><span>{conversations.reduce((n, c) => n + c.unread, 0)} непрочит.</span></div>
          {conversations.map(c => (
            <button key={c.peer.id} className={`chat-contact ${activePeer === c.peer.id ? 'active' : ''}`} onClick={() => setActivePeer(c.peer.id)}>
              <Avatar name={c.peer.username} src={c.peer.avatar} size={42} />
              <div className="chat-contact-info">
                <b>{c.peer.username}</b><small>{c.hasFilm ? '📎 ' : ''}{c.lastMessage}</small>
              </div>
              {c.unread > 0 && <span className="chat-unread">{c.unread}</span>}
              <span className="chat-time">{new Date(c.lastMessageAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
            </button>
          ))}

          {friendsWithoutConvo.length > 0 && (
            <>
              <div className="chat-sidebar-divider">Начать диалог</div>
              {friendsWithoutConvo.map(p => (
                <button key={p.id} className="chat-contact" onClick={() => setActivePeer(p.id)}>
                  <Avatar name={p.username} src={p.avatar} size={42} />
                  <div className="chat-contact-info"><b>{p.username}</b><small>Нет сообщений</small></div>
                </button>
              ))}
            </>
          )}

          {conversations.length === 0 && friendsWithoutConvo.length === 0 && (
            <div className="chat-empty-sidebar">
              <MessageCircle size={28} />
              <p>Добавь друзей, чтобы начать общение</p>
              <button className="outline-btn small" onClick={() => go('/friends')}>Найти друзей</button>
            </div>
          )}
        </div>

        <div className="chat-main">
          {activePeer && peer ? (
            <>
              <div className="chat-header">
                <button className="chat-header-user" onClick={() => go('/user/' + peer.id)}>
                  <Avatar name={peer.username} src={peer.avatar} size={38} />
                  <div><b>{peer.username}</b><small>{peer.role === 'admin' ? 'Администратор' : peer.role === 'vip' ? 'VIP участник' : `Уровень ${Math.floor((peer.xp || 0) / 500) + 1}`}</small></div>
                </button>
                <button className="outline-btn small" onClick={() => go('/user/' + peer.id)}><Eye size={14} /> Профиль</button>
              </div>

              <div className="chat-messages" ref={scrollRef}>
                {thread.map(m => (
                  <div key={m.id} className={`chat-bubble ${m.fromId === data.user?.id ? 'mine' : 'theirs'}`}>
                    <div className="bubble-body">
                      <p>{m.body}</p>
                      {m.film && (
                        <button className="shared-film-card" onClick={() => go('/movie/' + m.film!.id)}>
                          <PosterThumb movieId={m.film!.id} src={m.film!.poster} alt="" />
                          <div><b>{m.film!.title}</b><small>{m.film!.year} · {m.film!.category}</small></div>
                          <ArrowUpRight size={14} />
                        </button>
                      )}
                    </div>
                    <span className="bubble-time">
                      {new Date(m.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      {m.fromId === data.user?.id && <>{m.read ? ' ✓✓' : ' ✓'}</>}
                    </span>
                  </div>
                ))}
                {thread.length === 0 && <div className="chat-empty-thread"><Sparkles size={28} /><p>Напиши первое сообщение!</p></div>}
              </div>

              <div className="chat-compose">
                {shareOpen && (
                  <div className="chat-share-panel">
                    <div className="chat-share-head"><b>Поделиться фильмом</b><button onClick={() => setShareOpen(false)}><X size={16} /></button></div>
                    <input value={shareSearch} onChange={e => setShareSearch(e.target.value)} placeholder="Поиск фильма..." />
                    <div className="chat-share-list">
                      {shareFilms.map(f => (
                        <button key={f.id} onClick={() => sendMessage(f.id)} className="chat-share-item">
                          <PosterThumb movieId={f.id} src={f.poster} alt="" />
                          <div><b>{f.title}</b><small>{f.year} · ★ {f.rating.toFixed(1)}</small></div>
                          <Send size={14} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="chat-input-row">
                  <button className="chat-attach-btn" onClick={() => setShareOpen(!shareOpen)} title="Поделиться фильмом"><Film size={19} /></button>
                  <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="Написать сообщение..." />
                  <button className="chat-send-btn" disabled={sending || (!text.trim())} onClick={() => sendMessage()}><Send size={18} /></button>
                </div>
              </div>
            </>
          ) : (
            <div className="chat-placeholder">
              <MessageCircle size={40} />
              <h3>Выбери собеседника</h3>
              <p>Кликни на контакт слева, чтобы начать разговор.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ChatDrawer({ peerId, data, go, close, notify }: { peerId: number; data: Data; go: (s: string) => void; close: () => void; notify: (s: string) => void; }) {
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareSearch, setShareSearch] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const peer = data.people.find(p => p.id === peerId);

  const loadThread = async () => {
    const r = await fetch('/api/chat?with=' + peerId);
    if (r.ok) {
      const d = await r.json();
      setThread(d.messages || []);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 60);
    }
  };

  useEffect(() => {
    loadThread();
    pollRef.current = setInterval(loadThread, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [peerId]);

  const sendMessage = async (movieId?: number) => {
    if (!text.trim() && !movieId) return;
    setSending(true);
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toId: peerId, text: text.trim() || '', movieId: movieId || null })
      });
      if (r.ok) {
        setText(''); setShareOpen(false); await loadThread();
      } else {
        const d = await r.json(); notify(d.error || 'Ошибка');
      }
    } catch {
      notify('Ошибка отправки');
    } finally {
      setSending(false);
    }
  };

  const shareFilms = data.films.filter(f => !shareSearch || f.title.toLowerCase().includes(shareSearch.toLowerCase())).slice(0, 5);

  if (!peer) return null;

  return (
    <div className="chat-drawer">
      <div className="chat-drawer-header">
        <button className="chat-header-user" onClick={() => { close(); go('/user/' + peer.id); }}>
          <Avatar name={peer.username} src={peer.avatar} size={34} />
          <div><b>{peer.username}</b><small>Личный чат</small></div>
        </button>
        <div className="chat-drawer-actions">
          <button onClick={() => { close(); go('/chat'); }} title="Открыть полный чат"><ExternalLink size={16} /></button>
          <button onClick={close}><X size={18} /></button>
        </div>
      </div>

      <div className="chat-messages chat-drawer-messages" ref={scrollRef}>
        {thread.map(m => (
          <div key={m.id} className={`chat-bubble ${m.fromId === data.user?.id ? 'mine' : 'theirs'}`}>
            <div className="bubble-body">
              <p>{m.body}</p>
              {m.film && (
                <button className="shared-film-card" onClick={() => { close(); go('/movie/' + m.film!.id); }}>
                  <PosterThumb movieId={m.film!.id} src={m.film!.poster} alt="" />
                  <div><b>{m.film!.title}</b><small>{m.film!.year} · {m.film!.category}</small></div>
                  <ArrowUpRight size={14} />
                </button>
              )}
            </div>
            <span className="bubble-time">{new Date(m.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        ))}
        {thread.length === 0 && <div className="chat-empty-thread"><Sparkles size={24} /><p>Начни разговор!</p></div>}
      </div>

      <div className="chat-compose">
        {shareOpen && (
          <div className="chat-share-panel drawer-share">
            <div className="chat-share-head"><b>Поделиться</b><button onClick={() => setShareOpen(false)}><X size={14} /></button></div>
            <input value={shareSearch} onChange={e => setShareSearch(e.target.value)} placeholder="Поиск..." />
            <div className="chat-share-list">
              {shareFilms.map(f => (
                <button key={f.id} onClick={() => sendMessage(f.id)} className="chat-share-item">
                  <PosterThumb movieId={f.id} src={f.poster} alt="" />
                  <div><b>{f.title}</b><small>★ {f.rating.toFixed(1)}</small></div>
                  <Send size={13} />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="chat-input-row">
          <button className="chat-attach-btn" onClick={() => setShareOpen(!shareOpen)}><Film size={17} /></button>
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="Сообщение..." />
          <button className="chat-send-btn" disabled={sending || (!text.trim())} onClick={() => sendMessage()}><Send size={16} /></button>
        </div>
      </div>
    </div>
  );
}

function ComparePage({ data, compareId, go, auth }: { data: Data; compareId: number; go: (s: string) => void; auth: () => void; }) {
  const [compData, setCompData] = useState<ProfileData | null>(null);
  useEffect(() => { fetch('/api/profile?id=' + compareId).then(r => r.json()).then(d => setCompData(d.profile ? d : null)); }, [compareId]);

  if (!data.user) return <Gate title="Битва вкусов" description="Войди, чтобы сравнить свои вкусы с друзьями." auth={auth} />;
  if (!compData) return <div className="empty-state">Загрузка...</div>;

  const myRatingsMap = new Map(data.ratings.map(r => [r.movieId, r.value]));
  const disputes = compData.ratings
    .filter(r => myRatingsMap.has(r.movieId))
    .map(r => ({ film: data.films.find(f => f.id === r.movieId), my: myRatingsMap.get(r.movieId)!, their: r.value }))
    .sort((a, b) => Math.abs(b.my - b.their) - Math.abs(a.my - a.their))
    .slice(0, 5);

  const agreements = compData.ratings
    .filter(r => myRatingsMap.has(r.movieId) && Math.abs(r.value - myRatingsMap.get(r.movieId)!) <= 1 && r.value >= 8)
    .map(r => ({ film: data.films.find(f => f.id === r.movieId), my: myRatingsMap.get(r.movieId)!, their: r.value }))
    .slice(0, 5);

  return (
    <>
      <button className="back-link" onClick={() => go('/user/' + compareId)}>← Назад к профилю</button>
      <div className="page-heading">
        <div><span className="eyebrow">КИНО-БАТТЛ ДРУЗЕЙ</span><h1>Сравнение вкусов.</h1><p>Ты и {compData.profile.username}</p></div>
      </div>

      <div className="compare-section">
        <SectionTitle title="Главные споры" />
        {disputes.length ? disputes.map((d, i) => (
          <div key={i} className="compare-row">
            <PosterThumb movieId={d.film?.id} src={d.film?.poster} alt="" />
            <div className="compare-info"><b>{d.film?.title}</b></div>
            <div className="compare-scores">
              <div className="mine"><span>Ты</span><b>{d.my}</b></div>
              <div className="theirs"><span>Они</span><b>{d.their}</b></div>
            </div>
          </div>
        )) : <p className="muted">Нет общих оценок для споров.</p>}
      </div>

      <div className="compare-section">
        <SectionTitle title="Единодушие" />
        {agreements.length ? agreements.map((d, i) => (
          <div key={i} className="compare-row">
            <PosterThumb movieId={d.film?.id} src={d.film?.poster} alt="" />
            <div className="compare-info"><b>{d.film?.title}</b></div>
            <div className="compare-scores">
              <div className="mine"><span>Ты</span><b>{d.my}</b></div>
              <div className="theirs"><span>Они</span><b>{d.their}</b></div>
            </div>
          </div>
        )) : <p className="muted">Пока нет совпадений.</p>}
      </div>
    </>
  );
}

function WrappedPage({ data, go, auth }: { data: Data; go: (s: string) => void; auth: () => void; }) {
  const [step, setStep] = useState(0);
  if (!data.user) return <Gate title="Итоги Киногода" description="Смотри фильмы весь год, чтобы получить персональную статистику." auth={auth} />;

  const minutes = data.watches.reduce((n, w) => n + (data.films.find(f => f.id === w.movieId)?.duration || 0), 0);
  const genreMap = new Map<string, number>();
  data.watches.forEach(w => { const f = data.films.find(x => x.id === w.movieId); if (f) f.genre.split(',').forEach(g => genreMap.set(g.trim(), (genreMap.get(g.trim()) || 0) + 1)); });
  const topGenre = [...genreMap.entries()].sort((a, b) => b[1] - a[1])[0];

  const slides = [
    <div className="wrapped-slide wrapped-1" key={1}><h1>Твой 2026 киногод</h1><p>Это было легендарно.</p><button className="primary-btn" onClick={() => setStep(1)}>Начать <ArrowRight size={16} /></button></div>,
    <div className="wrapped-slide wrapped-2" key={2} onClick={() => setStep(2)}><h2>Ты провёл в кино<br /><span>{Math.floor(minutes / 60)} часов</span></h2><p>Это {Math.floor(minutes / 1440)} полных дней без сна!</p></div>,
    <div className="wrapped-slide wrapped-3" key={3} onClick={() => setStep(3)}><h2>Твоя жанровая душа:<br /><span>{topGenre ? topGenre[0] : 'Неизвестно'}</span></h2><p>Ты посмотрел {topGenre ? topGenre[1] : 0} историй в этом жанре.</p></div>,
    <div className="wrapped-slide wrapped-final" key={4}><h2>moviemovie Wrapped</h2><p>Твой год в цифрах. Делись в сторис!</p><div className="wrapped-card"><b>{data.user.username}</b><p>{data.watches.length} просмотров</p><p>{Math.floor(minutes / 60)} часов</p><p>Любимый жанр: {topGenre ? topGenre[0] : '-'}</p></div><button className="primary-btn" onClick={() => go('/profile')}>Завершить</button></div>
  ];
  return <div className="wrapped-container">{slides[step]}</div>;
}

function CollabLists({ data, go, action, auth }: { data: Data; go: (s: string) => void; action: (p: Record<string, unknown>, s?: string) => Promise<boolean>; auth: () => void; }) {
  const [title, setTitle] = useState('');
  if (!data.user) return <Gate title="Совместные подборки" description="Создавай списки и выбирай фильмы вместе с друзьями." auth={auth} />;
  return (
    <>
      <div className="page-heading">
        <div><span className="eyebrow">СМОТРИМ ВМЕСТЕ</span><h1>Совместные <em>подборки.</em></h1><p>Голосуй и добавляй фильмы.</p></div>
      </div>
      <div className="collab-create">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Название новой подборки..." />
        <button className="primary-btn" onClick={() => { if (title) action({ action: 'createList', title }); setTitle(''); }}><Plus size={16} /> Создать</button>
      </div>
      <div className="collab-grid">
        {data.lists?.map((l: any) => (
          <div key={l.id} className="collab-list">
            <h3>{l.title}</h3>
            {l.items?.map((i: any) => (
              <div key={i.id} className="collab-item">
                <PosterThumb movieId={i.film?.id} src={i.film?.poster} alt="" />
                <span>{i.film?.title}</span>
                <button onClick={() => action({ action: 'voteList', itemId: i.id })}><Heart size={14} /> {i.votes}</button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

function WatchRoom({ roomId, data, go, action, auth }: { roomId: string; data: Data; go: (s: string) => void; action: (p: Record<string, unknown>) => Promise<boolean>; auth: () => void; }) {
  const [film, setFilm] = useState<FilmType | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [activeEmbed, setActiveEmbed] = useState('');
  const [chatLog, setChatLog] = useState<{ id: number, user: string, text: string }[]>([]);
  const [chat, setChat] = useState('');
  const [reactions, setReactions] = useState<{ id: number, emoji: string }[]>([]);
  const msgRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!data.user) return;
    const mId = searchParams.get('movie');
    if (mId) {
      const f = data.films.find(x => x.id === Number(mId));
      if (f) { setFilm(f); return; }
    }
    setFilm(data.films[0] || null);
  }, [data.user, searchParams, data.films]);

  useEffect(() => { if (msgRef.current) msgRef.current.scrollTop = msgRef.current.scrollHeight; }, [chatLog]);

  if (!data.user) return <Gate title="Кинозал для друзей" description="Войди, чтобы смотреть кино вместе." auth={auth} />;

  const sendReaction = (emoji: string) => {
    const id = Date.now();
    setReactions(r => [...r, { id, emoji }]);
    setTimeout(() => setReactions(r => r.filter(x => x.id !== id)), 2500);
  };

  const sendChat = () => {
    if (!chat.trim()) return;
    setChatLog(l => [...l, { id: Date.now(), user: data.user?.username || 'Гость', text: chat.trim() }]);
    setChat('');
  };

  const applyVideo = () => {
    if (!videoUrl) return;
    let finalUrl = videoUrl;
    if (videoUrl.includes('youtube.com/watch?v=')) finalUrl = videoUrl.replace('watch?v=', 'embed/');
    else if (videoUrl.includes('youtu.be/')) finalUrl = videoUrl.replace('youtu.be/', 'youtube.com/embed/');
    setActiveEmbed(finalUrl);
  };

  if (!film) return <div className="empty-state"><Sparkles size={40} /><h3>Подготовка зала...</h3><p>Устанавливаем связь с кинотеатром</p></div>;

  return (
    <>
      <div className="page-heading" style={{ marginBottom: 10 }}>
        <div><span className="eyebrow"><Tv2 size={14} /> КИНОЗАЛ · КОД: {roomId}</span><h1 style={{ fontSize: 24, margin: '5px 0 0' }}>{film.title}</h1></div>
        <button className="outline-btn small" onClick={() => go('/watchroom')}>← Выйти из зала</button>
      </div>

      <div className="room-layout">
        <div className="room-player">
          <div className="room-video-area">
            {!activeEmbed ? (
              <div className="room-setup-prompt">
                <MonitorPlay size={48} />
                <h3>Вставьте ссылку на плеер</h3>
                <p>Поддерживаются YouTube, VK Видео, RuTube и другие прямые iframe-ссылки.</p>
                <div className="room-url-input">
                  <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
                  <button className="primary-btn" onClick={applyVideo}>Запустить <Play size={14} /></button>
                </div>
                <span className="room-disclaimer">Синхронизация происходит автоматически при вставке ссылки.</span>
              </div>
            ) : (
              <iframe
                src={activeEmbed}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="room-iframe"
              />
            )}
            <div className="reaction-track">{reactions.map(r => <span key={r.id} className="flying-reaction">{r.emoji}</span>)}</div>
          </div>
        </div>

        <div className="room-chat">
          <div className="room-reactions">
            <button onClick={() => sendReaction('🍿')}>🍿</button>
            <button onClick={() => sendReaction('😱')}>😱</button>
            <button onClick={() => sendReaction('😭')}>😭</button>
            <button onClick={() => sendReaction('🤯')}>🤯</button>
            <button onClick={() => sendReaction('😍')}>😍</button>
          </div>
          <div className="room-messages" ref={msgRef}>
            <div className="chat-empty-thread" style={{ marginBottom: 20 }}><Sparkles size={20} /><p>Комната {roomId} создана.<br />Пригласи друзей по коду!</p></div>
            {chatLog.map(m => <div key={m.id} className="room-chat-msg"><b>{m.user}:</b> <span>{m.text}</span></div>)}
          </div>
          <div className="chat-input-row" style={{ padding: '10px' }}>
            <input value={chat} onChange={e => setChat(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendChat(); }} placeholder="Чат комнаты..." />
            <button className="chat-send-btn" onClick={sendChat}><Send size={16} /></button>
          </div>
        </div>
      </div>
    </>
  );
}

function AboutAdmin({ data, go }: { data: Data; go: (s: string) => void; }) {
  if (data.user?.role !== 'admin') return <div className="gate"><LockKeyhole size={40} /><h1>Только для администраторов</h1><p>Этот раздел содержит закрытую документацию проекта.</p><button className="primary-btn" onClick={() => go('/')}>На главную</button></div>;

  const stats = [
    { icon: '🎬', label: 'Материалов в каталоге', value: data.films.length },
    { icon: '👥', label: 'Зарегистрированных участников', value: data.people.length },
    { icon: '👁️', label: 'Всего просмотров', value: data.leaderboard.reduce((n, p) => n + p.watches, 0) },
    { icon: '⭐', label: 'Поставлено оценок', value: data.leaderboard.reduce((n, p) => n + p.ratings, 0) },
    { icon: '💬', label: 'Комментариев', value: data.comments.length },
    { icon: '🏆', label: 'Активных челленджей', value: data.challenges.filter((c: any) => c.current).length },
    { icon: '✉️', label: 'Сообщений в чате', value: '-' },
    { icon: '🤝', label: 'Дружеских связей', value: data.leaderboard.length }
  ];

  const sections = [
    { id: 'catalog', icon: <Film size={20} />, color: 'violet', title: 'Каталог материалов', subtitle: 'Хранилище всего контента проекта', items: ['12+ материалов в стартовом каталоге', '6 категорий: Фильм, Сериал, Мультфильм, Мультсериал, Аниме-сериал, Аниме-фильм', 'Поиск по названию, жанру, режиссёру, описанию', 'Фильтры: год, жанр, минимальный рейтинг, категория', 'Сортировка: популярные, по рейтингу, новые, старые', 'Рейтинговые цвета карточек: золото (8.5+), бирюза (7+), синий (5+), красный', 'Счётчик уникальных просмотров страниц материала', 'Поле «Серии» для сериалов и аниме', 'Тег настроения (mood) для фильтров', 'Кнопка «Добавить материал» в каталоге для admin/moderator'] },
    { id: 'auth', icon: <Shield size={20} />, color: 'amber', title: 'Система аккаунтов', subtitle: 'Многоуровневая авторизация и роли', items: ['Регистрация по email + пароль (bcryptjs, стойкость 12)', 'Вход через Telegram Login Widget (NEXT_PUBLIC_TELEGRAM_BOT_NAME)', 'OAuth Яндекс (authorization code flow)', 'Сессии: подписанные JWT, httpOnly cookie, 30 дней', '5 ролей: Гость → Посетитель → VIP → Модератор → Администратор', 'Дополнительный титул по статистике (Легенда экрана, Мастер кадров...)', 'Защита маршрутов: requireAuth на клиенте, проверка роли на сервере', 'Telegram ID привязывается к аккаунту без email'] },
    { id: 'profile', icon: <Users size={20} />, color: 'blue', title: 'Личный кабинет', subtitle: 'Кастомизируемый профиль с прогрессией', items: ['5 уникальных шаблонов шапки профиля', '4 рамки аватара: Золото (500 XP), Неон (1500 XP), Аметист (2500 XP)', '4 рамки шапки профиля с теми же условиями', 'Загрузка аватара: JPG, PNG, WebP до 4 МБ', 'Перетаскиваемые живые виджеты (drag and drop)', '5 виджетов: Статистика, Категории, История, Достижения, Друзья', 'XP-система: 500 XP = 1 уровень', 'Начисление XP: просмотр +35, оценка +10, комментарий +15, игра до +100', 'Прогресс-бар уровня в профиле', 'Отображение стрика активных дней'] },
    { id: 'social', icon: <Users size={20} />, color: 'green', title: 'Социальные функции', subtitle: 'Сообщество, дружба и общение', items: ['Система друзей: заявки, принятие, отклонение', 'Личный чат: переписка между друзьями в реальном времени', 'Опрос чата каждые 4 секунды для живого обновления', 'Поделиться фильмом в чате (прикреплённая карточка)', 'Плавающий Chat Drawer из любого места сайта', 'Страница сравнения /compare/:id — «Кино-Баттл»', 'Просмотр публичных профилей: /user/:id', 'Процент кино-совместимости (алгоритм: просмотры + оценки + жанры)', 'Уведомления: ответ на комментарий, лайк, заявка в друзья, рекомендация', 'Рекомендация фильма другу из карточки или чата', 'Счётчик непрочитанных сообщений в навигации'] },
    { id: 'stats', icon: <BarChart3 size={20} />, color: 'pink', title: 'Статистика и аналитика', subtitle: 'Детальная картина активности', items: ['Общее количество просмотров, уникальных историй, часов', 'Разбивка по 6 категориям материалов с минутами', 'Топ-жанры пользователя с прогресс-барами', 'История просмотров с датами и деталями', 'Лидерборд: 6 метрик (часы, просмотры, стрик, XP, оценки, игры)', 'Пьедестал почёта с визуализацией трёх лидеров', 'Статистика активности друзей в профиле', 'Общие фильмы с конкретным другом', 'Сравнение оценок: споры и совпадения', 'Итоги месяца (Monthly Wrap-Up)', 'Итоги года moviemovie Wrapped (5 слайдов)'] },
    { id: 'games', icon: <Gamepad2 size={20} />, color: 'violet', title: 'Мини-игры', subtitle: '16 режимов в тематике кино', items: ['Угадай по сюжету — описание → название', 'Год премьеры — выбор из 4 вариантов', 'Кто режиссёр — режиссёр фильма', 'Жанровый детектив — жанр по названию', 'Угадай по постеру — название по обложке', 'Хронометраж — длительность фильма', 'Карта кино — страна производства', 'Оригинальное название — перевод названия', 'Тип истории — категория материала', 'Рейтинговая битва — у кого оценка выше', '🟩 Кино-Вордли — угадай по подсказкам', '🔡 Поле Чудес — по буквам', '🔀 Анаграмма — собери буквы', '🤥 Две правды, одна ложь — найди фальшивый факт', '⏳ Хроно-Слайдер — хронология фильмов', '🧩 Кино-Связи — группы по признаку', '5 вопросов за сессию, результат → XP'] },
    { id: 'gamification', icon: <Trophy size={20} />, color: 'amber', title: 'Геймификация', subtitle: 'Достижения, челленджи, прогрессия', items: ['30 достижений, каждое с 3 тирами (I, II, III)', 'Тиры открываются прогрессивно по порогу прогресса', 'Ежемесячные челленджи — по 3–5 на каждый месяц года', 'Разнообразие: жанровые, категорийные, социальные, ночные, скоростные', 'Прогресс-бар челленджа с процентом выполнения', 'Страница /challenges с навигацией по всем 12 месяцам', 'Сводная панель: выполнено / XP заработано / всего закрыто', 'Season Pass с миссиями', 'Коллаборативные подборки с голосованием'] },
    { id: 'discovery', icon: <Compass size={20} />, color: 'blue', title: 'Виджеты и контент', subtitle: 'Умные рекомендации и память', items: ['Кино-День: тематический фильтр по дате календаря', '«В этот день» — ретроспектива просмотров и юбилеев фильмов', 'Виджет «Капсула времени» — случайный день из истории', 'Итоги прошлого месяца в профиле', 'Рулетка материалов — анимированный выбор случайного фильма', 'Пульс недели: лучший, худший, новинка, высокий рейтинг', 'Лента «Что сейчас смотрят» по просмотрам', 'Лента «Свежие находки» по году', 'Похожие фильмы на странице материала по жанру', 'Виджет челленджей на главной', 'Сезонный Pass-виджет'] },
    { id: 'tech', icon: <BarChart3 size={20} />, color: 'green', title: 'Техническая архитектура', subtitle: 'Стек и устройство системы', items: ['Next.js 16 App Router — SSR + клиентские компоненты', 'PostgreSQL + Drizzle ORM — типобезопасные запросы', '16 таблиц БД: users, movies, watches, ratings, comments, reactions, bookmarks, friendships, notifications, messages, challenges...', 'JWT-сессии: jose + httpOnly cookie', 'bcryptjs для паролей (стойкость 12)', 'Единый компонент movie-go-app.tsx', 'REST API: /api/auth, /api/data, /api/action, /api/chat, /api/profile, /api/upload, /api/visit, /api/oauth', 'Загрузка файлов: Base64 Data URI через /api/upload', 'Подсчёт совместимости: взвешенный алгоритм (40% просмотры + 30% рейтинги + 30% жанры)', 'Polling чата каждые 4с через setInterval'] },
    { id: 'design', icon: <Sparkles size={20} />, color: 'pink', title: 'Дизайн-система', subtitle: 'Glassmorphism + 5 тем + адаптив', items: ['Шрифт Inter (Google Fonts): 400–900', 'Glassmorphism: backdrop-filter blur(40px) saturate(1.5) на всех поверхностях', 'CSS-переменные: --bg, --surface, --surface2, --surface3, --border, --accent...', '5 тем: Тёмная, Светлая, Розовая, Фиолетовая, Жёлтая', 'Акцент сохраняется в localStorage + синхронизируется с профилем', 'CSS-анимации: pulse-glow, toast-in, orbit-spin, flyUp, loading', 'Адаптивность: 4 брейкпоинта (1300/1050/760/520px)', 'Компактный сайдбар на планшете (68px), drawer на мобиле', 'Стили рейтинга: золото/бирюза/синий/красный на рамках постеров', 'Рамки аватара с box-shadow свечением', 'Drag & drop для виджетов профиля (native HTML5)'] },
  ];

  const roles = [
    { role: 'Гость', icon: '🌐', access: 'Просмотр главной, каталога, карточек материалов' },
    { role: 'Посетитель', icon: '👤', access: 'Все функции + профиль, оценки, комментарии, достижения, друзья, чат, игры' },
    { role: 'VIP', icon: '💎', access: 'Всё что посетитель + приоритет в поддержке и особый значок' },
    { role: 'Модератор', icon: '🛡️', access: 'Всё + добавление и редактирование материалов в каталоге' },
    { role: 'Администратор', icon: '👑', access: 'Полный доступ + удаление материалов, управление ролями, страница О проекте' }
  ];

  const techStack = [
    { label: 'Framework', value: 'Next.js 16 App Router', sub: 'React 19 + TypeScript 5' },
    { label: 'Database', value: 'PostgreSQL 16', sub: 'Drizzle ORM 0.45' },
    { label: 'Auth', value: 'JWT + bcryptjs', sub: 'jose, Telegram, Яндекс OAuth' },
    { label: 'Styling', value: 'Custom CSS + Tailwind', sub: 'Inter + glassmorphism' },
    { label: 'Storage', value: 'Base64 Data URI', sub: '/api/upload' },
    { label: 'State', value: 'React useState + REST', sub: 'Polling interval 4s' }
  ];

  return (
    <div className="about-page">
      <div className="about-hero">
        <div className="about-hero-bg" />
        <div className="about-hero-content">
          <div className="about-logo"><Clapperboard size={32} strokeWidth={2.2} /><span>movie<b>{"//"}</b>go</span></div>
          <span className="eyebrow"><LockKeyhole size={12} /> ДОКУМЕНТАЦИЯ ПРОЕКТА · ТОЛЬКО ДЛЯ АДМИНИСТРАТОРОВ</span>
          <h1>Movie<span>{"//"}</span>Go</h1>
          <p className="about-tagline">Полноценная платформа для ведения личного киноархива с социальными функциями, геймификацией и глубокой статистикой</p>
          <div className="about-hero-meta"><span>Версия 2.0</span><span>·</span><span>2026 год</span><span>·</span><span>Next.js 16</span><span>·</span><span>PostgreSQL</span></div>
        </div>
      </div>

      <div className="about-live-stats">
        <div className="als-header"><span className="eyebrow"><Globe2 size={13} /> LIVE-СТАТИСТИКА СИСТЕМЫ</span></div>
        <div className="als-grid">
          {stats.map((s, i) => (
            <div className="als-card" key={i}>
              <span className="als-icon">{s.icon}</span>
              <div>
                <b>{typeof s.value === 'number' ? new Intl.NumberFormat('ru-RU').format(s.value) : s.value}</b>
                <small>{s.label}</small>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="about-sections">
        <div className="about-section-label"><span className="eyebrow"><GitBranch size={13} /> ФУНКЦИОНАЛЬНЫЕ МОДУЛИ</span></div>
        <div className="as-grid">
          {sections.map(sec => (
            <div className={`as-card as-${sec.color}`} key={sec.id}>
              <div className="as-card-head"><div className={`as-icon as-icon-${sec.color}`}>{sec.icon}</div><div><h3>{sec.title}</h3><p>{sec.subtitle}</p></div></div>
              <ul className="as-list">{sec.items.map((item, i) => <li key={i}><Check size={12} />{item}</li>)}</ul>
            </div>
          ))}
        </div>
      </div>

      <div className="about-roles">
        <div className="about-section-label"><span className="eyebrow"><Shield size={13} /> СИСТЕМА РОЛЕЙ</span></div>
        <div className="roles-table">
          <div className="roles-header"><span>Роль</span><span>Доступ</span></div>
          {roles.map((r, i) => (
            <div className="roles-row" key={i}>
              <div className="role-cell"><span>{r.icon}</span><div><b>{r.role}</b></div></div>
              <div className="role-access">{r.access}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="about-stack">
        <div className="about-section-label"><span className="eyebrow"><BarChart3 size={13} /> ТЕХНИЧЕСКИЙ СТЕК</span></div>
        <div className="stack-grid">
          {techStack.map((t, i) => <div className="stack-card" key={i}><small>{t.label}</small><b>{t.value}</b><span>{t.sub}</span></div>)}
        </div>
      </div>

      <div className="about-accounts">
        <div className="about-section-label"><span className="eyebrow"><Globe2 size={13} /> ТЕСТОВЫЕ АККАУНТЫ</span></div>
        <div className="accounts-grid">
          <div className="account-card"><div className="account-role admin">ADMIN</div><b>demo@moviego.ru</b><span>Demo12345!</span><p>cinephile · XP 2450 · Легенда экрана</p></div>
          <div className="account-card"><div className="account-role vip">VIP</div><b>luna@moviego.ru</b><span>Demo12345!</span><p>lunafilm · XP 1890</p></div>
          <div className="account-card"><div className="account-role user">ПОСЕТИТЕЛЬ</div><b>max@moviego.ru</b><span>Demo12345!</span><p>maxframes · XP 1320</p></div>
          <div className="account-card"><div className="account-role mod">МОДЕРАТОР</div><b>neo@moviego.ru</b><span>Demo12345!</span><p>neonight · XP 760</p></div>
        </div>
      </div>

      <div className="about-footer-note">
        <Sparkles size={18} />
        <div>
          <h3>moviemovie — это живой проект</h3>
          <p>Архитектура модульная и расширяемая. Каждый компонент задокументирован тегами [SECTION:NAME] для удобного поиска и редактирования. БД управляется Drizzle ORM — добавление новых таблиц через <code>npx drizzle-kit push</code>.</p>
        </div>
      </div>
    </div>
  );
}

function WatchRoomLobby({ data, go, action, auth }: { data: Data; go: (s: string) => void; action: (p: Record<string, unknown>) => Promise<boolean>; auth: () => void; }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<FilmType | null>(null);
  const [roomLink, setRoomLink] = useState('');
  const [joinCode, setJoinCode] = useState('');

  if (!data.user) return <Gate title="Кинозал для друзей" description="Войди, чтобы создать комнату и смотреть кино вместе с друзьями онлайн." auth={auth} />;

  const filtered = data.films.filter(f => !search || f.title.toLowerCase().includes(search.toLowerCase())).slice(0, 12);

  return (
    <>
      <div className="page-heading">
        <div><span className="eyebrow"><Tv2 size={14} /> СОВМЕСТНЫЙ ПРОСМОТР</span><h1>Виртуальный <em>кинозал.</em></h1><p>Выбери фильм, создай комнату и поделись ссылкой с другом — смотрите синхронно.</p></div>
      </div>

      <div className="watchroom-layout">
        <div className="watchroom-create-card">
          <div className="wrc-header"><span className="wrc-icon"><Sparkles size={22} /></span><div><h3>Создать новую комнату</h3><p>Сгенерируй ссылку и отправь другу</p></div></div>

          <div className="wrc-film-picker">
            <span className="eyebrow">ВЫБЕРИ ФИЛЬМ ДЛЯ ПРОСМОТРА</span>
            <div className="catalog-search compact" style={{ marginTop: 12 }}><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск фильма..." /></div>
            <div className="wrc-film-grid">
              {filtered.map(f => (
                <button key={f.id} className={`wrc-film-item ${selected?.id === f.id ? 'selected' : ''}`} onClick={() => setSelected(f)}>
                  <PosterThumb movieId={f.id} src={f.poster} alt="" />
                  <span>{f.title}</span>
                  {selected?.id === f.id && <Check size={14} />}
                </button>
              ))}
            </div>
          </div>

          {selected && (
            <div className="wrc-selected">
              <PosterThumb movieId={selected.id} src={selected.poster} alt="" />
              <div><b>{selected.title}</b><small>{selected.year} · {selected.category} · {selected.duration} мин</small></div>
            </div>
          )}

          <button
            className="primary-btn wrc-start"
            onClick={() => {
              if (!selected) return;
              const code = Math.random().toString(36).slice(2, 8).toUpperCase();
              const url = window.location.origin + '/room/' + code;
              setRoomLink(url);
              navigator.clipboard.writeText(url).catch(() => {});
              go(`/room/${code}?movie=${selected.id}`);
            }}
            disabled={!selected}
          >
            <Tv2 size={18} />{selected ? `Открыть зал «${selected.title.slice(0, 20)}...»` : 'Сначала выбери фильм'}
          </button>

          {roomLink && <div className="wrc-link-box"><Link2 size={15} /><span>{roomLink}</span><button onClick={() => navigator.clipboard.writeText(roomLink).then(() => {})}><Copy size={14} /></button></div>}
          <p className="wrc-hint">Ссылка скопирована в буфер — отправь другу в чат 🍿</p>
        </div>

        <div className="watchroom-join-card">
          <div className="wrc-header"><span className="wrc-icon join-icon"><UsersRound size={22} /></span><div><h3>Войти в комнату</h3><p>Введи код комнаты от друга</p></div></div>
          <div className="wrc-join-form">
            <label>Код комнаты<input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="XXXXXX" maxLength={6} /></label>
            <button className="primary-btn" disabled={joinCode.length < 4} onClick={() => go('/room/' + joinCode + '?movie=1')}><ArrowRight size={17} /> Войти в зал</button>
          </div>

          <div className="wrc-how">
            <span className="eyebrow">КАК ЭТО РАБОТАЕТ</span>
            <div className="wrc-steps">
              <div><span>1</span><p>Один создаёт комнату и выбирает фильм</p></div>
              <div><span>2</span><p>Копирует ссылку и отправляет другу</p></div>
              <div><span>3</span><p>Все жмут «Старт» — таймер запускается синхронно</p></div>
              <div><span>4</span><p>Обсуждаете в чате и кидаете реакции 🍿😱🤯</p></div>
            </div>
          </div>

          <div className="wrc-friends">
            <span className="eyebrow">ПРИГЛАСИ ДРУГА</span>
            {data.friends.filter(f => f.status === 'accepted').slice(0, 4).map(f => {
              const peer = data.people.find(p => p.id === (f.fromId === data.user?.id ? f.toId : f.fromId));
              return peer && (
                <button key={f.id} className="wrc-friend-btn" onClick={() => action({ action: 'share', movieId: selected?.id || 1, userId: peer.id })}>
                  <div style={{ flex: 'none', display: 'flex' }}><Avatar name={peer.username} src={peer.avatar} size={36} /></div>
                  <span>{peer.username}</span>
                  <Send size={14} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function ChallengesPage({ data, go, action, auth }: { data: Data; go: (s: string) => void; action: (p: Record<string, unknown>, s?: string) => Promise<boolean>; auth: () => void; }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const currentMonth = new Date().getMonth() + 1;

  if (!data.user) return <Gate title="Испытания ждут" description="Войди, чтобы принять вызов и заработать XP за каждый челлендж." auth={auth} />;

  const filtered = data.challenges.filter((c: any) => c.month === selectedMonth);
  const totalCurrent = data.challenges.filter((c: any) => c.current).length;
  const completedCurrent = data.challenges.filter((c: any) => c.current && c.completed).length;
  const totalXP = data.challenges.filter((c: any) => c.completed).reduce((n: number, c: any) => n + c.xpReward, 0);

  return (
    <>
      <div className="page-heading">
        <div><span className="eyebrow">ИСПЫТАНИЯ КИНОВСЕЛЕННОЙ</span><h1>Челленджи <em>месяца.</em></h1><p>Каждый месяц — новые задания. Каждый вызов — новый опыт.</p></div>
        <div className="heading-count"><Flame size={19} />{completedCurrent}/{totalCurrent} в этом месяце</div>
      </div>

      <div className="challenge-overview">
        <div className="challenge-overview-card"><span className="challenge-ov-icon">🔥</span><div><b>{completedCurrent} / {totalCurrent}</b><small>выполнено в этом месяце</small></div></div>
        <div className="challenge-overview-card"><span className="challenge-ov-icon">⚡</span><div><b>{totalXP} XP</b><small>заработано за все челленджи</small></div></div>
        <div className="challenge-overview-card"><span className="challenge-ov-icon">🏆</span><div><b>{data.challenges.filter((c: any) => c.completed).length}</b><small>челленджей закрыто</small></div></div>
        <div className="challenge-overview-card"><span className="challenge-ov-icon">📅</span><div><b>{data.challenges.length}</b><small>доступно за весь год</small></div></div>
      </div>

      <div className="challenge-month-tabs">
        {months.map((m, i) => (
          <button key={i} className={`challenge-month-tab ${selectedMonth === i + 1 ? 'active' : ''} ${i + 1 === currentMonth ? 'current' : ''}`} onClick={() => setSelectedMonth(i + 1)}>
            <span className="month-num">{String(i + 1).padStart(2, '0')}</span>{m}{i + 1 === currentMonth && <span className="month-now">сейчас</span>}
          </button>
        ))}
      </div>

      <div className="challenge-grid">
        {filtered.length ? filtered.map((c: any) => {
          const pct = c.target ? Math.min(100, Math.round(c.progress / c.target * 100)) : 0;
          return (
            <div className={`challenge-card ${c.completed ? 'challenge-done' : ''} ${c.current ? 'challenge-active' : ''}`} key={c.id}>
              <div className="challenge-card-top">
                <span className="challenge-card-icon">{c.icon}</span>
                <div className="challenge-card-reward"><Zap size={13} /> +{c.xpReward} XP</div>
              </div>
              <h3>{c.title}</h3><p>{c.description}</p>
              {(c.filterGenre || c.filterCategory) && (
                <div className="challenge-req-hint"><b>Смотреть:</b> {c.filterGenre ? `Жанр «${c.filterGenre}»` : ''}{c.filterGenre && c.filterCategory ? ' или ' : ''}{c.filterCategory ? `Категория «${c.filterCategory}»` : ''}</div>
              )}
              <div className="challenge-progress-section">
                <div className="challenge-progress-header"><span>{c.progress} / {c.target}</span><b>{pct}%</b></div>
                <div className="challenge-track"><i style={{ width: `${pct}%` }} /></div>
              </div>
              {c.completed ? (
                <div className="challenge-badge"><CheckCircle2 size={16} /> Выполнено!</div>
              ) : c.current ? (
                <div className="challenge-status-row">
                  <div className="challenge-status"><Flame size={14} /> Активный</div>
                  <button className="challenge-catalog-link" onClick={e => { e.stopPropagation(); go('/catalog?search=' + encodeURIComponent(c.filterGenre || c.filterCategory || '')); }}><Compass size={13} /> В каталог</button>
                </div>
              ) : (
                <div className="challenge-status muted"><CalendarDays size={14} /> {months[c.month - 1]}</div>
              )}
            </div>
          );
        }) : <div className="challenge-empty"><p>В {months[selectedMonth - 1].toLowerCase()} пока нет челленджей.</p></div>}
      </div>
    </>
  );
}
