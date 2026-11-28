'use client';

import CinemaRoulette from './cinema-roulette';
import CineDayBanner from './cine-day-banner';
import EveningDiscovery from './evening-discovery';
import type { CineDay } from '@/lib/cine-day';
import { HeaderLocation } from './city-cinema';
import ShowtimesPage from './showtimes-page';
import HeaderAccount from './header-account';
import { AppSidebar, SiteFooter, useSidebarLayout } from './shell-navigation';
import { DetailDescription, DetailTags, detailTitleStyle } from './material-detail-parts';
import MaterialPlayer from './material-player';
import { playbackSource } from '@/lib/playback-source';
import MaterialCover, {type CoverFilm} from './material-cover';
import {TrailerDialog} from './trailer-preview';
import {MaterialViewControls,useMaterialView} from './material-view';
import {materialTone,trailerSource,MAX_TRAILER_BYTES} from '@/lib/trailers';
/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/exhaustive-deps */
import { MobileNavigation, MobileMovieActions, MobileRatingSheet } from './mobile-experience';
import AmbientCanvas from './ambient-canvas';
import SiteSettings from './site-settings';
import { ExperienceHud, ProfileHud, ProfileLevel } from './cinema-hud';
import CinemaPassport from './cinema-passport';
import MemoryOrbit from './memory-orbit';
import { canAccessAdmin, canCreateMaterial } from '@/lib/permissions';
import { type MovieSuggestion } from '@/lib/movie-suggestions';
import { authErrorMessage } from '@/lib/auth-errors';
import { browserStorage, copyText } from '@/lib/browser-preferences';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useOptimistic, startTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Home, Clapperboard, Compass, Trophy, Gamepad2, Users, Bookmark, Shield, Search,
  Bell, ChevronDown, ChevronRight, ArrowUpRight, ArrowRight, Play,
  Plus, Star, Clock3, CalendarDays, Sparkles, Shuffle, Heart, MessageCircle,
  Send, Settings2, LogOut, X, Film, Flame, Eye, SlidersHorizontal, Check,
  Pencil, Trash2, Upload, Copy, Share2, Crown, Zap, Award, GripVertical,
  RotateCcw, ExternalLink, Volume2, Timer, Layers3, MonitorPlay, UserPlus,
  CheckCircle2, LockKeyhole, TrendingUp, BarChart3, BookOpen, GitBranch, Globe2,
  CircleHelp, Tv2, Link2, UsersRound
} from 'lucide-react';
import type { Film as FilmType } from '@/lib/data';
import WrappedExperience from './wrapped-experience';
import WrappedShare from './wrapped-share';
import type { WrappedData } from './wrapped-experience';
import {
  LEADERBOARD_LIMITS,
  LEADERBOARD_METRICS,
  getTopLeaders,
  getLeaderboardPodium,
  type LeaderboardLimit,
  type LeaderboardMetric,
} from '@/lib/leaderboard';
import BrandLogo from './brand-logo';
import { playerEmbedUrl } from '@/lib/player-url';
import { resolveSiteRoute } from '@/lib/site-routes';
import { catalogTokens, filterCatalog, parseCatalogOptions, catalogGenreCounts, type CatalogOptions } from '@/lib/catalog-filter';
import { CATALOG_MOODS, parseCatalogMood } from '@/lib/catalog-moods';
import { MagneticButton, ReviewDrawer, MovieContextBar, RatingCelebration, AchievementReveal } from './cinema-interactions';
import { useLiveUpdates } from './use-live-updates';
import { applyCollectionUpdate, type CollectionUpdate } from '@/lib/optimistic-collections';
import { achievementDefs, ACHIEVEMENT_TIERS } from '@/lib/achievements';
import type { AchievementProgress, AchievementId } from '@/lib/achievements';
import type { OwnershipStats } from '@/lib/ownership';
import OwnershipBadge from './ownership-badge';
import HeroStats from './hero-stats';
import SeriesPanel from './series-panel';
import { isSeries } from '@/lib/series';
import DailyGame from './daily-game';
import type { DailyGameQuestion } from '@/lib/daily-game';
import type { WeeklyLeader } from '@/lib/weekly-leaderboard';
import type { WeeklyPulse } from '@/lib/weekly-pulse';
import WeeklyCinemaPulse from './weekly-cinema-pulse';
import { formatFilmRating } from '@/lib/rating-display';
import TopMaterials from './top-materials';
import HomeTopFive from './home-top-five';
import CollectionShowcase from './collection-showcase';
import CatalogDiscovery, { CatalogActiveFilters } from './catalog-discovery';
import CollaborativeCollections from './collaborative-collections';
import CinemaCardStudio from './cinema-card-studio';
import HiddenTrophies from './hidden-trophies';
import UserTitleStudio, { UserTitleBadge } from './user-titles';
import { progressionTitle, type UserTitleCollection, type UserTitleDisplay } from '@/lib/user-titles';
import type { UnlockedHiddenAchievement } from '@/lib/hidden-achievement-types';
import { useJsonResource } from './use-json-resource';
import ShareCenter, { type ShareContent } from './share-modal';
const AdminWorkspace = React.lazy(() => import('./admin-workspace'));
const WorldCinema = React.lazy(() => import('./world-cinema'));
const CinemaPetStudio = React.lazy(() => import('./cinema-pet-studio'));
const PublicCinemaPet = React.lazy(() => import('./cinema-pet-studio').then(module => ({ default: module.PublicCinemaPet })));

// --- Types ---
type User = {
  displayTitle?: UserTitleDisplay | null;
  id: number; email: string; username: string; role: string; isEditor: boolean; bio: string | null; avatar: string | null;
  theme: string | null; language: string | null; headerStyle: number | null; headerImage: string | null;
  avatarFrame: string | null; headerFrame: string | null; profileEffect: string | null; nameEffect: string | null;
  nameColor: string | null; tileOrder: string | null; xp: number | null; createdAt: string;
};
type Watch = { id: number; movieId: number; watchedAt: string; };
type Rating = { id: number; movieId: number; value: number; };
type Comment = {
  id: number;
  movieId: number;
  parentId: number | null;
  body: string;
  likes: number | null;
  createdAt: string;

  // Дата редактирования комментария
  editedAt?: string | null;
  spoiler?: boolean;

  author: {
    displayTitle?: UserTitleDisplay | null;
    id: number;
    username: string;
    avatar: string | null;
    role: string;
  };
};
type Person = { displayTitle?: UserTitleDisplay | null; id: number; username: string; avatar: string | null; role: string; xp: number | null; };
type Friend = { id: number; fromId: number; toId: number; status: string; };
// [TYPE:MOVIE_SUGGESTION] Предложения пользователей

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
  friendship: { status: string | null; id: number | null; direction?: 'incoming' | 'outgoing' | null; };
  commonFilms?: number;
  isSelf: boolean;
  compatibility?: number;
};
type Data = {
  films: FilmType[];
  user: User | null;
  people: Person[];
  watches: Watch[];
  ratings: Rating[];
  comments: Comment[];

  suggestions: MovieSuggestion[];
  pendingSuggestionsCount: number;
  
  bookmarks: { movieId: number }[];

  // ❤️ Любимое
  favorites: { movieId: number }[];
  favoriteIds: number[];
  favoriteCounts: Record<number, number>;

  friends: Friend[];
  notifications: Notice[];
  scores: { game: string; score: number }[];

  leaderboard: Leader[];
  weeklyLeaders: WeeklyLeader[];
  weeklyPulse: WeeklyPulse | null;
  dailyGame: DailyGameQuestion | null;
  friendsActivity: FriendActivity[];
  unreadMessages: number;
  lists: any[];
  club: any;

  onThisDay: { text: string; icon: string }[];
  cineDay: CineDay | null;

  monthlySummary: {
    watches: number;
    minutes: number;
    topGenre: string;
    avgRating: string;
    achievements: number;
  } | null;

  titles?: UserTitleCollection | null;
  hiddenAchievements: UnlockedHiddenAchievement[];
  achievementProgress: Partial<AchievementProgress>;
  achievementStats: Partial<Record<AchievementId, OwnershipStats[]>>;
  challenges: any[];
  season: any;
};

// --- Constants & Helpers ---
const categories = ['Все', 'Фильм', 'Сериал', 'Мультфильм', 'Мультсериал', 'Аниме-сериал', 'Аниме-фильм'];
const genres = ['Все жанры', 'Фантастика', 'Драма', 'Приключения', 'Анимация', 'Боевик', 'Комедия', 'Аниме', 'Детектив', 'Фэнтези', 'Биография'];
const blank: Data = {
  films: [],
  user: null,
  people: [],
  watches: [],
  ratings: [],
  comments: [],
  bookmarks: [],
  
  suggestions: [],
  pendingSuggestionsCount: 0,

  // ❤️ Избранное
  favorites: [],
  favoriteIds: [],
  favoriteCounts: {},

  friends: [],
  notifications: [],
  scores: [],
  leaderboard: [],
  weeklyLeaders: [],
  weeklyPulse: null,
  dailyGame: null,
  friendsActivity: [],
  unreadMessages: 0,
  lists: [],
  club: null,
  onThisDay: [],
  cineDay: null,
  monthlySummary: null,
  hiddenAchievements: [],
  achievementProgress: {},
  achievementStats: {},
  challenges: [],
  season: null
};
const titleMinutes = (f: FilmType) => ['Сериал', 'Мультсериал', 'Аниме-сериал'].includes(f.category) ? f.duration * (f.episodes || 1) : f.duration;
const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(n);
function initials(s: string) { return s.slice(0, 2).toUpperCase(); }
function titleFor(user: User | null, watches: number) {
  if (!user) return 'Гость';
  return user.displayTitle?.name || progressionTitle(watches);
}

// --- WatchedIds global context ---
const WatchedIdsContext = createContext<Set<number>>(new Set<number>());
const useWatchedIds = () => useContext(WatchedIdsContext);

// --- FavoriteIds global context ---
type FavoriteContextValue = {
  ids: Set<number>;
  toggle: (movieId: number) => void;
  isAuthenticated: boolean;
};

const FavoriteIdsContext = createContext<FavoriteContextValue>({
  ids: new Set<number>(),
  toggle: () => {},
  isAuthenticated: false,
});

const useFavoriteIds = () => useContext(FavoriteIdsContext);

function Avatar({ name, src, size = 36, frame = 'none' }: { name: string; src?: string | null; size?: number; frame?: string | null; }) {
  return (
    <span className={`avatar avatar-${frame || 'none'}`} style={{ width: size, height: size, fontSize: size * 0.28 }}>
      {src ? <img src={src} alt={name} /> : initials(name)}
    </span>
  );
}

/**
 * PosterThumb — универсальная миниатюра.
 * ВАЖНО: галочка "просмотрено" выключена по умолчанию.
 * Если где-то она нужна — передай showBadge={true}.
 */
function PosterThumb({
  movieId,
  film,
  src,
  alt = '',
  wrapClassName,
  imgClassName,
  wrapStyle,
  showBadge = false, // <-- по умолчанию НЕ показываем галочку
}: {
  movieId?: number | null;
  film?: CoverFilm;
  src?: string | null;
  alt?: string;
  wrapClassName?: string;
  imgClassName?: string;
  wrapStyle?: React.CSSProperties;
  showBadge?: boolean; // <-- новый проп
}) {
  // оптимизация: вообще не трогаем watchedIds, если бейдж не нужен
  const watchedIds = useWatchedIds();
  const watched = showBadge && typeof movieId === 'number' && watchedIds.has(movieId);

  return (
    <MaterialCover
      film={film || {poster: src}}
      alt={alt}
      className={`poster-thumb ${wrapClassName || ''} ${imgClassName || ''}`}
      style={wrapStyle}
      badges={false}
      preview={false}
    >
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
    </MaterialCover>
  );
}


type SeasonMode =
  | 'auto'
  | 'off'
  | 'winter'
  | 'spring'
  | 'summer'
  | 'autumn';

function getCalendarSeason(): Exclude<SeasonMode, 'auto' | 'off'> {
  const month = new Date().getMonth() + 1;

  if (month === 12 || month <= 2) return 'winter';
  if (month <= 5) return 'spring';
  if (month <= 8) return 'summer';

  return 'autumn';
}

// --- Main Shell Component ---
export default function MovieGoApp({ initialFilms }: { initialFilms: FilmType[] }) {
  const router = useRouter(), path = usePathname(), searchParams = useSearchParams();
  const [serverData, setData] = useState<Data>({ ...blank, films: initialFilms });
  const [data, addOptimistic] = useOptimistic(serverData, applyCollectionUpdate<Data>);
  const sidebar = useSidebarLayout();
  const pendingActions = useRef(new Set<string>());
  const refreshVersion = useRef(0);
  const [loading, setLoading] = useState(true);
  const [hudPending, setHudPending] = useState(0);
  const [theme, setTheme] = useState('dark');
  const [lang, setLang] = useState('ru');
  const [preferencesReady, setPreferencesReady] = useState(false);
  
  // Сезонное оформление
  const [seasonMode, setSeasonMode] = useState('auto');
  const [seasonAnimations, setSeasonAnimations] = useState(true);
  const [seasonGlow, setSeasonGlow] = useState(true);
  const [seasonReady, setSeasonReady] = useState(false);
  const [search, setSearch] = useState('');
  const searchInput = useRef<HTMLInputElement>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);
  const [authOpen, setAuthOpen] = useState(false);
  const siteSettingsTrigger = useRef<HTMLButtonElement>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [roulette, setRoulette] = useState(false);
  const [toast, setToast] = useState('');
  const [shareFilm, setShareFilm] = useState<FilmType | null>(null);
  const [shareContent, setShareContent] = useState<ShareContent | null>(null);
  const [editFilm, setEditFilm] = useState<FilmType | null | undefined>(undefined);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [reviewSuggestion, setReviewSuggestion] = useState<MovieSuggestion | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPeerId, setChatPeerId] = useState<number | null>(null);


  const openMovieShare = (film: FilmType) => {
  setShareContent({
    type: 'movie',
    title: film.title,
    description: film.description,
    subtitle: `${film.year} · ${film.category} · ★ ${formatFilmRating(film)}`,
    url: `/movie/${film.id}`,
    image: film.poster,
  });
};

  // оптимизация: один стабильный Set для watched
  const watchedIds = useMemo(() => new Set<number>(data.watches.map(w => w.movieId)), [data.watches]);

  const favoriteIds = useMemo(
  () => new Set<number>(data.favoriteIds || []),
  [data.favoriteIds]
  );

  const notify = (s: string) => { setToast(s); setTimeout(() => setToast(''), 3700); };

  const refresh = async () => {
    if (pendingActions.current.size) return;
    const version = ++refreshVersion.current;
    setHudPending(count => count + 1);
    try {
      const r = await fetch('/api/data', { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        if (version !== refreshVersion.current || pendingActions.current.size) return;
        setData(d);
        if (d.user) {
          setTheme(browserStorage.getItem('mg_theme') || d.user.theme || 'dark');
          setLang(browserStorage.getItem('mg_lang') || d.user.language || 'ru');
        }
      }
    } catch {
      notify('Не удалось обновить данные');
    } finally {
      setHudPending(count => Math.max(0, count - 1));
      setLoading(false);
    }
  };

  const refreshLive = async (channels: string[]) => {
    if (loading || channels.some(channel => channel !== 'pulse')) { await refresh(); return; }
    if (pendingActions.current.size) return;
    const version = refreshVersion.current;
    try {
      const response = await fetch('/api/pulse', { cache: 'no-store' });
      if (!response.ok) return;
      const snapshot = await response.json();
      if (version === refreshVersion.current && !pendingActions.current.size && Array.isArray(snapshot.films)) {
        setData(current => ({ ...current, films: snapshot.films, weeklyLeaders: snapshot.weeklyLeaders, weeklyPulse: snapshot.weeklyPulse ?? current.weeklyPulse }));
      }
    } catch { /* Keep the last valid public snapshot; reconnect/fallback will resync. */ }
  };
  const liveStatus = useLiveUpdates(data.user?.id, refreshLive);

  useEffect(() => {
    // Initial network synchronization; refresh updates state after the response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, []);

  useEffect(() => {
    if (searchParams.get('suggestions') === 'mine' && data.user?.id) {
      // A moderation notification explicitly opens the author's proposal history.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestOpen(true);
    }
  }, [searchParams, data.user?.id]);

  useEffect(() => {
    if (searchParams.get('auth')) {
      // OAuth redirects are external events; synchronize the dialog once after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAuthOpen(true);
      notify(authErrorMessage(searchParams.get('auth')));
    }
  }, [searchParams]);

  useEffect(() => {
    // Browser-only preferences must be read after hydration, before persistence effects run.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(browserStorage.getItem('mg_theme') || 'dark');
    setLang(browserStorage.getItem('mg_lang') || 'ru');
    setPreferencesReady(true);
  }, []);
  useEffect(() => { if (preferencesReady) { document.documentElement.dataset.theme = theme; browserStorage.setItem('mg_theme', theme); } }, [theme, preferencesReady]);
  useEffect(() => { if (preferencesReady) { browserStorage.setItem('mg_lang', lang); document.documentElement.lang = lang; } }, [lang, preferencesReady]);

  // Загружаем сезонные настройки из браузера
useEffect(() => {
  const savedMode = browserStorage.getItem('mg_season_mode');

  const allowedModes = [
    'auto',
    'off',
    'winter',
    'spring',
    'summer',
    'autumn',
  ];

  if (savedMode && allowedModes.includes(savedMode)) {
    // Restore browser-only seasonal preferences after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeasonMode(savedMode);
  }

  setSeasonAnimations(
    browserStorage.getItem('mg_season_animations') !== 'false'
  );

  setSeasonGlow(
    browserStorage.getItem('mg_season_glow') !== 'false'
  );

  setSeasonReady(true);
}, []);

// Применяем сезонное оформление
useEffect(() => {
  if (!seasonReady) return;

  const root = document.documentElement;

  const activeSeason =
    seasonMode === 'auto'
      ? getCalendarSeason()
      : seasonMode;

  root.dataset.season = activeSeason;

  root.dataset.seasonAnimations =
    seasonAnimations ? 'on' : 'off';

  root.dataset.seasonGlow =
    seasonGlow ? 'on' : 'off';

  browserStorage.setItem('mg_season_mode', seasonMode);

  browserStorage.setItem(
    'mg_season_animations',
    String(seasonAnimations)
  );

  browserStorage.setItem(
    'mg_season_glow',
    String(seasonGlow)
  );
}, [seasonMode, seasonAnimations, seasonGlow, seasonReady]);

  
  const go = (url: string) => {
    router.push(url);
    setNoticeOpen(false);
    setProfileOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const action = (payload: Record<string, unknown>, success?: string): Promise<boolean> => {
    const name = String(payload.action), movieId = Number(payload.movieId);
    const kind = name === 'unwatch' ? 'watch' : name === 'unfavorite' ? 'favorite' : name;
    const optimistic = data.user && Number.isSafeInteger(movieId) && ['bookmark', 'favorite', 'watch', 'rate'].includes(kind);
    const key = optimistic ? `${kind}:${movieId}` : '';
    if (key && pendingActions.current.has(key)) return Promise.resolve(false);
    const update: CollectionUpdate | null = optimistic ? {
      movieId, kind: kind as CollectionUpdate['kind'],
      enabled: kind === 'bookmark' ? !data.bookmarks.some(b => b.movieId === movieId) : !['unwatch', 'unfavorite'].includes(name),
      value: Number(payload.value), watchedAt: new Date().toISOString(),
    } : null;
    if (key) { pendingActions.current.add(key); refreshVersion.current++; }
    setHudPending(count => count + 1);
    return new Promise(resolve => startTransition(async () => {
      if (update) addOptimistic(update);
      let ok = false;
      try {
        const r = await fetch('/api/action', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, ...(kind === 'bookmark' && update ? { saved: update.enabled } : {}), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
        });
        const d = await r.json();
        if (!r.ok) {
          if (r.status === 401) setAuthOpen(true);
          notify(d.error || 'Ошибка: изменение отменено');
        } else {
          ok = true;
          if (update) setData(current => applyCollectionUpdate(current, update));
          if (d.unlockedTrophies?.length) notify(d.unlockedTrophies.map((trophy: { icon: string; name: string }) => `${trophy.icon} Скрытый трофей: ${trophy.name}!`).join(' · '));
          else if (success) notify(success);
        }
      } catch { notify('Ошибка соединения: изменение отменено. Можно повторить.'); }
      finally {
        if (key) pendingActions.current.delete(key);
        if (ok) await refresh();
        setHudPending(count => Math.max(0, count - 1));
        resolve(ok);
      }
    }));
  };

  const requireAuth = (fn: () => void) => { if (!data.user) setAuthOpen(true); else fn(); };

  const toggleFavorite = (movieId: number) => {
    if (!data.user) {
      setAuthOpen(true);
      return;
    }
  
    const isFavorite = favoriteIds.has(movieId);
  
    action(
      {
        action: isFavorite ? 'unfavorite' : 'favorite',
        movieId,
      },
      isFavorite ? 'Удалено из любимого' : 'Добавлено в любимое'
    );
  };
  
  const changeTheme = async (t: string) => { setTheme(t); return data.user ? action({ action: 'profile', theme: t }) : true; };
  const changeLang = async (next: string) => { setLang(next); return data.user ? action({ action: 'profile', language: next }) : true; };
  const resetSiteSettings = async () => { setTheme('dark'); setLang('ru'); setSeasonMode('auto'); setSeasonAnimations(true); setSeasonGlow(true); return data.user ? action({ action: 'profile', theme: 'dark', language: 'ru' }) : true; };

  const en = lang === 'en';
  const words = {
    home: en ? 'Home' : 'Главная',
    catalog: en ? 'Catalog' : 'Каталог',
    leaderboard: en ? 'Leaderboard' : 'Рейтинг',
    achievements: en ? 'Achievements' : 'Достижения',
    games: en ? 'Mini games' : 'Мини-игры',
    friends: en ? 'Friends' : 'Друзья',
    watchlist: en ? 'Watch later' : 'Буду смотреть',
    profile: en ? 'My profile' : 'Мой профиль',
    admin: en ? 'Admin panel' : 'Админ-панель',
    search: en ? 'Find a film or series...' : 'Найти фильм или сериал...',
    login: en ? 'Sign in' : 'Войти'
  };

  const route = resolveSiteRoute(path || '/');
  const filmId = route?.page === 'movie' ? route.id || 0 : 0;
  const viewUserId = route?.page === 'viewuser' ? route.id || 0 : 0;
  const compareId = route?.page === 'compare' ? route.id || 0 : 0;
  const roomId = route?.roomId || '';
  const active = route?.page || 'not-found';
  const openChat = (peerId: number) => { setChatPeerId(peerId); setChatOpen(true); };

const nav = [
  { id: 'home', label: words.home, icon: Home, url: '/' },
  { id: 'catalog', label: words.catalog, icon: Compass, url: '/catalog' },
  { id: 'top', label: en ? 'Best titles' : 'Лучшие материалы', icon: Crown, url: '/top' },
  { id: 'watchlist', label: words.watchlist, icon: Bookmark, url: '/watchlist' },
  { id: 'favorites', label: en ? 'Favorites' : 'Любимое', icon: Heart, url: '/favorites' },
  { id: 'collab', label: en ? 'Lists' : 'Подборки', icon: Layers3, url: '/collab' },
  { id: 'world', label: en ? 'Cinema atlas' : 'Кино-карта мира', icon: Globe2, url: '/world' },

  { id: 'leaderboard', label: words.leaderboard, icon: BarChart3, url: '/leaderboard' },
  { id: 'achievements', label: words.achievements, icon: Trophy, url: '/achievements' },
  { id: 'challenges', label: en ? 'Challenges' : 'Челленджи', icon: Flame, url: '/challenges' },
  { id: 'games', label: words.games, icon: Gamepad2, url: '/games' },
  { id: 'watchroom', label: en ? 'Watch room' : 'Кинозал', icon: Tv2, url: '/watchroom' }
];

const startRoulette = () => setRoulette(true);
const sidebarGroups = [
  {
    label: en ? 'EXPLORE' : 'ИССЛЕДОВАТЬ',
    items: [
      nav[0], nav[1],
      { id: 'showtimes', label: en ? 'Cinema showtimes' : 'Афиша и сеансы', icon: Clapperboard, url: '/showtimes' },
      ...nav.slice(2, 7),
    ].map(item => ({
      ...item,
      count: item.id === 'watchlist' ? data.bookmarks.length
        : item.id === 'favorites' ? data.favoriteIds.length : undefined,
    })),
  },
  { label: en ? 'COMMUNITY' : 'СООБЩЕСТВО', items: nav.slice(7) },
  {
    label: en ? 'PERSONAL' : 'ЛИЧНОЕ',
    items: [
      { id: 'profile', label: words.profile, icon: Users, url: '/profile', requiresAuth: true },
      { id: 'friends', label: words.friends, icon: UserPlus, url: '/friends', requiresAuth: true },
      { id: 'chat', label: en ? 'Chat' : 'Чат', icon: MessageCircle, url: '/chat', requiresAuth: true, count: data.unreadMessages },
      ...(canAccessAdmin(data.user) ? [{ id: 'admin', label: words.admin, icon: Shield, url: '/admin' }] : []),
      ...(data.user?.role === 'admin' ? [{ id: 'about-admin', label: en ? 'About the project' : 'О проекте', icon: BookOpen, url: '/about-admin' }] : []),
    ],
  },
];

return (
  <WatchedIdsContext.Provider value={watchedIds}>
    <FavoriteIdsContext.Provider value={{ ids: favoriteIds, toggle: toggleFavorite, isAuthenticated: !!data.user,  }}>
      <div className={`app-shell shell-navigation cinema-design ${filmId ? 'has-cinema-atmosphere' : ''}`} data-sidebar={sidebar.layout} data-sidebar-compact={sidebar.compact} data-live={liveStatus} data-hud-busy={hudPending > 0 || loading}>
        <a className="skip-navigation" href="#main-content" onClick={event => {
          event.preventDefault();
          const main = document.getElementById('main-content');
          main?.focus({ preventScroll: true });
          main?.scrollIntoView({ block: 'start', behavior: 'instant' });
        }}>{en ? 'Skip to content' : 'Перейти к содержимому'}</a>
        {filmId > 0 && <AmbientCanvas poster={data.films.find(f => f.id === filmId)?.poster} backdrop={data.films.find(f => f.id === filmId)?.backdrop} />}
        <AppSidebar
          groups={sidebarGroups}
          active={active === 'room' ? 'watchroom' : active}
          signedIn={!!data.user}
          go={go}
          auth={() => setAuthOpen(true)}
          roulette={startRoulette}
          en={en}
          live={liveStatus === 'live'}
          layout={sidebar.layout}
          compact={sidebar.compact}
          onLayout={mode => {
            if (!sidebar.setLayout(mode)) notify(en
              ? 'Menu layout changed for this visit; browser storage is unavailable.'
              : 'Вид меню изменён на этот визит: браузер не разрешил запоминание.');
          }}
        />

        <div className="main-wrap">
          <HeaderLocation key={path} en={en} go={go}/>
          <header className="topbar">
            <div id="movie-context-slot" />

            <button type="button" className="mobile-brand" onClick={() => go('/')} aria-label="moviemovie — на главную">
              <BrandLogo sizes="96px" />
            </button>

            <div className="top-search" role="search" onFocus={() => setSearchFocused(true)} onBlur={e => {
              if (!e.currentTarget.contains(e.relatedTarget)) setSearchFocused(false);
            }}>
              <button type="button" className="search-focus-button" aria-label={en ? 'Focus search' : 'Начать поиск'} onClick={() => searchInput.current?.focus()}><Search size={20} /></button>
              <input
                ref={searchInput}
                type="search"
                aria-label={en ? 'Find a film or series' : 'Найти фильм или сериал'}
                aria-keyshortcuts="Meta+K Control+K"
                aria-controls={searchFocused && search.trim().length >= 2 ? 'header-search-results' : undefined}
                autoComplete="off"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') {
                    setSearchFocused(false);
                    e.currentTarget.blur();
                  }
                  if (e.key === 'Enter' && search.trim()) {
                    go('/catalog?search=' + encodeURIComponent(search.trim()));
                    setSearch('');
                  }
                }}
                placeholder={words.search}
              />
              <kbd>⌘ K</kbd>

              {search.trim() && (
                <button type="button" className="search-submit-button" aria-label={en ? 'Show search results' : 'Показать результаты поиска'} onClick={() => { go('/catalog?search=' + encodeURIComponent(search.trim())); setSearch(''); }}>
                  <ArrowRight size={17} />
                </button>
              )}

              {searchFocused && search.trim().length >= 2 && (
                <div id="header-search-results" className="hot-search-drop" onClick={e => e.stopPropagation()}>
                  {(() => {
                    const results = data.films
                      .filter(f => f.title.toLowerCase().includes(search.trim().toLowerCase()))
                      .slice(0, 5);

                    return results.length ? results.map(f => (
                      <button key={f.id} className="hot-search-item" onClick={() => { go('/movie/' + f.id); setSearch(''); }}>
                        <PosterThumb film={f} movieId={f.id} src={f.poster} alt={f.title} />
                        <div className="hot-item-info">
                          <b>{f.title}</b>
                          <small>{f.year} · {f.category}</small>
                        </div>
                        <span className="hot-item-rating">{formatFilmRating(f)}</span>
                      </button>
                    )) : <div className="hot-search-empty">Ничего не найдено</div>;
                  })()}

                  <button className="hot-search-all" onClick={() => { go('/catalog?search=' + encodeURIComponent(search.trim())); setSearch(''); }}>
                    Все результаты <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>

            <div className="top-actions">
              <button type="button" className="header-discover-button" aria-label={en?'Open cinema roulette':'Открыть кинорулетку'} title={en?'Choose a film for tonight':'Подобрать фильм на вечер'} onClick={startRoulette}><Shuffle size={17}/><span>{en?'Pick a film':'Выбрать фильм'}</span></button>
              {data.user && <ExperienceHud key={data.user.id} xp={serverData.user?.xp ?? null} go={go} en={en} />}
              <span className={`live-connection live-${liveStatus}`} role="status" title={liveStatus === 'live' ? 'Живые обновления подключены' : 'Восстанавливаем живые обновления; резервное обновление включено'}><i /><span>{liveStatus === 'live' ? 'Live' : 'Соединение…'}</span></span>
              <SiteSettings key={path} triggerRef={siteSettingsTrigger} onOpen={() => { setNoticeOpen(false); setProfileOpen(false); setSearchFocused(false); }} theme={theme} lang={lang} season={seasonMode} calendarSeason={getCalendarSeason()} animations={seasonAnimations} glow={seasonGlow} signedIn={!!data.user} onTheme={changeTheme} onLang={changeLang} onSeason={setSeasonMode} onAnimations={setSeasonAnimations} onGlow={setSeasonGlow} onReset={resetSiteSettings} onSync={async () => data.user ? action({ action: 'profile', theme, language: lang }) : true} onProfile={() => go('/profile')} />

              <HeaderAccount key={data.user?.id || 'guest'} user={data.user} notices={data.notifications}
                open={noticeOpen ? 'notifications' : profileOpen ? 'account' : null}
                onOpen={panel => { setNoticeOpen(panel === 'notifications'); setProfileOpen(panel === 'account'); setSearchFocused(false); }}
                go={go} action={action} auth={() => setAuthOpen(true)} en={en}
                settings={() => { setProfileOpen(false); setNoticeOpen(false); requestAnimationFrame(() => siteSettingsTrigger.current?.click()); }}
                counts={{ watchlist: data.bookmarks.length, favorites: data.favoriteIds.length }}
                triggerAvatar={<Avatar name={data.user?.username || 'G'} src={data.user?.avatar} size={34} frame={data.user?.avatarFrame} />}
                portrait={<Avatar name={data.user?.username || 'G'} src={data.user?.avatar} size={52} frame={data.user?.avatarFrame} />}
                logout={async () => {
                  if (pendingActions.current.size) throw new Error('Pending collection changes');
                  const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
                  if (!response.ok) throw new Error('Logout failed');
                  refreshVersion.current++;
                  setData({ ...blank, films: serverData.films });
                  setNoticeOpen(false); setProfileOpen(false);
                  go('/');
                  await refresh();
                }}
              />
            </div>
          </header>

          <main className="content" id="main-content" tabIndex={-1} key={path}>
            {active === 'home' ? <HomePage films={data.films} data={data} go={url => { if (url.startsWith('/catalog?genre=')) setSearch(''); go(url); }} roulette={startRoulette} auth={() => setAuthOpen(true)} en={en} action={action} />
              : active === 'catalog' ? (<Catalog key={`${searchParams.toString()}:${search}`} films={data.films} go={go} searchValue={search} en={en} canAdd={canCreateMaterial(data.user)} onAdd={() => setEditFilm(null)} onSuggest={() => data.user ? setSuggestOpen(true) : setAuthOpen(true)} watchedIds={watchedIds} />)
              : active === 'showtimes' ? <ShowtimesPage en={en} />
              : active === 'world' ? <React.Suspense fallback={<p role="status">Загружаем карту мира…</p>}><WorldCinema key={`${searchParams.get('mode')}:${searchParams.get('country')}:${data.user?.id || 'guest'}`} initialMode={searchParams.get('mode') || ''} initialCountry={searchParams.get('country') || ''} films={data.films} watchedIds={watchedIds} signedIn={!!data.user} go={go} auth={() => setAuthOpen(true)} en={en} /></React.Suspense>
              : active === 'top' ? <TopMaterials films={data.films} go={go} en={en} watchedIds={watchedIds} signedIn={!!data.user} />
              : active === 'movie' ? ( <MovieDetail film={data.films.find(f => f.id === filmId)} data={data} go={go} action={action} requireAuth={requireAuth} share={setShareFilm} onSocialShare={openMovieShare} edit={setEditFilm} onSeriesUpdated={refresh} />)
              : active === 'profile' ? <Profile key={data.user?.id || 'guest'} data={data} go={go} action={action} notify={notify} auth={() => setAuthOpen(true)} />
              : active === 'watchlist' ? <Watchlist data={data} go={go} auth={() => setAuthOpen(true)} />
              : active === 'favorites' ? <FavoritesPage data={data} go={go} auth={() => setAuthOpen(true)} />
              : active === 'leaderboard' ? <Leaderboard data={data} go={go} />
              : active === 'achievements' ? <Achievements data={data} auth={() => setAuthOpen(true)} go={go} />
              : active === 'challenges' ? <ChallengesPage data={data} go={go} action={action} auth={() => setAuthOpen(true)} />
              : active === 'games' ? <Games films={data.films} action={action} user={data.user} auth={() => setAuthOpen(true)} />
              : active === 'friends' ? <Friends data={data} action={action} auth={() => setAuthOpen(true)} go={go} openChat={openChat} />
              : active === 'viewuser' ? <ViewUserProfile key={`${viewUserId}:${data.user?.id ?? 'guest'}`} userId={viewUserId} data={data} go={go} action={action} openChat={openChat} auth={() => setAuthOpen(true)} />
              : active === 'compare' ? <ComparePage key={compareId} data={data} compareId={compareId} go={go} auth={() => setAuthOpen(true)} />
              : active === 'wrapped' ? <WrappedPage data={data} go={go} auth={() => setAuthOpen(true)} />
              : active === 'collab' ? <CollectionShowcase films={data.films} go={go} watchedIds={watchedIds} signedIn={!!data.user} personal={<CollabLists data={data} go={go} action={action} auth={() => setAuthOpen(true)} />} />
              : active === 'watchroom' ? <WatchRoomLobby data={data} go={go} action={action} auth={() => setAuthOpen(true)} />
              : active === 'room' ? <WatchRoom roomId={roomId} data={data} go={go} action={action} auth={() => setAuthOpen(true)} />
              : active === 'chat' ? <ChatPage data={data} go={go} openChat={openChat} auth={() => setAuthOpen(true)} />
              : active === 'admin' ? <React.Suspense fallback={<p role="status">Загружаем центр управления…</p>}><AdminWorkspace data={data} go={go} action={action} edit={setEditFilm} review={setReviewSuggestion} refresh={refresh} /></React.Suspense>
              : active === 'about-admin' ? <AboutAdmin data={data} go={go} />
              : <div className="empty-state"><h1>Страница не найдена</h1><button className="primary-btn" onClick={() => go('/')}>На главную</button></div>
            }
          </main>

          <SiteFooter go={go} en={en} onTop={() => {
            document.getElementById('main-content')?.focus({ preventScroll: true });
            window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
          }} />
        </div>

        <MobileNavigation key={path} page={active} go={go} auth={() => setAuthOpen(true)} signedIn={!!data.user} en={en} destinations={[
          { id: 'showtimes', label: en ? 'Cinema showtimes' : 'Афиша и сеансы', url: '/showtimes', icon: Clapperboard },
          ...nav.map(item => ({ ...item, count: item.id === 'watchlist' ? data.bookmarks.length : undefined })),
          { id: 'profile', label: words.profile, url: '/profile', icon: Users, requiresAuth: true },
          { id: 'friends', label: en ? 'Friends' : 'Друзья', url: '/friends', icon: UserPlus, requiresAuth: true },
          { id: 'chat', label: en ? 'Chat' : 'Чат', url: '/chat', icon: MessageCircle, requiresAuth: true, count: data.unreadMessages },
          { id: 'wrapped', label: en ? 'My cinema year' : 'Мой киногод', url: '/wrapped', icon: CalendarDays, requiresAuth: true },
          ...(canAccessAdmin(data.user) ? [{ id: 'admin', label: 'Центр управления', url: '/admin', icon: Shield }] : []),
          ...(data.user?.role === 'admin' ? [{ id: 'about-admin', label: 'О проекте', url: '/about-admin', icon: BookOpen }] : []),
        ]} />
        {authOpen && <AuthModal close={() => setAuthOpen(false)} refresh={refresh} notify={notify} />}

{roulette && <CinemaRoulette films={data.films} watchedIds={watchedIds} savedIds={new Set(data.bookmarks.map(item => item.movieId))} signedIn={!!data.user} en={en} close={() => setRoulette(false)} open={id => {setRoulette(false);go('/movie/' + id);}} auth={() => {setRoulette(false);setAuthOpen(true);}} bookmark={id => action({action: 'bookmark', movieId: id}, 'Добавлено в желаемое')}/>}

{shareContent && (
  <ShareCenter
    content={shareContent}
    onClose={() => setShareContent(null)}
  />
)}
        
       {shareFilm && ( 
          <div className="modal-backdrop" onClick={() => setShareFilm(null)}>
            <div className="glass-modal share-modal" onClick={e => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShareFilm(null)}><X size={20} /></button>
              <span className="eyebrow">ПОДЕЛИТЬСЯ ВПЕЧАТЛЕНИЕМ</span>
              <h2>Расскажи друзьям</h2>
              <p>«{shareFilm.title}» стоит увидеть.</p>
              <button className="share-copy" onClick={async () => { notify(await copyText(window.location.origin + '/movie/' + shareFilm.id) ? 'Ссылка скопирована' : 'Не удалось скопировать ссылку'); }}>
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

        {suggestOpen && <MovieForm film={null} mode="suggest" suggestions={data.suggestions.filter(s => s.userId === data.user?.id)} close={() => setSuggestOpen(false)} action={action} notify={notify} onSaved={async () => {}} />}
        {reviewSuggestion && <MovieForm film={null} suggestion={reviewSuggestion} close={() => setReviewSuggestion(null)} action={action} notify={notify} onSaved={async id => { await refresh(); go(`/movie/${id}`); router.refresh(); }} />}
        {editFilm !== undefined && <MovieForm film={editFilm} close={() => setEditFilm(undefined)} action={action} notify={notify} onSaved={async id => { await refresh(); go(`/movie/${id}`); router.refresh(); }} />}
{chatOpen && chatPeerId && data.user && (
  <ChatDrawer
    peerId={chatPeerId}
    data={data}
    go={go}
    close={() => {
      setChatOpen(false);
      setChatPeerId(null);
    }}
    notify={notify}
  />
)}

{/* Сезонные атмосферные эффекты */}
{seasonReady && (
  <SeasonParticles
    season={seasonMode}
    enabled={seasonAnimations}
  />
)}

{toast && (
  <div className="toast" role="status" aria-live="polite">
    <Sparkles size={16} />
    <span>{toast}</span>
    <button onClick={() => setToast('')}>
      <X size={14} />
    </button>
  </div>
)}

{loading && <div className="loading-line" />}
      </div>
    </FavoriteIdsContext.Provider>
    </WatchedIdsContext.Provider>
  );
}


// ==========================================
// moviemovie — SEASON PARTICLES
// ==========================================

function SeasonParticles({
  season,
  enabled,
}: {
  season: string;
  enabled: boolean;
}) {
  if (!enabled || season === 'off') return null;

  const activeSeason =
    season === 'auto'
      ? getCalendarSeason()
      : season;

  const symbols: Record<string, string[]> = {
    winter: ['❄', '❅', '❆'],
    spring: ['🌸', '🌺', '✿'],
    summer: ['✦', '✧', '•'],
    autumn: ['🍂', '🍁', '🍃'],
  };

  const particles = symbols[activeSeason];

  if (!particles) return null;

  return (
    <div
      className={`season-particles season-particles-${activeSeason}`}
      aria-hidden="true"
    >
      {Array.from({ length: 16 }, (_, i) => (
        <span
          key={i}
          className="season-particle"
          style={{
            left: `${(i * 37 + 9) % 100}%`,
            animationDelay: `-${(i * 1.7) % 18}s`,
            animationDuration: `${12 + (i % 6) * 2}s`,
            fontSize: `${12 + (i % 4) * 5}px`,
            opacity: 0.25 + (i % 4) * 0.1,
          }}
        >
          {particles[i % particles.length]}
        </span>
      ))}
    </div>
  );
}



// --- Helper Components ---

function InfoInlineLinks({
  value,
  param = 'search',
  go,
}: {
  value?: string | null;
  param?: string;
  go: (url: string) => void;
}) {
  const items = (value || 'Неизвестно')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  return (
    <span className="info-inline-links">
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <span className="info-inline-separator">, </span>
          )}

          <button
            type="button"
            className="info-inline-link"
            onClick={() =>
              go(`/catalog?${param}=${encodeURIComponent(item)}`)
            }
          >
            {item}
          </button>
        </React.Fragment>
      ))}
    </span>
  );
}

function SectionTitle({ kicker, title, link, onClick }: { kicker?: string; title: string; link?: string; onClick?: () => void; }) {
  return (
    <div className="section-heading">
      <div>{kicker && <div className="eyebrow">{kicker.split(/(moviemovie)/g).map((part, index) => part === 'moviemovie' ? <span className="brand-name" key={index}>{part}</span> : part)}</div>}<h2>{title}</h2></div>
      {link && <button className="text-link" onClick={onClick}>{link} <ArrowUpRight size={17} /></button>}
    </div>
  );
}

function FilmCard({ film, go, rank, watched, clean = false }: { film: FilmType; go: (url: string) => void; rank?: number; watched?: boolean; clean?: boolean; }) {
  const primaryGenre = film.genre.split(',')[0]?.trim();

  // если watched не передан — берем из глобального контекста
  const watchedIds = useWatchedIds();
  const isWatched = watched ?? watchedIds.has(film.id);

  const { ids: favoriteIds, toggle: toggleFavorite } = useFavoriteIds();
  const isFavorite = favoriteIds.has(film.id);

  return (
    <div
      className={`film-card tone-${materialTone(film)}`}
      role="button"
      tabIndex={0}
      onClick={() => go('/movie/' + film.id)}
      onKeyDown={e => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go('/movie/' + film.id);
        }
      }}
    >
      <MaterialCover film={film} className="poster-wrap" alt={film.title}>
        <span className="card-shade" />
        {rank && <span className="rank-num">{String(rank).padStart(2, '0')}</span>}
        {!clean && isWatched && <span className="card-watched-badge"><CheckCircle2 size={14} /></span>}
        {!clean && <button
          type="button"
          className={`card-favorite-btn ${isFavorite ? 'is-favorite' : ''}`}
          aria-pressed={isFavorite}
          title={isFavorite ? 'Убрать из любимого' : 'Добавить в любимое'}
          aria-label={isFavorite ? 'Убрать из любимого' : 'Добавить в любимое'}
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(film.id);
          }}
        >
          <Heart
            size={16}
            fill={isFavorite ? 'currentColor' : 'none'}
          />
        </button>}
      </MaterialCover>
      <div className="card-info">
        <h3>{film.title}</h3>
        <p>
          {film.year} <span>·</span> {film.category} <span>·</span>{' '}
          {['Сериал', 'Мультсериал', 'Аниме-сериал'].includes(film.category) && film.episodes
            ? `${film.episodes} сер.`
            : `${film.duration} мин`}
        </p>
        <p className="card-list-description">{film.description}</p>
        {!clean && <div className="card-tags">
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
        </div>}
      </div>
    </div>
  );
}

function FilmGrid({ films, go, watchedIds, clean = false, selectable = false }: { films: FilmType[]; go: (url: string) => void; watchedIds?: Set<number>; clean?: boolean; selectable?: boolean; }) {
  const [view] = useMaterialView();
  return (
    <div className={`film-grid material-view-${selectable ? view : 'cards'}`}>
      {films.map(f => <FilmCard key={f.id} film={f} go={go} clean={clean} watched={watchedIds?.has(f.id)} />)}
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

function HomePage({ films, data, go, roulette, auth, en, action }: { films: FilmType[]; data: Data; go: (s: string) => void; roulette: () => void; auth: () => void; en: boolean; action: (payload: Record<string, unknown>, success?: string) => Promise<boolean>; }) {
  const featured = useMemo(() => films.find(f => (f as any).featured) || films[0], [films]);

  const [capsuleMovie, setCapsuleMovie] = useState<{
  id: number;
  title: string;
  poster: string;
  date: string;
  rating?: number;
  genre: string;
  year: number;
} | null>(null);

const openTimeCapsule = () => {
  const available = data.watches.filter(w =>
    data.films.some(f => f.id === w.movieId)
  );

  if (!available.length) return;

  const rw = available[Math.floor(Math.random() * available.length)];
  const f = data.films.find(x => x.id === rw.movieId);

  if (!f) return;

const rating = data.ratings.find(x => x.movieId === f.id);

  setCapsuleMovie({
    id: f.id,
    title: f.title,
    poster: f.poster || '',
    date: new Date(rw.watchedAt).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }),
    rating: rating?.value,
    genre: f.genre,
    year: f.year
  });
};

  if (!featured) return <div className="home-stage">
    <section className="empty-state"><Sparkles size={32} /><h1>{en ? 'Every story starts somewhere.' : 'У каждой истории есть начало.'}</h1><p>{en ? 'The catalog is taking shape. New cinema discoveries will appear here.' : 'Каталог пока пуст. Здесь появятся новые истории и кинооткрытия.'}</p><button type="button" className="primary-btn" onClick={() => go('/catalog')}>{en ? 'Open catalog' : 'Открыть каталог'}<ArrowRight size={16}/></button></section>
    <EveningDiscovery films={films} go={go} en={en} />
  </div>;

  return (
    <>
      <div className="welcome-line home-welcome">
        <div>
          <span className="eyebrow"><span className="pulse-dot" /> {en ? 'CINEMA. PEOPLE. DISCOVERIES.' : 'КИНО. ЛЮДИ. ОТКРЫТИЯ.'}</span>
          <h1>{en ? 'Beyond the screen.' : 'За пределами кадра.'}<br /><em>{en ? 'Into your story.' : 'Ближе к твоей истории.'}</em></h1>
          <p>{data.user ? (en ? `Welcome back, ${data.user.username}. ` : `С возвращением, ${data.user.username}. `) : ''}{en ? 'Discover stories. Save what moves you. Share the feeling.' : 'Находи новое. Сохраняй любимое. Разделяй впечатления.'}</p>
        </div>
        <span className="date-pill"><CalendarDays size={15} />{new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>

      <div className="home-stage">
      <div className="hero" style={{ backgroundImage: `linear-gradient(90deg,rgba(8,10,15,.97) 0%,rgba(8,10,15,.81) 37%,rgba(8,10,15,.16) 83%),linear-gradient(0deg,rgba(8,10,15,.52),transparent 50%),url('${featured.backdrop || featured.poster}')` }}>
        <div className="hero-grain" />
        <div className="hero-content">
          <span className="hero-tag"><span className="pulse-dot" /> {en ? 'IN THE SPOTLIGHT' : 'В ЦЕНТРЕ ВНИМАНИЯ'} <span className="tag-line" /> moviemovie selection</span>
          <div className="hero-bottom">
            <div className="hero-topline"><span>{en ? 'THE NEXT CHAPTER OF YOUR STORY' : 'НОВЫЙ ЭПИЗОД ТВОЕЙ ИСТОРИИ'}</span><span>✦</span></div>
            <h2>{featured.title}</h2>
            <p>{featured.description}</p>
            <div className="hero-meta">
              <span><Star size={15} fill="currentColor" /> {formatFilmRating(featured)} <i>/ 10</i></span>
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
        <HeroStats
          films={films}
          peopleCount={data.people.length}
          watchesCount={data.user ? data.watches.length : null}
          en={en}
        />
      </div>

      <EveningDiscovery films={films} go={go} en={en} />
      </div>

      <CineDayBanner films={films} initialTag={data.cineDay?.filter} go={go} en={en}/>

      {data.challenges?.some(c => c.current) && (
        <div className="challenges-bar">
          <div className="challenges-header">
            <Flame size={18} /><h3>Челленджи месяца</h3>
            <button className="text-link" onClick={() => go('/challenges')}>Все челленджи <ArrowUpRight size={14} /></button>
          </div>
          <div className="challenges-row">
            {data.challenges
            .filter(c => c.current)
            .slice(0, 3)
            .map((c: any) => (
              <div className={`challenge-pill ${c.completed ? 'done' : ''}`} key={c.id}>
                <span>{c.icon}</span>
                <div><b>{c.title}</b><small>{c.progress}/{c.target}</small><div className="bar-track"><i style={{ width: `${Math.min(100, (c.progress / c.target) * 100)}%` }} /></div><OwnershipBadge stats={c.community} compact completed /></div>
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

      <HomeTopFive films={films} go={go} en={en} />

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
  <>
    <button
      type="button"
      className="time-capsule-banner"
      onClick={openTimeCapsule}
    >
      <RotateCcw size={20} />

      <div>
        <b>{en ? 'Time Capsule' : 'Капсула времени'}</b>
        <small>
          {en
            ? 'Rewind time and remember a random movie night'
            : 'Перемотай время и вспомни случайный сеанс'}
        </small>
      </div>

      <ArrowRight size={18} className="capsule-arrow" />
    </button>

    {capsuleMovie && (
      <div
        className="capsule-overlay"
        onClick={() => setCapsuleMovie(null)}
      >
        <div
          className="capsule-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Капсула времени"
          onClick={e => e.stopPropagation()}
        >
          <button
            type="button"
            className="capsule-close"
            onClick={() => setCapsuleMovie(null)}
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>

          <div className="capsule-header">
            <div className="capsule-icon">
              <RotateCcw size={26} />
            </div>

            <span className="capsule-kicker">
              {en ? 'YOUR CINEMA HISTORY' : 'ТВОЯ КИНОИСТОРИЯ'}
            </span>

            <h2>{en ? 'Time Capsule' : 'Капсула времени'}</h2>

            <p>
              {en
                ? 'Some stories are worth remembering.'
                : 'Некоторые истории хочется пережить снова.'}
            </p>
          </div>

          <div className="capsule-memory">
            <MaterialCover film={capsuleMovie} preview={false} badges={false} alt={capsuleMovie.title} className="capsule-poster" />

            <div className="capsule-memory-info">
              <span className="capsule-date">
                📅 {capsuleMovie.date}
              </span>

              <span className="capsule-label">
                {en ? 'On this day you watched' : 'В этот день ты посмотрел(а)'}
              </span>

              <h3>{capsuleMovie.title}</h3>

              <p>
                {capsuleMovie.genre} · {capsuleMovie.year}
              </p>

              {capsuleMovie.rating != null && (
                <div className="capsule-rating">
                  <Star size={16} fill="currentColor" />
                  {en ? 'Your rating' : 'Твоя оценка'}: {capsuleMovie.rating}/10
                </div>
              )}
            </div>
          </div>

          <div className="capsule-actions">
            <button
              type="button"
              className="capsule-primary"
              onClick={() => {
                const id = capsuleMovie.id;
                setCapsuleMovie(null);
                go('/movie/' + id);
              }}
            >
              {en ? 'Open movie' : 'Открыть фильм'}
              <ArrowRight size={16} />
            </button>

            <button
              type="button"
              className="capsule-secondary"
              onClick={openTimeCapsule}
            >
              <RotateCcw size={16} />
              {en ? 'Another memory' : 'Другое воспоминание'}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
)}

      <WeeklyCinemaPulse films={films} pulse={data.weeklyPulse} watches={data.watches} bookmarks={data.bookmarks} signedIn={!!data.user} action={action} auth={auth} go={go} en={en} />

      <section className="home-section">
        <SectionTitle kicker={en ? 'JUST ADDED' : 'ТОЛЬКО ЧТО В КОЛЛЕКЦИИ'} title={en ? 'Fresh discoveries' : 'Свежие находки'} link={en ? 'See all' : 'Смотреть всё'} onClick={() => go('/catalog?sort=new')} />
        <FilmGrid films={[...films].sort((a, b) => b.year - a.year).slice(0, 5)} go={go} clean />
      </section>

      <section className="home-section community-section">
        <SectionTitle kicker={en ? 'THE moviemovie COMMUNITY' : 'СООБЩЕСТВО moviemovie'} title={en ? 'Movies are better together' : 'Кино лучше вместе'} />
        <div className="community-cards">
          <article className="community-card" aria-labelledby="community-progress-title">
            <header className="community-card-heading">
              <span className="cc-icon" aria-hidden="true"><Trophy size={24} /></span>
              <h3 id="community-progress-title">{en ? 'Every watch moves you forward' : 'Каждый просмотр — шаг вперёд'}</h3>
              <p>{en ? 'Watch, level up and join the weekly leaders.' : 'Смотри кино, повышай уровень и попади в тройку лидеров.'}</p>
            </header>
            <div className="community-card-body"><WeeklyLeaders leaders={data.weeklyLeaders || []} go={go} en={en} currentUserId={data.user?.id} /></div>
            <footer className="community-card-footer"><button type="button" onClick={() => go('/leaderboard')}>{en ? 'Full leaderboard' : 'Вся таблица лидеров'} <ArrowRight size={16} /></button></footer>
          </article>
          <article className="community-card" aria-labelledby="community-games-title">
            <header className="community-card-heading">
              <span className="cc-icon pink-icon" aria-hidden="true"><Gamepad2 size={24} /></span>
              <h3 id="community-games-title">{en ? 'Play between screenings' : 'Играй между сеансами'}</h3>
              <p>{en ? 'Test your movie radar with a short daily warm-up.' : 'Проверь свой кинорадар в короткой ежедневной разминке.'}</p>
            </header>
            <div className="community-card-body">
              {data.dailyGame ? <DailyGame key={data.dailyGame.id} question={data.dailyGame} go={go} en={en} showMore={false} /> : <p className="community-unavailable">{en ? 'The daily question is not available yet. Explore the full mini-games section.' : 'Вопрос дня пока недоступен. Загляни в раздел мини-игр.'}</p>}
            </div>
            <footer className="community-card-footer"><button type="button" className="daily-game-more" onClick={() => go('/games')}>{en ? 'All mini-games' : 'Все мини-игры'} <ArrowRight size={16} /></button></footer>
          </article>
          <article className="community-card" aria-labelledby="community-discoveries-title">
            <header className="community-card-heading">
              <span className="cc-icon blue-icon" aria-hidden="true"><Users size={24} /></span>
              <h3 id="community-discoveries-title">{en ? 'Share discoveries' : 'Делись открытиями'}</h3>
              <p>{en ? 'Find friends, share recommendations and discuss your favorite stories.' : 'Находи друзей, отправляй рекомендации и обсуждай любимые истории.'}</p>
            </header>
            <div className="community-card-body community-discovery-links">
              <button type="button" className="community-shortcut" onClick={() => go('/collab')}>
                <Layers3 size={18} aria-hidden="true" /><span><b>{en ? 'Community collections' : 'Подборки сообщества'}</b><small>{en ? 'Find a story for your next movie night' : 'Найди историю для следующего вечера'}</small></span><ArrowUpRight size={15} aria-hidden="true" />
              </button>
              <button type="button" className="community-shortcut" onClick={() => go('/catalog')}>
                <MessageCircle size={18} aria-hidden="true" /><span><b>{en ? 'Talk about a film' : 'Обсудить фильм'}</b><small>{en ? 'Choose a title and leave your thoughts' : 'Выбери фильм и поделись впечатлением'}</small></span><ArrowUpRight size={15} aria-hidden="true" />
              </button>
            </div>
            <footer className="community-card-footer"><button type="button" onClick={() => data.user ? go('/friends') : auth()}>{en ? 'Find friends' : 'Найти друзей'} <ArrowRight size={16} /></button></footer>
          </article>
        </div>
      </section>
    </>
  );
}

function WeeklyLeaders({ leaders, go, en, currentUserId }: {
  leaders: WeeklyLeader[];
  go: (url: string) => void;
  en: boolean;
  currentUserId?: number;
}) {
  const plurals = new Intl.PluralRules(en ? 'en' : 'ru');
  const watchLabel = (count: number) => {
    const form = plurals.select(count);
    return en ? (form === 'one' ? 'view' : 'views')
      : form === 'one' ? 'просмотр' : form === 'few' ? 'просмотра' : 'просмотров';
  };
  return (
    <div className="weekly-preview">
      <div className="weekly-preview-heading">
        <b><Flame size={14} />{en ? 'Weekly leaders' : 'Лидеры недели'}</b>
        <small>{en ? 'Views in the last 7 days' : 'Просмотры за последние 7 дней'}</small>
      </div>
      {leaders.length ? <ol className="weekly-leaders" aria-label={en ? 'Top 3 viewers this week' : 'Топ-3 зрителей недели'}>
        {leaders.map((person, index) => <li key={person.id}>
          <a className={`weekly-leader ${person.id === currentUserId ? 'is-me' : ''}`} href={`/user/${person.id}`} onClick={event => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            go(`/user/${person.id}`);
          }}>
            <span className={`weekly-place weekly-place-${index + 1}`} aria-label={`${en ? 'Place' : 'Место'} ${index + 1}`}>{index === 0 ? <Crown size={15} /> : index + 1}</span>
            <Avatar name={person.username} src={person.avatar} size={34} />
            <span className="weekly-person"><strong title={person.username}>{person.username}</strong><small>{en ? 'Level' : 'Уровень'} {person.level}{person.id === currentUserId ? (en ? ' · You' : ' · Ты') : ''}</small></span>
            <span className="weekly-count"><b>{person.watches.toLocaleString(en ? 'en-US' : 'ru-RU')}</b><small>{watchLabel(person.watches)}</small></span>
          </a>
        </li>)}
      </ol> : <p className="weekly-empty">{en ? 'No views in the last 7 days. Watch a film and be the first!' : 'За последние 7 дней пока нет просмотров. Посмотри фильм — стань первым!'}</p>}
    </div>
  );
}

function Catalog({
  films,
  go,
  searchValue,
  en,
  canAdd = false,
  onAdd,
  onSuggest,
  watchedIds = new Set(),
}: {
  films: FilmType[];
  go: (s: string) => void;
  searchValue: string;
  en: boolean;
  canAdd?: boolean;
  onAdd?: () => void;
  onSuggest?: () => void;
  watchedIds?: Set<number>;
}) {
  const searchParams = useSearchParams();
  const [options, setOptions] = useState(() => parseCatalogOptions(searchParams, searchValue));
  const {query, category, genre, studio, year, sort, minRating, watchFilter, mood} = options;
  const defaults = parseCatalogOptions({get: () => null});
  const update = <K extends keyof CatalogOptions,>(key: K, value: CatalogOptions[K]) => setOptions(current => ({...current, [key]: value}));
  const reset = () => setOptions(defaults);
  const [filtersOpen, setFiltersOpen] = useState(() => ['genre', 'studio', 'year', 'minRating', 'watch', 'sort'].some(key => !!searchParams.get(key)));
  const preciseCount = Number(genre !== 'Все жанры') + Number(studio !== 'Все студии') + Number(year !== 'Любой год') + Number(minRating !== '0') + Number(watchFilter !== 'all');
  const catalogGenres = useMemo(() => [...new Set([...genres, ...films.flatMap(f => catalogTokens(f.genre)), genre])], [films, genre]);
  const catalogStudios = useMemo(() => [...new Set([...films.flatMap(f => catalogTokens(f.studio)), ...(studio !== 'Все студии' ? [studio] : [])])].sort(), [films, studio]);
  const filtered = useMemo(() => filterCatalog(films, { query, category, genre, studio, year, sort, minRating, watchFilter, mood }, watchedIds), [films, query, category, genre, studio, year, sort, minRating, watchFilter, watchedIds, mood]);

  const facets = useMemo(() => catalogGenreCounts(films, options, watchedIds), [films, options, watchedIds]);

  return (
    <>
      <div className="page-heading catalog-heading">
        <div>
          <span className="eyebrow">{en ? 'THE STORY LIBRARY' : 'БИБЛИОТЕКА ВПЕЧАТЛЕНИЙ'}</span>
          <h1>{en ? 'Explore the' : 'Исследуй'} <em>{en ? 'cinematic universe.' : 'киновселенную.'}</em></h1>
          <p>{en ? 'Your next favorite story is waiting right here.' : 'Твоё следующее любимое кино уже где-то здесь.'}</p>
        </div>
        <div className="heading-count"><Film size={19} />{films.length} {en ? 'stories' : 'историй'}</div>
{canAdd ? (
  onAdd && (
    <button className="primary-btn" onClick={onAdd}>
      <Plus size={17} />
      {en ? 'Add content' : 'Добавить материал'}
    </button>
  )
) : (
  onSuggest && (
    <button className="primary-btn" onClick={onSuggest}>
      <Clapperboard size={17} />
      {en ? 'Suggest a movie' : 'Предложить кино'}
    </button>
  )
)}
      </div>

      <button type="button" className="catalog-top-entry" onClick={() => go('/top')}><Crown size={18} /><span>{en ? 'Looking for the best? Explore the top 10, 50 and 100.' : 'Ищешь лучшее? Открой топ-10, 50 и 100 материалов.'}</span><ArrowRight size={16} /></button>

      <div className="catalog-search">
        <Search size={20} />
        <input aria-label={en ? 'Search catalog' : 'Поиск в каталоге'} value={query} onChange={e => update('query', e.target.value)} placeholder={en ? 'Title, genre, director or keyword...' : 'Название, жанр, режиссёр или ключевое слово...'} />
        {query && <button type="button" aria-label={en ? 'Clear catalog search' : 'Очистить поиск в каталоге'} onClick={() => update('query', '')}><X size={17} /></button>}
        <span>{en ? 'Live search' : 'Поиск сразу'}</span>
      </div>

      <CatalogDiscovery genre={genre} category={category} counts={facets.counts} total={facets.total} en={en} onGenre={value => update('genre', value)} onCategory={value => update('category', value)} />

      <div className="catalog-mood-heading"><span className="eyebrow">{en ? 'WHAT IS YOUR MOOD?' : 'КАКОЕ СЕГОДНЯ НАСТРОЕНИЕ?'}</span><button type="button" className="outline-btn small catalog-all-filters" aria-label={en ? 'All filters' : 'Все фильтры'} aria-expanded={filtersOpen} aria-controls="catalog-precise-filters" onClick={() => setFiltersOpen(value => !value)}><SlidersHorizontal size={15} />{en ? 'All filters' : 'Все фильтры'}{preciseCount > 0 && ` · ${preciseCount}`}</button></div>
      <div className="catalog-moods" role="group" aria-label={en ? 'Choose a mood' : 'Выбери настроение'}>
        <button type="button" aria-pressed={mood === 'all'} onClick={() => update('mood', 'all')}>{en ? '✨ Any mood' : '✨ Любое настроение'}</button>
        {CATALOG_MOODS.map(item => <button key={item.id} type="button" aria-pressed={mood === item.id} onClick={() => update('mood', mood === item.id ? 'all' : item.id)}>{en ? item.en : item.label}</button>)}
      </div>
      <p className="catalog-mood-note">{en ? 'Based on editorial mood tags; genres are used when a tag is missing.' : 'По настроению, указанному редактором; если его нет — по жанрам. Без скрытых рекомендаций.'}</p>
      <div id="catalog-precise-filters" className="catalog-filter-panel" hidden={!filtersOpen}>
        <header><SlidersHorizontal size={18} /><div><h2>{en ? 'Fine-tune your selection' : 'Настроим точнее'}</h2><p>{en ? 'All conditions work together. Results update as you choose.' : 'Все условия работают вместе. Результат меняется сразу.'}</p></div></header>
        <div className="catalog-filter-fields">
          <label><span>{en ? 'Genre' : 'Жанр'}</span><select className="catalog-genre-filter" aria-label={en ? 'Genre' : 'Жанр'} value={genre} onChange={e => update('genre', e.target.value)}>
            {catalogGenres.map(g => <option key={g}>{g}</option>)}
          </select></label>
          <label><span>{en ? 'Studio' : 'Студия'}</span><select className="catalog-studio-filter" aria-label={en ? 'Studio' : 'Студия'} value={studio} onChange={e => update('studio', e.target.value)}>
            <option value="Все студии">{en ? 'All studios' : 'Все студии'}</option>{catalogStudios.map(st => <option key={st}>{st}</option>)}
          </select></label>
          <label><span>{en ? 'Year' : 'Год'}</span><select aria-label={en ? 'Year' : 'Год'} value={year} onChange={e => update('year', e.target.value)}>
            <option value="Любой год">{en ? 'Any year' : 'Любой год'}</option><option value="before1960">{en ? 'Before 1960' : 'До 1960 года'}</option>
            {[...new Set([...films.map(f => f.year), ...(/^\d{4}$/.test(year) ? [Number(year)] : [])])].sort((a,b) => b-a).map(y => <option key={y}>{y}</option>)}
          </select></label>
          <label><span>{en ? 'Minimum rating' : 'Минимальный рейтинг'}</span><select aria-label={en ? 'Minimum rating' : 'Минимальный рейтинг'} value={minRating} onChange={e => update('minRating', e.target.value)}>
            <option value="0">{en ? 'Any rating' : 'Любой рейтинг'}</option>{['7','8','9'].map(score => <option key={score} value={score}>{en ? 'From' : 'От'} {score}.0</option>)}
          </select></label>
          <label><span>{en ? 'Watch status' : 'Статус просмотра'}</span><select aria-label={en ? 'Watch status' : 'Статус просмотра'} value={watchFilter} onChange={e => update('watchFilter', e.target.value)}>
            <option value="all">{en ? 'All titles' : 'Все материалы'}</option><option value="watched">{en ? 'Watched' : '✓ Просмотренные'}</option><option value="unwatched">{en ? 'Unwatched' : '○ Непросмотренные'}</option>
          </select></label>
        </div>
      </div>

      <CatalogActiveFilters options={options} en={en} onRemove={key => update(key, defaults[key])} onReset={reset} />
      <MaterialViewControls en={en} />
      <div className="catalog-results-toolbar">
        <p className="catalog-result-summary" role="status" aria-live="polite">{en ? 'Found' : 'Найдено'}: <strong>{filtered.length}</strong><span>{en ? 'titles in your selection' : 'историй по твоему выбору'}</span></p>
        <label className="catalog-sort"><span>{en ? 'Sort order' : 'Сортировка'}</span><select aria-label={en ? 'Sort order' : 'Сортировка'} value={sort} onChange={e => update('sort', e.target.value)}>
          <option value="popular">{en ? 'Popular' : 'Популярные'}</option><option value="rating">{en ? 'By rating' : 'По рейтингу'}</option><option value="new">{en ? 'Newest first' : 'Сначала новые'}</option><option value="old">{en ? 'Oldest first' : 'Сначала старые'}</option>
        </select></label>
      </div>
      {filtered.length ? (
        <FilmGrid films={filtered} go={go} watchedIds={watchedIds} selectable />
      ) : (
        <div className="empty-state">
          <Search size={36} />
          <h3>{en ? 'Nothing found yet' : 'Пока ничего не найдено'}</h3>
          <p>{en ? 'Try another search or clear your filters.' : 'Попробуй другой запрос или сбрось фильтры.'}</p>
          <button type="button" className="outline-btn" onClick={reset}>{en ? 'Show the whole catalog' : 'Показать весь каталог'}</button>
        </div>
      )}
    </>
  );
}

function MovieDetail(props: Omit<React.ComponentProps<typeof MovieDetailContent>, 'film'> & { film?: FilmType }) {
  if (!props.film) return <div className="empty-state"><h2>История не найдена</h2><button className="primary-btn" onClick={() => props.go('/catalog')}>К каталогу</button></div>;
  return <MovieDetailContent {...props} film={props.film} key={props.film.id} />;
}

function MovieDetailContent({
  film,
  data,
  go,
  action,
  requireAuth: requestAuth,
  share,
  onSocialShare,
  edit,
  onSeriesUpdated
}: {
  film: FilmType;
  data: Data;
  go: (s: string) => void;
  action: (p: Record<string, unknown>, s?: string) => Promise<boolean>;
  requireAuth: (f: () => void) => void;
  share: (f: FilmType) => void;
  onSocialShare: (f: FilmType) => void;
  edit: (f: FilmType) => void;
  onSeriesUpdated: () => Promise<void>;
}) {
  const posterAnchor = useRef<HTMLDivElement>(null);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [mobileRatingOpen, setMobileRatingOpen] = useState(false);
  const closeMobileRating = React.useCallback(() => setMobileRatingOpen(false), []);
  const requireAuth = (callback: () => void) => { if (!data.user) { setReviewsOpen(false); setMobileRatingOpen(false); } requestAuth(callback); };
  const submittingComment = useRef(false);
  const [ratingBurst, setRatingBurst] = useState(0);
  const ratingInFlight = useRef(false);
  const [comment, setComment] = useState('');
  const [commentSpoiler, setCommentSpoiler] = useState(false);
  const [reply, setReply] = useState<number | null>(null);
  const [hover, setHover] = useState(0);

  useEffect(() => {
    if (film) fetch('/api/visit?movieId=' + film.id).catch(() => {});
  }, [film?.id]);


  const saved = useMemo(() => data.bookmarks.some(b => b.movieId === film.id), [data.bookmarks, film.id]);
  // ❤️ Состояние избранного
  const { ids: favoriteIds, toggle: toggleFavorite } = useFavoriteIds();
  const isFavorite = favoriteIds.has(film.id);
  const myRating = useMemo(() => data.ratings.find(r => r.movieId === film.id)?.value || 0, [data.ratings, film.id]);
  const isWatched = useMemo(() => data.watches.some(w => w.movieId === film.id), [data.watches, film.id]);

  const movieComments = useMemo(() => data.comments.filter(c => c.movieId === film.id), [data.comments, film.id]);
  const topComments = useMemo(() => movieComments.filter(c => !c.parentId), [movieComments]);

  const [trailerOpen,setTrailerOpen] = useState(false);
  const related = useMemo(() => {
    const genres = new Set(film.genre.split(',').map(x => x.trim()).filter(Boolean));
    return data.films
      .filter(f => f.id !== film.id && f.genre.split(',').some(g => genres.has(g.trim())))
      .slice(0, 5);
  }, [data.films, film.id, film.genre]);

  const rate = (value: number) => requireAuth(() => {
    if (ratingInFlight.current) return;
    ratingInFlight.current = true;
    void action({ action: 'rate', movieId: film.id, value }, 'Оценка сохранена').then(ok => {
      if (ok && value === 10 && myRating !== 10) setRatingBurst(sequence => sequence + 1);
    }).finally(() => { ratingInFlight.current = false; });
  });
  const submit = async () => {
    if (!comment.trim() || submittingComment.current) return;
    submittingComment.current = true;
    try {
      if (await action({ action: 'comment', movieId: film.id, text: comment, parentId: reply, spoiler: commentSpoiler }, 'Комментарий опубликован')) {
        setComment('');
        setCommentSpoiler(false);
        setReply(null);
      }
    } finally { submittingComment.current = false; }
  };

  return (
    <div className="movie-detail-page">
      {trailerOpen && film.trailerUrl && <TrailerDialog url={film.trailerUrl} title={film.title} close={()=>setTrailerOpen(false)} />}
      <MobileMovieActions title={film.title} rating={myRating} saved={saved} rate={() => setMobileRatingOpen(true)} reviews={() => setReviewsOpen(true)} bookmark={() => requireAuth(() => action({ action: 'bookmark', movieId: film.id }, saved ? 'Удалено из желаемого' : 'Добавлено в желаемое'))} />
      {mobileRatingOpen && <MobileRatingSheet rating={myRating} title={film.title} save={rate} close={closeMobileRating} />}
      <MovieContextBar anchor={posterAnchor} title={film.title} rating={formatFilmRating(film)} saved={saved} bookmark={() => requireAuth(() => action({ action: 'bookmark', movieId: film.id }, saved ? 'Удалено из желаемого' : 'Добавлено в желаемое'))} />
      <div className="movie-page-toolbar"><button className="back-link" onClick={() => go('/catalog')}>← Назад в каталог</button>
      </div>

      <div className={`detail-hero tone-${materialTone(film)}`} style={{ '--movie-backdrop': `url(${JSON.stringify(film.backdrop || film.poster)})`, backgroundImage: `linear-gradient(90deg,var(--bg) 1%,rgba(12,14,20,.95) 33%,rgba(12,14,20,.55) 70%),linear-gradient(0deg,var(--bg),transparent 60%),url('${film.backdrop || film.poster}')` } as React.CSSProperties}>
        {isSeries(film.category) && <div className="detail-hero-tools">{isSeries(film.category) && <SeriesPanel key={`${film.id}:${data.user?.id || 'guest'}`} title={film.title} movieId={film.id} userId={data.user?.id ?? null} auth={() => requireAuth(() => {})} onUpdated={onSeriesUpdated} />}</div>}
        <div className="detail-poster" ref={posterAnchor}>
          <MaterialCover film={film} preview={false} className="detail-series-cover" alt={film.title}/>
        </div>

        <div className="detail-intro">
          <div className="detail-badges"><span className="eyebrow">{film.category.toUpperCase()}</span><span>·</span><span>{film.year}</span><span>·</span><span>{film.country}</span></div>
          <h1 style={detailTitleStyle(film.title)}>{film.title}</h1>
          {film.originalTitle && film.originalTitle !== film.title && <p className="original-title">{film.originalTitle}</p>}

          <div className="detail-rating">
            <div className="detail-community-rating">
              <span className="big-rating"><Star size={22} fill="currentColor" />{formatFilmRating(film)}</span>
              <span className="rating-of">/ 10<br /><small>рейтинг сообщества</small></span>
            </div>
            <div className="detail-statistics">
              <span className="detail-views"><Eye size={17} /><span>{fmt(film.views || 0)} просмотров</span></span>
              <span className="detail-views" title="Сколько пользователей добавили материал в любимое">
                <Heart size={17} fill="#fb7185" color="#fb7185" />
                <span>{fmt(data.favoriteCounts?.[film.id] || 0)} в любимом</span>
              </span>
            </div>
          </div>

          <DetailDescription key={film.id} text={film.description || ''} />
          <DetailTags genre={film.genre || ''} studio={film.studio || ''} go={go} />

          <div className="detail-actions">
            {(film.playbackUrl || film.watchUrl) && <div className="detail-play-actions">
              <MaterialPlayer url={film.playbackUrl} title={film.title} />
              {film.watchUrl && <a className="watch-external" href={film.watchUrl} target="_blank" rel="noopener noreferrer"><MonitorPlay size={17} /> Где посмотреть ещё <ExternalLink size={15} /></a>}
            </div>}
            {trailerSource(film.trailerUrl) && <button className="outline-btn" onClick={()=>setTrailerOpen(true)}><Play size={16}/>Трейлер</button>}
<button
  className={`outline-btn detail-watch-toggle ${isWatched ? 'watched-done' : ''}`}
  onClick={() =>
    requireAuth(() =>
      action(
        {
          action: isWatched ? 'unwatch' : 'watch',
          movieId: film.id
        },
        isWatched ? 'Просмотр убран' : 'Просмотр добавлен'
      )
    )
  }
>
  <CheckCircle2 size={17} />
  {isWatched ? 'Просмотрено' : 'Я посмотрел'}
</button>

          </div>
          <div className="detail-library-actions" role="group" aria-label="Личная коллекция">
            <MagneticButton active={saved} kind="bookmark"
              className="outline-btn"
              onClick={() =>
                requireAuth(() =>
                  action(
                    { action: 'bookmark', movieId: film.id },
                    saved ? 'Удалено из желаемого' : 'Добавлено в желаемое'
                  )
                )
              }
            >
              <Bookmark size={17} fill={saved ? 'currentColor' : 'none'} />
              {saved ? 'В желаемом' : 'В желаемое'}
            </MagneticButton>

            <MagneticButton active={isFavorite} kind="heart"
              type="button"
              className={`outline-btn detail-favorite-btn ${isFavorite ? 'is-favorite' : ''}`}
              onClick={() => toggleFavorite(film.id)}
            >
              <Heart
                size={17}
                fill={isFavorite ? 'currentColor' : 'none'}
              />
              {isFavorite ? 'В любимом' : 'В любимое'}
            </MagneticButton>

            <button
              type="button"
              className="square-btn"
              onClick={() => onSocialShare(film)}
              title="Поделиться в соцсетях"
              aria-label="Поделиться в соцсетях"
            >
              <Share2 size={18} />
            </button>

          </div>

        </div>
        {['admin', 'moderator'].includes(data.user?.role || '') && <div className="detail-hero-footer">
            <button
              className="outline-btn manage-film"
              onClick={() => edit(film)}
            >
              <Pencil size={16} />
              Редактировать материал
            </button>
        </div>}
      </div>

        <section className="detail-facts" aria-label="Детали истории">
          <div className="info-panel-fancy">
            <div className="info-panel-header">
              <Sparkles size={18} />
              <h3>Детали истории</h3>
            </div>

            <div className="info-grid">

              {/* Режиссёр */}
              <div className="info-item">
                <span className="info-icon">
                  <Users size={15} />
                </span>
                <div>
                  <small>Режиссёр</small>
                  <InfoInlineLinks
                    value={film.director}
                    go={go}
                  />
                </div>
              </div>

              {film.franchise && <div className="info-item"><span className="info-icon"><Layers3 size={15} /></span><div><small>Франшиза</small><b>{film.franchise}</b></div></div>}
              {film.festivalRecognized && <div className="info-item"><span className="info-icon"><Award size={15} /></span><div><small>Отметка редакции</small><b>Фестивальное кино</b></div></div>}
              {film.cast && <div className="info-item"><span className="info-icon"><UsersRound size={15} /></span><details className="detail-cast"><summary>В ролях<span>{film.cast.replace(/[;\n\r]+/g, ', ').split(',').slice(0, 2).join(', ')}{film.cast.replace(/[;\n\r]+/g, ', ').split(',').length > 2 ? ' и другие' : ''}</span></summary><InfoInlineLinks value={film.cast.replace(/[;\n\r]+/g, ', ')} go={go} /></details></div>}

              {/* Год выпуска */}
              <div className="info-item">
                <span className="info-icon">
                  <CalendarDays size={15} />
                </span>
                <div>
                  <small>Год выпуска</small>
                  <InfoInlineLinks
                    value={String(film.year)}
                    param="year"
                    go={go}
                  />
                </div>
              </div>

              {/* Длительность */}
              <div className="info-item">
                <span className="info-icon">
                  <Clock3 size={15} />
                </span>
                <div>
                  <small>Длительность</small>
                  <b>{film.duration} мин</b>
                </div>
              </div>

              {/* Количество серий */}
              {film.episodes && (
                <div className="info-item">
                  <span className="info-icon">
                    <Layers3 size={15} />
                  </span>
                  <div>
                    <small>Кол-во серий</small>
                    <b>{film.episodes}</b>
                  </div>
                </div>
              )}

              {/* Страна */}
              <div className="info-item">
                <span className="info-icon">
                  <Globe2 size={15} />
                </span>
                <div>
                  <small>Страна</small>
                  <InfoInlineLinks
                    value={film.country}
                    go={go}
                  />
                </div>
              </div>

              {/* Категория */}
              <div className="info-item">
                <span className="info-icon">
                  <Film size={15} />
                </span>
                <div>
                  <small>Категория</small>
                  <InfoInlineLinks
                    value={film.category}
                    param="category"
                    go={go}
                  />
                </div>
              </div>

              {/* Студия */}
              {film.studio && (
                <div className="info-item">
                  <span className="info-icon">
                    <Clapperboard size={15} />
                  </span>
                  <div>
                    <small>Студия</small>
                    <InfoInlineLinks
                      value={film.studio}
                      param="studio"
                      go={go}
                    />
                  </div>
                </div>
              )}

            </div>
          </div>

        </section>

      <div className="detail-lower">
        <div className="detail-main">
          <div className="rating-panel-advanced">
            <div className="rating-selector-box">
              <RatingCelebration sequence={ratingBurst} />
              <span className="eyebrow">ТВОЙ ВЕРДИКТ</span>
              <h3>{myRating ? "Твоя оценка" : "Оцени историю"}</h3>
              <div className="fancy-stars" role="group" aria-label="Твоя оценка" onMouseLeave={() => setHover(0)}>
                {Array.from({ length: 10 }).map((_, i) => {
                  const val = i + 1;
                  return (
                    <div key={i} className="star-wrapper">
                      <button
                        aria-label={`Оценить на ${val - 0.5} из 10`} aria-pressed={myRating === val - 0.5}
                        className={`star-half left ${myRating >= val - 0.5 ? "active" : ""}`}
                        onMouseEnter={() => setHover(val - 0.5)}
                        onClick={() => rate(val - 0.5)}
                      />
                      <button
                        aria-label={`Оценить на ${val} из 10`} aria-pressed={myRating === val}
                        className={`star-half right ${myRating >= val ? "active" : ""}`}
                        onMouseEnter={() => setHover(val)}
                        onClick={() => rate(val)}
                      />
                      <Star size={32} className={`base-star ${(hover || myRating) >= val ? "filled" : (hover || myRating) >= val - 0.5 ? "half" : ""}`} />
                    </div>
                  );
                })}
              </div>
              <div className="rating-current-value">{hover || myRating || "—"} <span>/ 10</span></div>
              <button type="button" className="mobile-inline-rating outline-btn" aria-haspopup="dialog" onClick={() => setMobileRatingOpen(true)}><Star size={18}/>{myRating ? 'Изменить оценку' : 'Поставить оценку'}</button>
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

          <div className="community-review-entry">
            <span className="detail-comment-icon"><MessageCircle size={24} /></span>
            <div><h3>Комментарии <span className="detail-comment-count">{movieComments.length}</span></h3><p>{movieComments.length ? 'Впечатления зрителей, ответы и обсуждения. Спойлеры скрыты.' : 'Здесь начнётся обсуждение. Поделись первым впечатлением.'}</p></div>
            <button type="button" className="outline-btn detail-comments-button" aria-haspopup="dialog" onClick={() => setReviewsOpen(true)}><MessageCircle size={17} />{movieComments.length ? 'Открыть комментарии' : 'Написать комментарий'}<ArrowRight size={16} /></button>
          </div>
          <ReviewDrawer open={reviewsOpen} close={() => setReviewsOpen(false)}>
          <div className="discussion">
            <SectionTitle kicker="ДЕЛИСЬ ВПЕЧАТЛЕНИЯМИ" title={`Обсуждение · ${movieComments.length}`} />
            <div className="comment-compose">
              <Avatar name={data.user?.username || 'G'} src={data.user?.avatar} size={40} />
              <div>
                <textarea aria-label="Текст отзыва" maxLength={2000} value={comment} onChange={e => setComment(e.target.value)} placeholder={reply ? 'Напиши ответ...' : 'Что ты думаешь об этой истории? Напиши свой отзыв...'} />
                <div className="emoji-bar">
                  {['😍', '🔥', '👏', '😂', '😢', '🤯', '💀', '👎', '❤️', '🍿', '⭐', '💯', '🎬', '😱', '🤔', '👀', '✨', '🏆'].map(e => (
                    <button key={e} type="button" onClick={() => setComment(prev => prev + e)}>{e}</button>
                  ))}
                </div>
                <label className="comment-spoiler-toggle"><input type="checkbox" checked={commentSpoiler} onChange={e => setCommentSpoiler(e.target.checked)} />Содержит спойлер — скрыть текст до нажатия</label>
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
  currentUser={data.user}
  action={action}
  reply={() => {
    setReply(c.id);
    document.querySelector('.comment-compose')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center'
    });
  }}
  react={() =>
    requireAuth(() =>
      action({ action: 'react', commentId: c.id })
    )
  }
/>
                {movieComments.filter(r => r.parentId === c.id).map(r => (
                  <div className="comment-reply" key={r.id}>
<CommentRow
  c={r}
  currentUser={data.user}
  action={action}
  reply={() => {
    setReply(c.id);
    document.querySelector('.comment-compose')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center'
    });
  }}
  react={() =>
    requireAuth(() =>
      action({
        action: 'react',
        commentId: r.id
      })
    )
  }
/>
                  </div>
                ))}
              </div>
            )) : <p className="muted">Начни разговор первым!</p>}
          </div>
          </ReviewDrawer>
        </div>


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

function CommentRow({
  c,
  reply,
  react,
  currentUser,
  action,
}: {
  c: Comment;
  reply: () => void;
  react: () => void;
  currentUser: User | null;
  action: (p: Record<string, unknown>, s?: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.body);
  const [spoiler, setSpoiler] = useState(!!c.spoiler);
  const [revealedBody, setRevealedBody] = useState('');
  const [busy, setBusy] = useState(false);

  const isOwner = currentUser?.id === c.author?.id;

  const isModerator =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'moderator';

  const canDelete = isOwner || isModerator;

  const save = async () => {
    const value = text.trim();

    if (value.length < 2 || busy) return;

    setBusy(true);

    const ok = await action(
      {
        action: 'commentEdit',
        commentId: c.id,
        text: value,
        spoiler,
      },
      'Комментарий изменён'
    );

    setBusy(false);

    if (ok) setEditing(false);
  };

  const remove = async () => {
    if (busy) return;

    const confirmed = window.confirm(
      isOwner
        ? 'Удалить свой комментарий?'
        : 'Удалить комментарий пользователя?'
    );

    if (!confirmed) return;

    let reason = '';

    if (!isOwner && isModerator) {
      reason =
        window.prompt(
          'Причина удаления (необязательно):'
        ) || '';
    }

    setBusy(true);

    await action(
      {
        action: 'commentDelete',
        commentId: c.id,
        reason,
      },
      'Комментарий удалён'
    );

    setBusy(false);
  };

  return (
    <div className="comment-row">
      <Avatar
        name={c.author?.username || 'User'}
        src={c.author?.avatar}
        size={40}
      />

      <div className="comment-content">
        <div className="comment-by">
          <b>{c.author?.username || 'Зритель'}</b>
          <UserTitleBadge title={c.author?.displayTitle} />

          <span>
            {new Date(c.createdAt).toLocaleDateString('ru-RU')}
          </span>

          {c.editedAt && (
            <span title={`Изменено ${new Date(c.editedAt).toLocaleString('ru-RU')}`}>
              · изменено
            </span>
          )}
        </div>

        {editing ? (
          <div className="comment-edit-box">
            <textarea
              value={text}
              maxLength={2000}
              onChange={e => setText(e.target.value)}
              rows={3}
            />

            <label className="comment-spoiler-toggle"><input type="checkbox" checked={spoiler} onChange={e => setSpoiler(e.target.checked)} />Содержит спойлер</label>
            <div className="comment-edit-actions">
              <button
                className="primary-btn small"
                onClick={save}
                disabled={busy || text.trim().length < 2}
              >
                <Check size={14} />
                Сохранить
              </button>

              <button
                className="outline-btn small"
                onClick={() => {
                  setEditing(false);
                  setText(c.body);
                }}
                disabled={busy}
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          c.spoiler && revealedBody !== c.body ? <button type="button" className="comment-spoiler-cover" onClick={() => setRevealedBody(c.body)}><Eye size={17} /><b>В отзыве есть спойлер</b><span>Нажми, чтобы прочитать</span></button> : <div className="comment-visible-body">{c.spoiler && <button type="button" className="comment-spoiler-hide" onClick={() => setRevealedBody('')}>Скрыть спойлер</button>}<p>{c.body}</p></div>
        )}

        {!editing && (
          <div className="comment-buttons">
            <button onClick={react}>
              <Heart size={15} />
              {c.likes || 0}
            </button>

            <button onClick={reply}>
              <MessageCircle size={15} />
              Ответить
            </button>

            {isOwner && (
              <button
                onClick={() => {
                  setText(c.body);
                  setSpoiler(!!c.spoiler);
                  setEditing(true);
                }}
              >
                <Pencil size={14} />
                Изменить
              </button>
            )}

            {isModerator && <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await action({ action: 'commentSpoiler', commentId: c.id, spoiler: !c.spoiler }, c.spoiler ? 'Тег спойлера снят' : 'Отзыв скрыт под спойлером'); } finally { setBusy(false); } }}><Eye size={14} />{c.spoiler ? 'Снять тег спойлера' : 'Отметить спойлер'}</button>}

            {canDelete && (
              <button
                onClick={remove}
                disabled={busy}
                className="comment-delete-btn"
              >
                <Trash2 size={14} />
                Удалить
              </button>
            )}
          </div>
        )}
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
  const [profileSection, setProfileSection] = useState('diary');
  const upload = useRef<HTMLInputElement>(null);

  if (!u) return <Gate title="Твоя киновселенная ждёт" description="Войди, чтобы вести историю просмотров, собирать достижения и создавать профиль мечты." auth={auth} />;

  const watched = data.watches.map(w => ({ ...w, film: data.films.find(f => f.id === w.movieId) })).filter(x => x.film);
  const minutes = watched.reduce((n, w) => n + (w.film ? titleMinutes(w.film) : 0), 0);
  const achieved = achievementDefs.filter(a => (data.achievementProgress[a.id] ?? 0) >= a.targets[0]).length + (data.hiddenAchievements?.length || 0);
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
        <div className="stats-tabs" role="group" aria-label="Категория статистики">
          <button type="button" aria-pressed={statTab === 'all'} className={statTab === 'all' ? 'active' : ''} onClick={() => setStatTab('all')}>Общая</button>
          <button type="button" aria-pressed={statTab === 'movie'} className={statTab === 'movie' ? 'active' : ''} onClick={() => setStatTab('movie')}>Фильмы</button>
          <button type="button" aria-pressed={statTab === 'tv'} className={statTab === 'tv' ? 'active' : ''} onClick={() => setStatTab('tv')}>Сериалы</button>
          <button type="button" aria-pressed={statTab === 'anime'} className={statTab === 'anime' ? 'active' : ''} onClick={() => setStatTab('anime')}>Аниме</button>
          <button type="button" aria-pressed={statTab === 'cartoon'} className={statTab === 'cartoon' ? 'active' : ''} onClick={() => setStatTab('cartoon')}>Мультфильмы</button>
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
      <div className="profile-tile orbit-profile-tile">
        <MemoryOrbit films={data.films} watches={data.watches} ratings={data.ratings} comments={data.comments} userId={u.id} editing={editing} go={go} />
      </div>
    ),
    achievements: (
      <div className="profile-tile">
        <div className="tile-heading"><span><Trophy size={18} /> Достижения</span>{editing && <GripVertical size={18} />}</div>
        <div className="profile-badges">
          {achievementDefs.slice(0, 4).map(a => (
            <div key={a.id} role="button" tabIndex={0} aria-label={`Подробнее: ${a.name}`} onClick={() => go('/achievements')} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); go('/achievements'); } }} className={(data.achievementProgress[a.id] ?? 0) >= a.targets[0] ? 'earned' : ''}>
              <span>{a.icon}</span><b>{a.name}</b><small>{(data.achievementProgress[a.id] ?? 0) >= a.targets[0] ? 'Открыто' : 'Не открыто'}</small>
              <OwnershipBadge stats={data.achievementStats[a.id]?.[0]} tier={1} compact />
            </div>
          ))}
        </div>
        <HiddenTrophies awards={data.hiddenAchievements || []} compact />
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
      <div className={`profile-cover hud-profile-cover header-style- effect-${u.profileEffect || 'none'} ${u.headerImage && u.headerStyle === 5 ? 'custom-header' : ''}`} style={u.headerImage && u.headerStyle === 5 ? { backgroundImage: `linear-gradient(120deg,rgba(10,12,18,.55),rgba(10,12,18,.2)),url(${u.headerImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined} data-style={u.headerStyle || 1} data-frame={u.headerFrame || 'none'}>
        <div className="cover-noise" />
        <div className="cover-effect-layer" />
        <span className="cover-label">moviemovie · ЛИЧНЫЙ КИНОПАСПОРТ</span>
        <div className="cover-orbit">✦</div>
        <div className="profile-cover-content">
          <div className="cover-main">
            <div className="cover-badges">
              <span className="role-badge">{u.role === 'admin' ? 'АДМИНИСТРАТОР' : u.role === 'moderator' ? 'МОДЕРАТОР' : u.role === 'vip' ? 'VIP УЧАСТНИК' : 'УЧАСТНИК'}</span>
              {u.displayTitle ? <UserTitleBadge title={u.displayTitle} /> : u.displayTitle !== null && <span className="title-badge">✦ {titleFor(u, watched.length)}</span>}
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
              <button className="cover-edit" onClick={() => { setEditing(!editing); setProfileSection('diary'); }}>{editing ? <><Check size={16} /> Готово</> : <><Pencil size={16} /> Настроить профиль</>}</button>
            </div>
          </div>
        </div>
      </div>

      <div className="passport-level-banner"><ProfileLevel xp={u.xp} title={progressionTitle(new Set(watched.map(watch => watch.movieId)).size)} /></div>

      <nav className="profile-section-tabs" aria-label="Разделы профиля">{[
        ['diary', 'Кинодневник', BookOpen], ['pet', 'Кинопитомец и попкорн', Sparkles], ['card', 'Киновизитка', Clapperboard], ['titles', 'Титулы', Crown],
      ].map(([id, label, Icon]) => { const TabIcon = Icon as typeof BookOpen; return <button key={String(id)} type="button" aria-pressed={profileSection === id} onClick={() => setProfileSection(String(id))}><TabIcon size={17} />{String(label)}</button>; })}</nav>
      {profileSection === 'pet' && <React.Suspense fallback={<p role="status">Загружаем питомца…</p>}><CinemaPetStudio key={u.id} go={go} /></React.Suspense>}
      {profileSection === 'card' && <CinemaCardStudio user={u} films={data.films} watches={data.watches} progress={data.achievementProgress} ownership={data.achievementStats} hiddenAchievements={data.hiddenAchievements} go={go} />}
      {profileSection === 'titles' && <UserTitleStudio collection={data.titles} username={u.username} action={action} />}
      {profileSection === 'diary' && <>
      <CinemaPassport films={data.films} watches={data.watches} go={go} onTitles={() => setProfileSection('titles')} />

      <ProfileHud showLevel={false} xp={u.xp} title={progressionTitle(new Set(watched.map(watch => watch.movieId)).size)} watches={new Set(watched.map(watch => watch.movieId)).size} minutes={minutes} achieved={achieved} days={new Set(data.watches.map(w => new Date(w.watchedAt).toISOString().slice(0, 10))).size} progress={data.achievementProgress} go={go} />

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

      <div className="profile-tiles hud-bento">
        {order.filter(id => tiles[id]).map(id => (
          <div key={id} data-hud-tile={id} draggable={editing} onDragStart={() => setDragged(id)} onDragOver={e => e.preventDefault()} onDrop={() => { if (!dragged || dragged === id) return; const next = [...order]; next.splice(next.indexOf(dragged), 1); next.splice(next.indexOf(id), 0, dragged); setOrder(next); save({ tileOrder: next.join(',') }); setDragged(''); }} className={editing ? 'draggable-tile' : ''}>
            {tiles[id]}
          </div>
        ))}
      </div>
      </>}
    </>
  );
}

// --- Favorites Page ❤️ ---
function FavoritesPage({
  data,
  go,
  auth,
}: {
  data: Data;
  go: (s: string) => void;
  auth: () => void;
}) {
  if (!data.user) {
    return (
      <Gate
        title="Твои любимые истории"
        description="Войди в аккаунт, чтобы сохранять любимые фильмы, сериалы и аниме."
        auth={auth}
      />
    );
  }

  const favoriteIds = new Set(data.favoriteIds || []);

  const favoriteFilms = data.films.filter(f =>
    favoriteIds.has(f.id)
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            ТВОЯ ЛИЧНАЯ КОЛЛЕКЦИЯ
          </span>

          <h1>
            Моё <em>любимое.</em>
          </h1>

          <p>
            Истории, которые заняли особое место в твоём сердце.
          </p>
        </div>

        <div className="heading-count">
          <Heart size={19} fill="currentColor" />
          {favoriteFilms.length} любимых
        </div>
      </div>

      {favoriteFilms.length > 0 ? (
        <FilmGrid films={favoriteFilms} go={go} />
      ) : (
        <div className="empty-state">
          <Heart size={40} />

          <h3>Здесь пока нет любимых историй</h3>

          <p>
            Нажми на сердечко на любом материале,
            чтобы добавить его сюда.
          </p>

          <button
            className="primary-btn"
            onClick={() => go('/catalog')}
          >
            Найти любимое
            <ArrowRight size={17} />
          </button>
        </div>
      )}
    </>
  );
}


function Watchlist({ data, go, auth }: { data: Data; go: (s: string) => void; auth: () => void; }) {
  if (!data.user) return <Gate title="Буду смотреть" description="Войди, чтобы сохранять материалы, которые хочешь посмотреть позже." auth={auth} />;
  const saved = data.films.filter(f => data.bookmarks.some(b => b.movieId === f.id));
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ЗАПЛАНИРОВАНО К ПРОСМОТРУ</span>
          <h1>Буду <em>смотреть.</em></h1>
          <p>Истории, которые ты добавил в желаемое и хочешь посмотреть позже.</p>
        </div>
        
        <div className="heading-count">
          <Bookmark size={18} />
          {saved.length} в желаемом
        </div>
      </div>
      {saved.length ? <FilmGrid films={saved} go={go} /> : (
        <div className="empty-state">
          <Bookmark size={38} />
          <h3>Здесь пока пусто</h3>
          <p>Найди что-нибудь интересное и добавь в желаемое.</p>
          <button className="primary-btn" onClick={() => go('/catalog')}>
            Исследовать каталог <ArrowRight size={17} />
          </button>
        </div>
      )}
    </>
  );
}

function Leaderboard({ data, go }: { data: Data; go: (s: string) => void; }) {
  const [metric, setMetric] = useState<LeaderboardMetric>('minutes');
  const [limit, setLimit] = useState<LeaderboardLimit>(100);
  const labels = LEADERBOARD_METRICS;
  const leaders = useMemo(() => getTopLeaders(data.leaderboard, metric, limit), [data.leaderboard, metric, limit]);
  const podium = getLeaderboardPodium(leaders);
  const value = (p: Leader) => metric === 'minutes' ? `${Math.floor(p.minutes / 60)} ч ${p.minutes % 60} мин` : fmt(Number(p[metric] || 0));

  return (
    <>
      <div className="page-heading">
        <div><span className="eyebrow">ЛУЧШИЕ ИЗ ЛУЧШИХ</span><h1>Зал <em>славы.</em></h1><p>Каждый час просмотра — новая строчка в истории сообщества.</p></div>
        <div className="heading-count"><Trophy size={18} />{data.leaderboard.length} участников</div>
      </div>
      <div className="leader-controls">
        <div className="leader-filters" role="group" aria-label="Показатель рейтинга">
          {(Object.keys(labels) as LeaderboardMetric[]).map(k => (
            <button type="button" key={k} className={metric === k ? 'selected' : ''} aria-pressed={metric === k} onClick={() => setMetric(k)}>{labels[k]}</button>
          ))}
        </div>
        <div className="leader-limit-row">
          <span className="leader-limit-label">Размер топа</span>
          <div className="leader-filters leader-limit-filters" role="group" aria-label="Размер топа">
            {LEADERBOARD_LIMITS.map(size => (
              <button type="button" key={size} className={limit === size ? 'selected' : ''} aria-pressed={limit === size} onClick={() => setLimit(size)}>Топ-{size}</button>
            ))}
          </div>
        </div>
        <p className="leader-result-count" role="status">Топ-{limit} · Показано {leaders.length} из {data.leaderboard.length}</p>
      </div>
      {podium.length > 0 && (
        <div className={`podium ${podium.length === 1 ? 'podium-single' : ''}`}>
          {podium.map(({ person: p, place }) => (
            <div key={p.id} className={`podium-person podium-${place === 1 ? 1 : place === 2 ? 0 : 2}`}>
              <span className="podium-crown">{place === 1 ? <Crown size={22} fill="currentColor" /> : <Trophy size={18} />}</span>
              <Avatar name={p.username} src={p.avatar} size={place === 1 ? 76 : 62} frame={place === 1 ? 'gold' : 'none'} />
              <b>{p.username}</b><small>{titleFor({ xp: p.xp } as User, p.watches)}</small>
              <strong>{value(p)}</strong>
              <span className="podium-place">#{place}</span>
            </div>
          ))}
        </div>
      )}
      <div className="rank-list leaderboard-rank-list">
        <div className="rank-header"><span>МЕСТО / УЧАСТНИК</span><span>{labels[metric].toUpperCase()}</span></div>
        {leaders.map((p, i) => (
          <div className={`rank-row ${p.id === data.user?.id ? 'is-me' : ''}`} key={p.id}>
            <span className="rank-position">{String(i + 1).padStart(2, '0')}</span>
            <Avatar name={p.username} src={p.avatar} size={40} />
            <span className="rank-person"><b>{p.username} {p.id === data.user?.id && <small>ТЫ</small>}</b><small>{p.role === 'admin' ? 'Администратор' : p.role === 'vip' ? 'VIP зритель' : titleFor({ xp: p.xp } as User, p.watches)}</small></span>
            <strong>{value(p)}</strong>
          </div>
        ))}
        {leaders.length === 0 && <div className="empty-state"><Trophy size={32} /><h3>Рейтинг пока пуст</h3><p>Участники появятся здесь после регистрации.</p></div>}
      </div>
    </>
  );
}


function Achievements({ data, auth, go }: { data: Data; auth: () => void; go: (s: string) => void; }) {
  const [expandedAch, setExpandedAch] = useState<string | null>(null);
  if (!data.user) return <Gate title="Собирай свою историю" description="Открывай достижения, улучшай их от бронзы до платины и получай награды." auth={auth} />;

  const hiddenAwards = data.hiddenAchievements || [];
  const unlocked = hiddenAwards.length + achievementDefs.filter(a => (data.achievementProgress[a.id] ?? 0) >= a.targets[0]).length;
  const total = achievementDefs.length + hiddenAwards.length;
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
        <div><h3>Твоя коллекция растёт</h3><p>Каждое из {achievementDefs.length} обычных достижений имеет 4 уровня: Бронза, Серебро, Золото и Платина. Редкость каждого тира зависит от доли владельцев среди всех зарегистрированных пользователей.</p></div>
        <strong>{pct}%</strong>
      </div>

      <div className="rarity-guide">
        <span>Обычная ≥50%</span><span>Необычная ≥20%</span><span>Редкая ≥10%</span><span>Эпическая ≥3%</span><span>Легендарная &lt;3%</span>
      </div>
      <p className="collectible-note">Показана доля владельцев открытого тира, а для закрытого достижения — Бронзы. Статистика обычных достижений пересчитывается по текущему прогрессу; их календарные условия считаются по UTC.</p>

      <div className="ach-progress-outer"><div className="ach-progress-inner" style={{ width: pct + '%' }} /></div>

      <div className="ach-cats-row">
        {cats.map(cat => {
          const catDefs = achievementDefs.filter(a => (a as any).category === cat);
          const catUnlocked = catDefs.filter(a => (data.achievementProgress[a.id] ?? 0) >= a.targets[0]).length;
          return <div key={cat} className="ach-cat-pill"><span>{cat}</span><b>{catUnlocked}/{catDefs.length}</b></div>;
        })}
      </div>

      <p className="collectible-note">Переворот открывает оформление уже заслуженного трофея на этом устройстве. Награды и XP не начисляются повторно.</p>
      <HiddenTrophies awards={hiddenAwards} revealUserId={data.user.id} />

      {cats.map(cat => {
        const catDefs = achievementDefs.filter(a => (a as any).category === cat);
        return (
          <div key={cat} className="ach-category-section">
            <div className="ach-category-header"><h3>{cat}</h3><span>{catDefs.filter(a => (data.achievementProgress[a.id] ?? 0) >= a.targets[0]).length}/{catDefs.length}</span></div>
            <div className="achievement-grid">
              {catDefs.map(a => {
                const value = (data.achievementProgress[a.id] ?? 0);
                const tier = a.targets.filter(t => value >= t).length;
                const next = a.targets[Math.min(tier, a.targets.length - 1)];
                const pctBar = Math.min(100, (value / next) * 100);

                return (
                  <div
                    className={`achievement-card ${tier ? 'unlocked' : 'locked'} ${tier === 4 ? 'maxed' : ''} achievement-level-${tier} ${expandedAch === a.id ? 'expanded' : ''}`}
                    key={a.id}
                    role="button"
                    tabIndex={0}
                    aria-expanded={expandedAch === a.id}
                    onKeyDown={event => {
                      if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault(); setExpandedAch(expandedAch === a.id ? null : a.id);
                      }
                    }}
                    onClick={() => setExpandedAch(expandedAch === a.id ? null : a.id)}
                  >
                    <div className="achievement-top">
                      <span className="achievement-icon">{tier ? <AchievementReveal key={`${data.user!.id}:${a.id}:${tier}`} userId={data.user!.id} achievementId={a.id} tier={tier} icon={a.icon} name={`${a.name} · ${ACHIEVEMENT_TIERS[tier - 1]}`} /> : a.icon}</span>
                      <span className="achievement-tier">{tier ? `${tier === 4 ? '✦ ' : ''}${ACHIEVEMENT_TIERS[tier - 1]}` : 'ЗАКРЫТО'}</span>
                    </div>
                    <h3>{a.name}</h3><p>{a.description}</p>
                    <OwnershipBadge stats={data.achievementStats[a.id]?.[Math.max(0, tier - 1)]} tier={Math.max(1, tier)} />

                    <div className="achievement-progress">
                      <div><span>{Math.min(value, next)} / {next} {a.unit}</span><b>{tier === 4 ? 'Максимальный уровень' : `Следующий: ${ACHIEVEMENT_TIERS[tier]}`}</b></div>
                      <div className="bar-track"><i style={{ width: `${pctBar}%` }} /></div>
                    </div>

                    <div className="tier-dots">{a.targets.map((t, i) => <span key={t} className={value >= t ? 'filled' : ''}>{['I', 'II', 'III', 'IV'][i]}</span>)}</div>

                    {expandedAch === a.id && (
                      <div className="ach-detail" onClick={e => e.stopPropagation()}>
                        <div className="ach-tiers-detail">
                          {a.targets.map((t, i) => (
                            <div key={i} className={`ach-tier-row ${value >= t ? 'done' : ''}`}>
                              <span>{ACHIEVEMENT_TIERS[i]}</span><b>{t} {a.unit}</b>
                              {value >= t ? <Check size={14} /> : <small>{Math.max(0, t - value)} осталось</small>}
                              <OwnershipBadge stats={data.achievementStats[a.id]?.[i]} tier={i + 1} compact />
                            </div>
                          ))}
                        </div>
                        <button className="outline-btn small" onClick={() => go(a.id === 'archaeologist' ? '/catalog?category=' + encodeURIComponent('Фильм') + '&year=before1960' : a.id === 'serial_completion' ? '/catalog?category=' + encodeURIComponent('Сериал') : '/catalog')}><Compass size={14} /> Открыть каталог</button>
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
  { id: 'wordle', icon: '🟩', name: 'Кино-Вордли', description: 'Выбери название по буквенной подсказке', color: 'green' },
  { id: 'hangman', icon: '🔡', name: 'Кино-Поле Чудес', description: 'Угадай название по буквам', color: 'amber' },
  { id: 'anagram', icon: '🔀', name: 'Кино-Анаграмма', description: 'Собери буквы названия в правильном порядке', color: 'violet' },
  { id: 'truths', icon: '🤥', name: 'Две правды, одна ложь', description: 'Найди ложный факт о фильме', color: 'pink' },
  { id: 'chrono', icon: '⏳', name: 'Хроно-Слайдер', description: 'Выбери самый ранний фильм', color: 'blue' },
  { id: 'connections', icon: '🧩', name: 'Кино-Связи', description: 'Выбери фильм по общему жанровому признаку', color: 'green' }
];

function Games({ films, action, user, auth }: { films: FilmType[]; action: (p: Record<string, unknown>, s?: string) => Promise<boolean>; user: User | null; auth: () => void; }) {
  const [mode, setMode] = useState<typeof gameModes[number] | null>(null);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [gameError, setGameError] = useState('');
  const finishingGame = useRef(false);
  const [questions, setQuestions] = useState<{ movieId?: number; question: string; options: string[]; correct: string; poster?: string }[]>([]);

  const make = (id: string) => {
    setGameError('');
    const usable = [...new Map(films.map(film => [film.id, film])).values()];
    if (usable.length < 2) { setGameError('Для викторины нужны хотя бы два разных материала в каталоге.'); return; }
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
        case 'truths': { const lie = `Год выпуска — ${f.year + 1}`; question = `Найди ЛОЖЬ о «${f.title}»:`; correct = lie; options = [`Год выпуска — ${f.year}`, `Категория — ${f.category}`, lie].sort(() => Math.random() - 0.5); break; }
        case 'chrono': { question = `Какой из этих фильмов вышел раньше всех?`; correct = [...source].sort((a, b) => a.year - b.year)[0].title; options = source.slice(0, 4).map(x => x.title).sort(() => Math.random() - 0.5); break; }
        case 'connections': {
          question = `Какой фильм НЕ связан общим жанром «${f.genre.split(',')[0].trim()}»?`;
          const outsider = usable.find(x => !catalogTokens(x.genre).includes(catalogTokens(f.genre)[0]));
          if (!outsider) return { movieId: f.id, question, correct: '', options: [] };
          correct = outsider.title;
          options = [...source.filter(x => x.genre.includes(f.genre.split(',')[0].trim())).slice(0, 3).map(x => x.title), outsider.title].sort(() => Math.random() - 0.5);
          break;
        }
        default: {
          const others = usable.filter(x => x.rating !== f.rating);
          if (!others.length) return { movieId: f.id, question: '', correct: '', options: [] };
          const opponent = others[Math.floor(Math.random() * others.length)];
          correct = f.rating >= opponent.rating ? f.title : opponent.title;
          options = [f.title, opponent.title];
          question = `Что оценили выше: «${f.title}» или другое кино?`;
        }
      }
      return { movieId: f.id, question, correct, options, poster };
    });

    const valid = qs.map(question => ({ ...question, options: [...new Set(question.options)].filter(Boolean) })).filter(question => question.options.length >= 2 && question.options.includes(question.correct));
    if (!valid.length) { setGameError('В каталоге недостаточно разных данных для этого режима. Попробуй другой.'); return; }
    setQuestions(Array.from({ length: 5 }, (_, index) => valid[index % valid.length]));
    setMode(gameModes.find(g => g.id === id) || null);
    setRound(0);
    setScore(0);
    setChoice(null);
  };

  const next = async () => {
    if (round === 4) {
      if (finishingGame.current) return;
      finishingGame.current = true;
      try {
      if (user) await action({ action: 'game', game: mode?.id, score }, 'Результат тренировки сохранён');
      setRound(5);
      } finally { finishingGame.current = false; }
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
        <div><h3>Играй. Узнавай. Тренируйся.</h3><p>Пять вопросов за раунд. Тренировочные результаты сохраняются без начисления XP: ответы пока проверяются в браузере.</p></div>
        <span>ПРАКТИКА</span>
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

      {gameError && <p className="collectible-note" role="status">{gameError}</p>}
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
                    wrapStyle={{ display: 'block' }}
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
                <div className="result-points">{score} / 5</div>
                {!user && <p>Войди, чтобы сохранять результаты тренировок.</p>}
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

function AuthModal({ close, refresh, notify }: { close: () => void; refresh: () => Promise<void>; notify: (s: string) => void; }) {
  const authParams = useSearchParams();
  const [error, setError] = useState(() => authParams.get('auth') ? authErrorMessage(authParams.get('auth')) : '');
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const tgRef = useRef<HTMLDivElement>(null);
  const botName = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: tab, email, password, username }) });
      const d = await r.json();
      if (!r.ok) { const message = d.error || 'Ошибка входа'; setError(message); notify(message); }
      else { await refresh(); notify(tab === 'login' ? 'С возвращением!' : 'Добро пожаловать в moviemovie!'); close(); }
    } catch {
      setError('Ошибка соединения. Проверьте сеть и попробуйте ещё раз.');
      notify('Ошибка соединения');
    } finally {
      setBusy(false);
    }
  };

  const finishTelegram = async (telegramData: { id: number; first_name?: string; username?: string; photo_url?: string; }) => {
    setError('');
    setBusy(true);
    try {
      const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'telegram', telegramData }) });
      const d = await r.json();
      if (!r.ok) { const message = d.error || 'Ошибка Telegram-входа'; setError(message); notify(message); }
      else { await refresh(); notify('Вход через Telegram выполнен'); close(); }
    } catch {
      setError('Ошибка соединения с Telegram. Попробуйте другой способ входа.');
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
        {error && <div className="auth-error-message" role="alert">{error}</div>}
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
            {botName ? <div ref={tgRef} /> : <button type="button" className="telegram-fallback" disabled title="Вход через Telegram не настроен"><span className="telegram-badge">✈</span> Telegram<small>Не настроен</small></button>}
          </div>
          {/* OAuth needs a document redirect and state cookie, not an RSC fetch. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className="yandex-login-btn" href="/api/oauth/yandex"><b className="yandex-y">Я</b> Яндекс</a>
        </div>
      </div>
    </div>
  );
}

function MovieForm({
  film,
  mode = 'edit',
  suggestion,
  suggestions = [],
  close,
  action,
  onSaved,
  notify
}: {
  film: FilmType | null;
  mode?: 'edit' | 'suggest';
  suggestion?: MovieSuggestion;
  suggestions?: MovieSuggestion[];
  close: () => void;
  action: (p: Record<string, unknown>, s?: string) => Promise<boolean>;
  notify: (s: string) => void;
  onSaved: (id: number) => Promise<void>;
}) {
  const initial: Partial<FilmType> & { endYear?: number | null; ongoing?: boolean } = suggestion
    ? { ...suggestion.material, title: suggestion.title, year: suggestion.year, genre: suggestion.genre, category: suggestion.category }
    : film || {};
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const [uploading, setUploading] = useState(false);
  const uploadPending = useRef(false);
  const dirty = useRef(false);
  const requestClose = () => { if (!pending.current && !uploadPending.current && (!dirty.current || window.confirm('Закрыть форму? Несохранённые изменения будут потеряны.'))) close(); };
  useEffect(() => {
    const element = dialog.current!;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => { element.close(); document.body.style.overflow = overflow; };
  }, []);
  const [trailerUploading,setTrailerUploading] = useState(false);
  const [form, setForm] = useState({
    title: initial.title || '',
    originalTitle: initial.originalTitle || '',
    description: initial.description || '',
    category: initial.category || 'Фильм',
    genre: initial.genre || '',
    studio: initial.studio || '',
    year: initial.year || new Date().getFullYear(),
    ageRating: initial.ageRating || '',
    endYear: initial.endYear ?? '',
    ongoing: initial.ongoing ?? false,
    duration: initial.duration || 90,
    episodes: initial.episodes || 0,
    mood: initial.mood || '',
    poster: initial.poster || '',
    backdrop: initial.backdrop || '',
    watchUrl: initial.watchUrl || '',
    playbackUrl: initial.playbackUrl || '',
    trailerUrl: initial.trailerUrl || '',
    director: initial.director || '',
    cast: initial.cast || '',
    franchise: initial.franchise || '',
    festivalRecognized: initial.festivalRecognized || false,
    country: initial.country || ''
  });

  const [busy, setBusy] = useState(false);

  const isSeries =
    form.category.toLowerCase().includes('сериал') ||
    form.category.toLowerCase().includes('series');

  const field = (
    key: keyof typeof form,
    value: string | number | boolean
  ) => {
    dirty.current = true;
    setForm(v => ({ ...v, [key]: value }));
  };

  const uploadImage = async (kind: 'poster' | 'backdrop', file?: File) => {
    if (!file || uploadPending.current || pending.current) return;
    if (file.size > 4 * 1024 * 1024) { setError('Максимальный размер изображения — 4 МБ'); return; }
    uploadPending.current = true; setUploading(true); setError('');
    const fd = new FormData(); fd.append('file', file);
    fd.append('kind', mode === 'suggest' ? kind === 'poster' ? 'suggestionPoster' : 'suggestionBackdrop' : kind);
    try {
      const response = await fetch('/api/upload', { method: 'POST', body: fd });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error || 'Ошибка загрузки');
      field(kind, result.url);
      notify('Изображение загружено');
    } catch (e) { setError(e instanceof Error ? e.message : 'Ошибка загрузки'); }
    finally { uploadPending.current = false; setUploading(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (pending.current || uploadPending.current) return;

    if (isSeries && !form.ongoing && form.endYear !== '') {
      if (Number(form.endYear) < Number(form.year)) {
        notify('Год окончания не может быть меньше года начала');
        return;
      }
    }

    pending.current = true;
    setBusy(true); setError('');

    const material = { ...form, endYear: isSeries && !form.ongoing && form.endYear !== '' ? Number(form.endYear) : null, ongoing: isSeries ? form.ongoing : false };
    try {
      if (mode === 'suggest') {
        const ok = await action({ action: 'suggestMovie', ...material, comment }, 'Предложение отправлено на рассмотрение 🎬');
        if (ok) close();
        else setError('Предложение не отправлено. Проверь поля и сообщение сервера; введённые данные сохранены в форме.');
        return;
      }
      const response = await fetch('/api/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(suggestion ? { action: 'approveSuggestion', id: suggestion.id, material } : { action: 'movieSave', id: film?.id, ...material })
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Ошибка сохранения материала');
        return;
      }

      notify(suggestion ? 'Предложение принято, материал опубликован' : film ? 'Материал обновлён' : 'Материал опубликован');

      close();

      if (result.movieId) {
        await onSaved(result.movieId);
      } else {
        notify('Сервер не вернул ID материала. Обнови каталог.');
      }
    } catch {
      setError('Ошибка соединения с сервером. Данные остались в форме, попробуй ещё раз.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const uploadTrailer = async (file?: File) => {
    if (!file || uploadPending.current || pending.current) return;
    if (!['video/mp4', 'video/webm'].includes(file.type) || !file.size || file.size > MAX_TRAILER_BYTES) {
      notify('Нужен MP4 или WebM, от 1 байта до 40 МБ');
      return;
    }
    uploadPending.current = true;
    setTrailerUploading(true);
    setError('');
    try {
      const response = await fetch('/api/trailers', {
        method: 'POST', headers: { 'Content-Type': file.type }, body: file,
      });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error || 'Ошибка загрузки');
      field('trailerUrl', result.url);
      notify('Трейлер загружен. Сохрани материал.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось загрузить трейлер');
    } finally {
      uploadPending.current = false;
      setTrailerUploading(false);
    }
  };
  return (
    <dialog className="material-editor-dialog" ref={dialog} aria-labelledby="material-editor-title" onCancel={event => { event.preventDefault(); requestClose(); }} onClick={event => { if (event.target === event.currentTarget) requestClose(); }}>
      <div
        className="glass-modal editor-modal"
        onClick={e => e.stopPropagation()}
      >
        <button type="button" aria-label="Закрыть форму материала" className="modal-close" disabled={busy || uploading || trailerUploading} onClick={requestClose}>
          <X size={20} />
        </button>

        <span className="eyebrow">{mode === 'suggest' ? 'ТВОЯ ИДЕЯ ДЛЯ КАТАЛОГА' : 'КУРАТОР КАТАЛОГА'}</span>
        <h2 id="material-editor-title">{mode === 'suggest' ? 'Предложить кино' : suggestion ? 'Проверка предложения' : film ? 'Редактировать историю' : 'Новая история'}</h2>
        <p>{mode === 'suggest' ? 'Заполни карточку как для каталога. После одобрения она станет материалом, а ты получишь уведомление. Одновременно — до 5 заявок.' : suggestion ? `Заявка от ${suggestion.author?.username || 'пользователя'}. Исправь данные перед публикацией. Материал и решение сохранятся вместе.` : 'Поля со звёздочкой обязательны.'}</p>
        {suggestion && !suggestion.material && <p className="suggestion-legacy">Это старая краткая заявка. Дополните обязательные поля — повторно отправлять её не нужно.</p>}
        {mode === 'suggest' && suggestions.length > 0 && <details className="my-suggestions"><summary>Мои предложения · {suggestions.filter(s => s.status === 'pending').length} на рассмотрении</summary>{suggestions.slice(0, 20).map(s => <div key={s.id}><b>{s.title} · {s.year}</b><span>{s.status === 'pending' ? 'На рассмотрении' : s.status === 'approved' ? 'Принято' : 'Отклонено'}</span>{s.reviewReason && <p>{s.reviewReason}</p>}{s.movieId && <a href={`/movie/${s.movieId}`}>Открыть материал →</a>}</div>)}</details>}
        <details className="material-preview"><summary>Предпросмотр карточки</summary><div><MaterialCover film={form} preview={false} className="editor-cover" alt="Предпросмотр постера" /><section><h3>{form.title || 'Название материала'}</h3><small>{form.category} · {form.year} · {form.duration} мин</small><p>{form.description || 'Здесь появится описание'}</p></section></div></details>

        <form onSubmit={submit} className="editor-form">
          <fieldset disabled={busy || uploading || trailerUploading} className="material-fields">

          <div className="form-two">
            <label>
              Название *
              <input
                required minLength={2} maxLength={150}
                value={form.title}
                onChange={e => field('title', e.target.value)}
              />
            </label>

            <label>
              Оригинальное название
              <input
                maxLength={200}
                value={form.originalTitle}
                onChange={e => field('originalTitle', e.target.value)}
              />
            </label>
          </div>

          <label>
            Описание *
            <textarea
              required
              rows={3} maxLength={3000} aria-label="Описание материала"
              value={form.description}
              onChange={e => field('description', e.target.value)}
            />
          </label>

          <div className="form-three">
            <label>
              Категория *
              <select
                value={form.category}
                onChange={e => field('category', e.target.value)}
              >
                {categories.slice(1).map(c => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>

            <label>
              {isSeries ? 'Год начала' : 'Год выпуска'}
              <input
                type="number"
                required
                min="1888"
                max="2100"
                value={form.year}
                onChange={e => field('year', Number(e.target.value))}
              />
            </label>

            <label>
  Возрастной рейтинг
  <input
    type="text"
    value={form.ageRating}
    onChange={e => field('ageRating', e.target.value)}
    placeholder="Например, 16+"
    maxLength={3}
    pattern="[0-9]{1,2}\+"
    title="Введите возрастной рейтинг в формате 0+, 6+, 12+, 16+ или 18+"
  />
</label>

            <label>
              Минуты
              <input
                type="number"
                min="1" max="10000" required
                value={form.duration}
                onChange={e => field('duration', Number(e.target.value))}
              />
            </label>

            <label>
              Серии
              <input
                type="number"
                min="0" max="100000" disabled={!isSeries}
                value={form.episodes}
                onChange={e => field('episodes', Number(e.target.value))}
              />
            </label>
          </div>

          {isSeries && (
            <div className="series-period-fields">
              <label className="series-ongoing-toggle">
                <input
                  type="checkbox"
                  checked={form.ongoing}
                  onChange={e => field('ongoing', e.target.checked)}
                />
                <span>Выходит сейчас</span>
              </label>

              {!form.ongoing && (
                <label>
                  Год окончания
                  <input
                    type="number"
                    min={form.year}
                    max="2100"
                    value={form.endYear}
                    placeholder="Например, 2024"
                    onChange={e =>
                      field(
                        'endYear',
                        e.target.value === '' ? '' : Number(e.target.value)
                      )
                    }
                  />
                  <small className="label-help">
                    Оставь пустым, если год окончания неизвестен
                  </small>
                </label>
              )}
            </div>
          )}

          <div className="form-two">
            <label>
              Настроение
              <select
                value={form.mood}
                onChange={e => field('mood', e.target.value)}
              >
                <option value="">Без настроения</option>
                {form.mood && !CATALOG_MOODS.some(item => item.id === form.mood) && <option value={form.mood}>{CATALOG_MOODS.find(item => item.id === parseCatalogMood(form.mood))?.label || form.mood}</option>}
                {CATALOG_MOODS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
          </div>

          <div className="form-two">
            <label>
              Жанры (через запятую)
              <input
                maxLength={200}
                value={form.genre}
                onChange={e => field('genre', e.target.value)}
              />
            </label>

            <label>
              Студия
              <input
                value={form.studio}
                onChange={e => field('studio', e.target.value)}
                placeholder="Warner Bros / MAPPA / Pixar"
              />
            </label>
          </div>

          <div className="form-two">
            <label>
              Режиссёр
              <input
                value={form.director}
                onChange={e => field('director', e.target.value)}
              />
            </label>

            <label>
              Страна
              <input
                value={form.country}
                onChange={e => field('country', e.target.value)}
              />
            </label>
          </div>

          <div className="form-two">
            <label>Франшиза<input value={form.franchise} maxLength={150} onChange={e => field('franchise', e.target.value)} placeholder="Marvel" /><small>Точное название. Для «Адвоката Marvel» укажи Marvel.</small></label>
            <label className="movie-festival-toggle"><input type="checkbox" checked={form.festivalRecognized} onChange={e => field('festivalRecognized', e.target.checked)} />Фестивальное кино<small>Редакционная отметка об участии или наградах на фестивалях.</small></label>
          </div>

          <label>
            Актёры
            <textarea value={form.cast} maxLength={4000} onChange={e => field('cast', e.target.value)} placeholder="Том Харди, Киллиан Мёрфи, Эмили Блант" />
            <small>Имена через запятую или с новой строки. Используются для кино-визиток.</small>
          </label>

          <div className="form-two">
            <label>
              Внешняя ссылка «Где посмотреть ещё»
              <input
                type="url"
                value={form.watchUrl}
                onChange={e => field('watchUrl', e.target.value)}
              />
            </label>
          </div>

          <div className="material-player-field">
            <label htmlFor="material-playback-url">Источник просмотра на сайте</label>
            <input id="material-playback-url" type="url" maxLength={4096} value={form.playbackUrl} onChange={e => field('playbackUrl', e.target.value)} placeholder="HTTPS: видео VK, Rutube или прямой MP4" aria-describedby="material-playback-help" />
            <small id="material-playback-help">Отдельно от трейлера и внешней ссылки. Только свои видео или контент с разрешением на показ. Вставляйте ссылку, не HTML-код. Видео хранится у источника; ссылка будет доступна посетителям. Не используйте секретные или временные персональные ссылки.</small>
            {form.playbackUrl && <small role="status">{playbackSource(form.playbackUrl) ? `Источник распознан: ${playbackSource(form.playbackUrl)!.provider}. Подключается только после согласия зрителя.` : 'Неподдерживаемый источник. Нужна ссылка на видео VK, Rutube или прямой MP4.'}</small>}
          </div>

          <div className="material-trailer-field">
            <label htmlFor="material-trailer-url">Трейлер</label>
            <input id="material-trailer-url" aria-describedby="material-trailer-help" type="url" value={form.trailerUrl} maxLength={4096} onChange={e => field('trailerUrl', e.target.value)} placeholder="HTTPS: MP4/WebM, YouTube, Rutube или VK embed" />
            <small id="material-trailer-help">Отдельно от ссылки на фильм. На компьютере — короткий предпросмотр без звука; на телефоне — кнопка «Трейлер». Rutube/VK открываются по кнопке, без фоновой загрузки.</small>
            {mode !== 'suggest' && <label className="upload-button">
              {trailerUploading ? 'Загрузка трейлера…' : 'Загрузить MP4 / WebM (до 40 МБ)'}
              <input type="file" accept="video/mp4,video/webm" disabled={trailerUploading} aria-label="Загрузить трейлер" onChange={e => {
                const file = e.target.files?.[0]; e.target.value = ''; void uploadTrailer(file);
              }} />
            </label>}
          </div>
          <label>
            Обложка *
            <span className="label-help">
              URL или загрузи файл
            </span>

            <div className="upload-input">
              <input
                required
                value={form.poster}
                onChange={e => field('poster', e.target.value)}
                placeholder="https://... или загрузить →"
              />

              <label className="upload-button">
                <Upload size={17} />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={e => void uploadImage('poster', e.target.files?.[0])}
                />
              </label>
            </div>
          </label>

          <label>
            Фоновое изображение
            <span className="label-help">
              URL или загрузи файл
            </span>

            <div className="upload-input">
              <input
                type="text"
                value={form.backdrop}
                onChange={e => field('backdrop', e.target.value)}
                placeholder="https://... или загрузить фон →"
              />

              <label
                className="upload-button"
                title="Загрузить фон"
              >
                <Upload size={17} />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={e => void uploadImage('backdrop', e.target.files?.[0])}
                />
              </label>
            </div>
          </label>

          {mode === 'suggest' && <label>Комментарий для редакции<textarea maxLength={1000} rows={3} value={comment} onChange={e => { dirty.current = true; setComment(e.target.value); }} placeholder="Почему стоит добавить или что нужно проверить (не публикуется в описании)" /></label>}
          </fieldset>
          {error && <p className="material-form-error" role="alert">{error}</p>}
          {uploading && <p role="status">Загружаем изображение…</p>}
          <button
            className="primary-btn auth-submit"
            disabled={busy || uploading || trailerUploading}
          >
            {busy ? 'Сохранение…' : mode === 'suggest' ? 'Отправить предложение' : suggestion ? 'Одобрить и открыть материал' : 'Сохранить материал'}
            <Check size={17} />
          </button>

        </form>
      </div>
    </dialog>
  );
}

function ViewUserProfile({ userId, data, go, action, openChat, auth }: { userId: number; data: Data; go: (s: string) => void; action: (p: Record<string, unknown>, s?: string) => Promise<boolean>; openChat: (id: number) => void; auth: () => void; }) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const relationship = data.friends.find(f=>(f.fromId===userId && f.toId===data.user?.id)||(f.toId===userId && f.fromId===data.user?.id));
  const relationshipKey = `${relationship?.id || ''}:${relationship?.status || ''}`;
  const retry = () => { setLoading(true); setReload(n=>n+1); };
  const changeFriendship = async () => {
    if (busy || !profile) return;
    setBusy(true);
    try {
      const incoming = profile.friendship.status==='pending' && profile.friendship.direction==='incoming';
      if (await action(incoming ? {action:'friendAccept',id:profile.friendship.id} : {action:'friend',userId},incoming?'Заявка принята':'Заявка отправлена')) setReload(n=>n+1);
    } finally { setBusy(false); }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/profile?id=' + userId, { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error(response.status===404 ? 'Пользователь не найден' : 'Не удалось загрузить профиль. Попробуй ещё раз.');
      const snapshot = await response.json();
      if (!controller.signal.aborted) { setProfile(snapshot.profile ? snapshot : null); setError(snapshot.profile ? '' : 'Пользователь не найден'); }
    }).catch(error => { if (!controller.signal.aborted) { setProfile(null); setError(error instanceof Error ? error.message : 'Не удалось загрузить профиль'); } }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [userId, data.user?.id, relationshipKey, reload]);

  if (loading) return <div className="empty-state" role="status"><h3>Загрузка профиля…</h3></div>;
  if (!profile) return <div className="empty-state" role="alert"><h3>{error || 'Не удалось загрузить профиль'}</h3><button className="outline-btn" onClick={retry}>Повторить</button><button className="primary-btn" onClick={() => go('/friends')}>Назад к друзьям</button></div>;

  const p = profile.profile;
  const s = profile.stats;
  const level = s.level;

  const commonFilms = profile.commonFilms ?? 0;

  return (
    <section className="public-profile" aria-label="Профиль участника">
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
              {p.displayTitle ? <UserTitleBadge title={p.displayTitle} /> : p.displayTitle !== null && <span className="title-badge">✦ {progressionTitle(s.uniqueFilms)}</span>}
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
              profile.friendship.direction === 'incoming' ? <button className="cover-edit" disabled={busy} onClick={changeFriendship}><UserPlus size={16}/>Принять заявку</button> : <span className="cover-edit" role="status">⏳ Заявка отправлена</span>
            ) : !profile.isSelf && data.user ? (
              <button className="cover-edit" disabled={busy} onClick={changeFriendship}><UserPlus size={16} /> Добавить в друзья</button>
            ) : !data.user ? (
              <button className="cover-edit" onClick={auth}>Войти</button>
            ) : null}
          </div>
        </div>
      </div>

      <React.Suspense fallback={null}><PublicCinemaPet key={p.id} userId={p.id} /></React.Suspense>
      <div className="profile-level-row">
        <div className="level-card">
          <div className="level-emblem"><Zap size={23} fill="currentColor" /></div>
          <div>
            <span>УРОВЕНЬ {level} · {progressionTitle(s.uniqueFilms)}</span>
            <div className="level-track" role="progressbar" aria-label="Опыт до следующего уровня" aria-valuemin={0} aria-valuemax={500} aria-valuenow={(p.xp || 0) % 500}><i style={{ width: `${((p.xp || 0) % 500) / 5}%` }} /></div>
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
              <div><span className="stat-icon pink-icon"><Flame size={18} /></span><b>{s.activeDays}</b><small>активных дней</small></div>
            </div>
          </div>

          <div className="profile-tile">
            <div className="tile-heading"><span><Sparkles size={18} /> Жанровые предпочтения</span></div>
            <div className="top-genres-list">
              {!s.topGenres.length && <div className="tile-empty">Пока нет просмотров для определения жанров.</div>}
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
              {[...profile.ratings].sort((a, b) => b.value - a.value).slice(0, 5).map((r, i) => (
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
                    <PosterThumb film={w.film!} movieId={w.film!.id} src={w.film!.poster} alt="" />
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
              <p className="muted" style={{ fontSize: 11 }}>Индекс сходства по текущим данным: {profile.compatibility}%</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ChatPage({ data, go, openChat, auth }: { data: Data; go: (s: string) => void; openChat: (id: number) => void; auth: () => void; }) {
  const [activePeer, setActivePeer] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [shareSearch, setShareSearch] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [inbox, loadInbox] = useJsonResource<{ conversations: ChatConversation[] }>(data.user ? '/api/chat' : null);
  const [conversation, loadThread] = useJsonResource<{ messages: ChatMessage[] }>(activePeer ? '/api/chat?with=' + activePeer : null);
  const conversations = inbox?.conversations || [];
  const thread = conversation?.messages || [];
  const lastMessageId = thread[thread.length - 1]?.id;
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [lastMessageId]);

  const sendMessage = async (movieId?: number) => {
    if (!activePeer) return;
    if (!text.trim() && !movieId) return;
    setSending(true);
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toId: activePeer, text: text.trim() || '', movieId: movieId || null }) });
      if (!response.ok) return;
      setText(''); setShareOpen(false); loadThread(); loadInbox();
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
                          <PosterThumb film={m.film!} movieId={m.film!.id} src={m.film!.poster} alt="" />
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
                          <PosterThumb film={f} movieId={f.id} src={f.poster} alt="" />
                          <div><b>{f.title}</b><small>{f.year} · ★ {formatFilmRating(f)}</small></div>
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
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareSearch, setShareSearch] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const peer = data.people.find(p => p.id === peerId);

  const [conversation, loadThread] = useJsonResource<{ messages: ChatMessage[] }>('/api/chat?with=' + peerId);
  const thread = conversation?.messages || [];
  const lastMessageId = thread[thread.length - 1]?.id;
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [lastMessageId]);

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
                  <PosterThumb film={m.film!} movieId={m.film!.id} src={m.film!.poster} alt="" />
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
                  <PosterThumb film={f} movieId={f.id} src={f.poster} alt="" />
                  <div><b>{f.title}</b><small>★ {formatFilmRating(f)}</small></div>
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
  const [compareError, setCompareError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    // Reset for a newly mounted comparison; failed requests must not spin forever.
    fetch('/api/profile?id=' + compareId, { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error();
      const snapshot = await response.json();
      if (!controller.signal.aborted) { setCompData(snapshot.profile ? snapshot : null); setCompareError(!snapshot.profile); }
    }).catch(() => { if (!controller.signal.aborted) { setCompData(null); setCompareError(true); } });
    return () => controller.abort();
  }, [compareId]);

  if (!data.user) return <Gate title="Битва вкусов" description="Войди, чтобы сравнить свои вкусы с друзьями." auth={auth} />;
  if (!compData) return <div className="empty-state">{compareError ? 'Не удалось загрузить сравнение. Проверь подключение или выбери другого пользователя.' : 'Загрузка...'}</div>;

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
            <PosterThumb film={d.film || undefined} movieId={d.film?.id} src={d.film?.poster} alt="" />
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
            <PosterThumb film={d.film || undefined} movieId={d.film?.id} src={d.film?.poster} alt="" />
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

/* ============================================
   moviemovie WRAPPED 2.0 + SHARE STUDIO
============================================ */

function WrappedPage({
  data,
  go,
  auth,
}: {
  data: Data;
  go: (s: string) => void;
  auth: () => void;
}) {
  const [shareData, setShareData] = useState<WrappedData | null>(null);

  if (!data.user) {
    return (
      <Gate
        title="Итоги Киногода"
        description="Твой год в кино заслуживает отдельной истории. Войди в аккаунт, чтобы увидеть персональный Wrapped."
        auth={auth}
      />
    );
  }

  return (
    <>
      <WrappedExperience
        onClose={() => go('/profile')}
        onShare={(wrappedData) => {
          setShareData(wrappedData);
        }}
      />

      {shareData && (
        <WrappedShare
          data={shareData}
          onClose={() => setShareData(null)}
        />
      )}
    </>
  );
}

function CollabLists({ data, go, action, auth }: { data: Data; go: (s: string) => void; action: (p: Record<string, unknown>, s?: string) => Promise<boolean>; auth: () => void; }) {
  if (!data.user) return <Gate title="Совместные подборки" description="Создавай списки и выбирай фильмы вместе с друзьями." auth={auth} />;
  return <CollaborativeCollections films={data.films} lists={data.lists || []} go={go} action={action} />;
}

function WatchRoom({ roomId, data, go, action, auth }: { roomId: string; data: Data; go: (s: string) => void; action: (p: Record<string, unknown>) => Promise<boolean>; auth: () => void; }) {
  const [videoUrl, setVideoUrl] = useState('');
  const [activeEmbed, setActiveEmbed] = useState('');
  const [playerError, setPlayerError] = useState('');
  const [chatLog, setChatLog] = useState<{ id: number, user: string, text: string }[]>([]);
  const [chat, setChat] = useState('');
  const [reactions, setReactions] = useState<{ id: number, emoji: string }[]>([]);
  const msgRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();

  const film = data.films.find(f => f.id === Number(searchParams.get('movie'))) || data.films[0] || null;

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
    const embed = playerEmbedUrl(videoUrl);
    if (!embed) { setPlayerError('Нужна HTTPS-ссылка YouTube, RuTube или VK video_ext.php. Произвольные страницы не поддерживаются.'); return; }
    setPlayerError('');
    setActiveEmbed(embed);
  };

  if (!film) return <div className="empty-state"><Sparkles size={40} /><h3>Подготовка зала...</h3><p>Устанавливаем связь с кинотеатром</p></div>;

  return (
    <>
      <div className="page-heading" style={{ marginBottom: 10 }}>
        <div><span className="eyebrow"><Tv2 size={14} /> КИНОЗАЛ · КОД: {roomId}</span><h1 style={{ fontSize: 24, margin: '5px 0 0' }}>{film.title}</h1></div>
        <button className="outline-btn small" onClick={() => go('/watchroom')}>← Выйти из зала</button>
      </div>

      <p className="collectible-note" role="note">Локальный предпросмотр: видео, сообщения и реакции видны только в этой вкладке. Общая комната и синхронизация между зрителями пока не реализованы. Для переписки используй раздел «Чат».</p>
      <div className="room-layout">
        <div className="room-player">
          <div className="room-video-area">
            {!activeEmbed ? (
              <div className="room-setup-prompt">
                <MonitorPlay size={48} />
                <h3>Вставьте ссылку на плеер</h3>
                <p>Поддерживаются HTTPS-ссылки YouTube, VK video_ext.php и RuTube.</p>
                <div className="room-url-input">
                  <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
                  <button className="primary-btn" onClick={applyVideo}>Запустить <Play size={14} /></button>
                </div>
                {playerError && <p role="alert">{playerError}</p>}
                <span className="room-disclaimer">Плеер запускается локально; синхронизации с другими вкладками нет.</span>
              </div>
            ) : (
              <iframe
                src={activeEmbed}
                title="Локальный предпросмотр плеера"
                sandbox="allow-scripts allow-same-origin allow-presentation"
                referrerPolicy="strict-origin-when-cross-origin"
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
            <div className="chat-empty-thread" style={{ marginBottom: 20 }}><Sparkles size={20} /><p>Локальная сессия {roomId}.<br />Сообщения здесь не отправляются другим зрителям.</p></div>
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
    { id: 'profile', icon: <Users size={20} />, color: 'blue', title: 'Личный кабинет', subtitle: 'Кастомизируемый профиль с прогрессией', items: ['5 уникальных шаблонов шапки профиля', '4 рамки аватара: Золото (500 XP), Неон (1500 XP), Аметист (2500 XP)', '4 рамки шапки профиля с теми же условиями', 'Загрузка аватара: JPG, PNG, WebP до 4 МБ', 'Перетаскиваемые живые виджеты (drag and drop)', '5 виджетов: Статистика, Категории, История, Достижения, Друзья', 'XP-система: 500 XP = 1 уровень', 'Начисление XP: просмотр +35, оценка +10, комментарий +15; игры — тренировочные, без XP', 'Прогресс-бар уровня в профиле', 'Отображение стрика активных дней'] },
    { id: 'social', icon: <Users size={20} />, color: 'green', title: 'Социальные функции', subtitle: 'Сообщество, дружба и общение', items: ['Система друзей: заявки, принятие, отклонение', 'Личный чат: переписка между друзьями в реальном времени', 'SSE-инвалидации для обновления переписки', 'Поделиться фильмом в чате (прикреплённая карточка)', 'Плавающий Chat Drawer из любого места сайта', 'Страница сравнения /compare/:id — «Кино-Баттл»', 'Просмотр публичных профилей: /user/:id', 'Процент кино-совместимости (алгоритм: просмотры + оценки + жанры)', 'Уведомления: ответ на комментарий, лайк, заявка в друзья, рекомендация', 'Рекомендация фильма другу из карточки или чата', 'Счётчик непрочитанных сообщений в навигации'] },
    { id: 'stats', icon: <BarChart3 size={20} />, color: 'pink', title: 'Статистика и аналитика', subtitle: 'Детальная картина активности', items: ['Общее количество просмотров, уникальных историй, часов', 'Разбивка по 6 категориям материалов с минутами', 'Топ-жанры пользователя с прогресс-барами', 'История просмотров с датами и деталями', 'Лидерборд: 6 метрик (часы, просмотры, стрик, XP, оценки, игры)', 'Пьедестал почёта с визуализацией трёх лидеров', 'Статистика активности друзей в профиле', 'Общие фильмы с конкретным другом', 'Сравнение оценок: споры и совпадения', 'Итоги месяца (Monthly Wrap-Up)', 'Итоги года moviemovie Wrapped (5 слайдов)'] },
    { id: 'games', icon: <Gamepad2 size={20} />, color: 'violet', title: 'Мини-игры', subtitle: '16 режимов в тематике кино', items: ['Угадай по сюжету — описание → название', 'Год премьеры — выбор из 4 вариантов', 'Кто режиссёр — режиссёр фильма', 'Жанровый детектив — жанр по названию', 'Угадай по постеру — название по обложке', 'Хронометраж — длительность фильма', 'Карта кино — страна производства', 'Оригинальное название — перевод названия', 'Тип истории — категория материала', 'Рейтинговая битва — у кого оценка выше', '🟩 Кино-Вордли — угадай по подсказкам', '🔡 Поле Чудес — по буквам', '🔀 Анаграмма — собери буквы', '🤥 Две правды, одна ложь — найди фальшивый факт', '⏳ Хроно-Слайдер — хронология фильмов', '🧩 Кино-Связи — группы по признаку', '5 вопросов за сессию, история тренировок без XP'] },
    { id: 'gamification', icon: <Trophy size={20} />, color: 'amber', title: 'Геймификация', subtitle: 'Достижения, челленджи, прогрессия', items: ['33 достижения: Бронза, Серебро, Золото и Платина', 'Тиры открываются прогрессивно по порогу прогресса', 'Ежемесячные челленджи — по 3–5 на каждый месяц года', 'Разнообразие: жанровые, категорийные, социальные, ночные, скоростные', 'Прогресс-бар челленджа с процентом выполнения', 'Страница /challenges с навигацией по всем 12 месяцам', 'Сводная панель: выполнено / XP заработано / всего закрыто', 'Season Pass с миссиями', 'Коллаборативные подборки с голосованием'] },
    { id: 'discovery', icon: <Compass size={20} />, color: 'blue', title: 'Виджеты и контент', subtitle: 'Умные рекомендации и память', items: ['Кино-День: тематический фильтр по дате календаря', '«В этот день» — ретроспектива просмотров и юбилеев фильмов', 'Виджет «Капсула времени» — случайный день из истории', 'Итоги прошлого месяца в профиле', 'Рулетка материалов — анимированный выбор случайного фильма', 'Пульс недели: лучший, худший, новинка, высокий рейтинг', 'Лента «Что сейчас смотрят» по просмотрам', 'Лента «Свежие находки» по году', 'Похожие фильмы на странице материала по жанру', 'Виджет челленджей на главной', 'Сезонный Pass-виджет'] },
    { id: 'tech', icon: <BarChart3 size={20} />, color: 'green', title: 'Техническая архитектура', subtitle: 'Стек и устройство системы', items: ['Next.js 16 App Router — SSR + клиентские компоненты', 'PostgreSQL + Drizzle ORM — типобезопасные запросы', '31 таблица БД: users, movies, watches, ratings, comments, reactions, bookmarks, friendships, notifications, messages, challenges...', 'JWT-сессии: jose + httpOnly cookie', 'bcryptjs для паролей (стойкость 12)', 'Единый интерфейс moviemovie на React', 'REST API: /api/auth, /api/data, /api/action, /api/chat, /api/profile, /api/upload, /api/visit, /api/oauth', 'Загрузка изображений в Supabase Storage; в PostgreSQL только URL', 'Подсчёт совместимости: взвешенный алгоритм (40% просмотры + 30% рейтинги + 30% жанры)', 'SSE: приватные события чата/друзей и обновления Кинопульса, восстановление соединения'] },
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
    { label: 'Storage', value: 'Supabase Storage', sub: 'В БД только URL' },
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
        <div className="about-section-label"><span className="eyebrow"><Globe2 size={13} /> АККАУНТ В <span className="brand-name">moviemovie</span></span></div>
        <p>Создай аккаунт через регистрацию. Права редактора и модератора назначает администратор. Для входа используй собственные учётные данные.</p>
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
                  <PosterThumb film={f} movieId={f.id} src={f.poster} alt="" />
                  <span>{f.title}</span>
                  {selected?.id === f.id && <Check size={14} />}
                </button>
              ))}
            </div>
          </div>

          {selected && (
            <div className="wrc-selected">
              <PosterThumb film={selected} movieId={selected.id} src={selected.poster} alt="" />
              <div><b>{selected.title}</b><small>{selected.year} · {selected.category} · {selected.duration} мин</small></div>
            </div>
          )}

          <button
            className="primary-btn wrc-start"
            onClick={() => {
              if (!selected) return;
              const code = Math.random().toString(36).slice(2, 8).toUpperCase();
              const url = window.location.origin + '/room/' + code + '?movie=' + selected.id;
              setRoomLink(url);
              void copyText(url);
              go(`/room/${code}?movie=${selected.id}`);
            }}
            disabled={!selected}
          >
            <Tv2 size={18} />{selected ? `Открыть зал «${selected.title.slice(0, 20)}...»` : 'Сначала выбери фильм'}
          </button>

          {roomLink && <div className="wrc-link-box"><Link2 size={15} /><span>{roomLink}</span><button onClick={() => copyText(roomLink)}><Copy size={14} /></button></div>}
          <p className="wrc-hint">Локальный предпросмотр не синхронизирует видео и сообщения. Ссылка сохраняет выбранный фильм.</p>
        </div>

        <div className="watchroom-join-card">
          <div className="wrc-header"><span className="wrc-icon join-icon"><UsersRound size={22} /></span><div><h3>Войти в комнату</h3><p>Введи код комнаты от друга</p></div></div>
          <div className="wrc-join-form">
            <label>Код комнаты<input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))} placeholder="XXXXXX" maxLength={6} /></label>
            <button className="primary-btn" disabled={joinCode.length < 4} onClick={() => go('/room/' + joinCode + '?movie=1')}><ArrowRight size={17} /> Войти в зал</button>
          </div>

          <div className="wrc-how">
            <span className="eyebrow">КАК ЭТО РАБОТАЕТ</span>
            <div className="wrc-steps">
              <div><span>1</span><p>Один создаёт комнату и выбирает фильм</p></div>
              <div><span>2</span><p>Копирует ссылку и отправляет другу</p></div>
              <div><span>3</span><p>Плеер работает локально; общий таймер пока недоступен</p></div>
              <div><span>4</span><p>Для общей переписки используйте раздел «Чат»</p></div>
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
  const [selectedMonth, setSelectedMonth] = useState(new Date().getUTCMonth() + 1);
  const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const currentMonth = new Date().getUTCMonth() + 1;

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

      <p className="collectible-note">Редкость и процент выполнения рассчитаны среди всех зарегистрированных пользователей за {data.challenges[0]?.year || new Date().getUTCFullYear()} год. Повторные записи одного участника не увеличивают процент.</p>

      <div className="challenge-month-tabs" role="group" aria-label="Месяц челленджей">
        {months.map((m, i) => (
          <button type="button" aria-pressed={selectedMonth === i + 1} key={i} className={`challenge-month-tab ${selectedMonth === i + 1 ? 'active' : ''} ${i + 1 === currentMonth ? 'current' : ''}`} onClick={() => setSelectedMonth(i + 1)}>
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
              <OwnershipBadge stats={c.community} completed />
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
