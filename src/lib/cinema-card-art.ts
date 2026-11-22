import type { CinemaCardData } from './cinema-card';
import { formatOwnershipPercentage, RARITIES } from './ownership';

export const CINEMA_CARD_THEMES = {
  aurora: { label: 'Аврора', background: '#0d101b', panel: '#171d30', ink: '#f5f4ff', muted: '#a5adc8', accent: '#b69aff', second: '#6de2d2' },
  premiere: { label: 'Премьера', background: '#16120f', panel: '#252019', ink: '#fff8e9', muted: '#bdb09a', accent: '#f1ca82', second: '#ea967e' },
  paper: { label: 'Светлая', background: '#eeeae4', panel: '#fcfaf7', ink: '#242137', muted: '#69657d', accent: '#7553be', second: '#237e78' },
} as const;
export type CinemaCardTheme = keyof typeof CINEMA_CARD_THEMES;
export type CinemaCardFormat = 'square' | 'story';
export function cinemaCardDimensions(format: CinemaCardFormat) {
  return { width: 1080, height: format === 'story' ? 1920 : 1080 };
}
export function escapeCardXml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!);
}

function short(value: string, limit: number) {
  const characters = [...value];
  return characters.length > limit ? characters.slice(0, limit - 1).join('') + '…' : value;
}

/** Self-contained artwork: no remote assets, user HTML or CSS are included. Same SVG drives preview and PNG. */
export function renderCinemaCardSvg(card: CinemaCardData, options: {
  theme: CinemaCardTheme;
  format: CinemaCardFormat;
  logoData?: string;
  profileUrl: string;
}) {
  const theme = CINEMA_CARD_THEMES[options.theme];
  const { width, height } = cinemaCardDimensions(options.format);
  const story = options.format === 'story';
  const xml = escapeCardXml;
  const number = (value: number) => value.toLocaleString('ru-RU');
  const text = (value: string, x: number, y: number, size = 24, color: string = theme.ink, weight = 500, extra = '') =>
    `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}" ${extra}>${xml(value)}</text>`;
  const panel = (x: number, y: number, w: number, h: number, accent = false) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="28" fill="${theme.panel}" stroke="${accent ? theme.accent : theme.muted}" stroke-opacity="${accent ? '.5' : '.15'}"/>`;
  const label = (value: string, x: number, y: number) => text(value, x, y, 17, theme.muted, 700, 'letter-spacing="3"');
  const crown = (x: number, y: number, scale = 1) => `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="${theme.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7l5 4 5-8 5 8 5-4-3 13H5L2 7z"/><path d="M6 24h12"/></g>`;
  const timeY = story ? 330 : 270;
  const genresY = story ? 610 : 470;
  const actorY = story ? 1050 : genresY;
  const crownY = story ? 1340 : 770;
  const genresW = story ? 960 : 556;
  const actorX = story ? 60 : 640;
  const actorW = story ? 960 : 380;
  const genreRows = card.topGenres.map((genre, i) => {
    const y = genresY + 94 + i * (story ? 94 : 64);
    return text(`0${i + 1}`, 90, y, 18, theme.accent, 700) +
      text(short(genre.name, story ? 38 : 20), 130, y, story ? 29 : 23, theme.ink, 700) +
      text(`${genre.percentage}%`, 60 + genresW - 30, y, 19, theme.muted, 500, 'text-anchor="end"') +
      `<rect x="130" y="${y + 15}" width="${genresW - 160}" height="5" rx="2.5" fill="${theme.muted}" opacity=".14"/>` +
      `<rect x="130" y="${y + 15}" width="${Math.max(0, (genresW - 160) * genre.percentage / 100)}" height="5" rx="2.5" fill="${i === 0 ? theme.accent : theme.second}"/>`;
  }).join('');
  const actorInitials = card.topActor?.name.split(' ').filter(Boolean).slice(0, 2).map(name => [...name][0]).join('').toUpperCase() || '?';
  const actorName = card.topActor?.name || 'Пока неизвестен';
  const actorLines = story ? [short(actorName, 35)] : actorName.length > 18 ? [short(actorName.split(' ').slice(0, -1).join(' ') || actorName, 18), short(actorName.split(' ').at(-1) || '', 18)] : [actorName];
  const c = card.crown;
  const crownRarity = c?.stats.rarity ? RARITIES[c.stats.rarity].label : '';
  const profile = options.profileUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const logo = options.logoData?.startsWith('data:image/png;base64,') ? `<image href="${options.logoData}" x="60" y="${story ? 75 : 40}" width="145" height="58" preserveAspectRatio="xMidYMid meet"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
    <title>${xml(`Кино-визитка ${card.username}`)}</title>
    <defs><radialGradient id="glow"><stop stop-color="${theme.accent}" stop-opacity=".24"/><stop offset="1" stop-color="${theme.accent}" stop-opacity="0"/></radialGradient><linearGradient id="line"><stop stop-color="${theme.accent}"/><stop offset="1" stop-color="${theme.second}"/></linearGradient></defs>
    <rect width="1080" height="${height}" fill="${theme.background}"/>
    <ellipse cx="1000" cy="100" rx="650" ry="650" fill="url(#glow)"/>
    <path d="M760 0L1080 320M840 0L1080 240M0 ${height - 230}L230 ${height}" stroke="${theme.muted}" stroke-opacity=".1" fill="none"/>
    <g font-family="Arial, sans-serif">
      ${logo}
      ${text('ЛИЧНОЕ ДЕЛО КИНОМАНА', 1020, story ? 110 : 78, 16, theme.muted, 700, 'text-anchor="end" letter-spacing="3"')}
      ${label('МОЯ КИНО-ВИЗИТКА', 60, story ? 212 : 155)}
      ${text(short(card.username, 30), 60, story ? 285 : 226, card.username.length > 21 ? 48 : 58, theme.ink, 800)}
      ${panel(60, timeY, 960, story ? 230 : 164, true)}
      ${label('ВРЕМЯ В ДРУГИХ МИРАХ', 90, timeY + 42)}
      ${text(`${number(Math.floor(card.totalMinutes / 60))} ч`, 90, timeY + (story ? 145 : 113), story ? 82 : 64, theme.ink, 800)}
      ${text(`${card.totalMinutes % 60} мин`, 90, timeY + (story ? 190 : 142), 21, theme.muted)}
      <path d="M780 ${timeY + 35}v${story ? 158 : 100}" stroke="${theme.muted}" stroke-opacity=".18"/>
      ${text(number(card.uniqueTitles), 900, timeY + (story ? 125 : 90), 50, theme.accent, 800, 'text-anchor="middle"')}
      ${text('историй', 900, timeY + (story ? 165 : 123), 20, theme.muted, 500, 'text-anchor="middle"')}
      ${panel(60, genresY, genresW, story ? 390 : 270)}
      ${label('МОИ ТОП-3 ЖАНРА', 90, genresY + 42)}
      ${genreRows || text('Истории ещё впереди', 90, genresY + 110, 25, theme.muted)}
      ${panel(actorX, actorY, actorW, story ? 240 : 270)}
      ${label('МОЙ АКТЁР', actorX + 30, actorY + 42)}
      <circle cx="${actorX + (story ? 90 : 62)}" cy="${actorY + (story ? 124 : 97)}" r="${story ? 38 : 25}" fill="${theme.accent}" fill-opacity=".14"/>
      ${text(actorInitials, actorX + (story ? 90 : 62), actorY + (story ? 134 : 105), story ? 25 : 19, theme.accent, 700, 'text-anchor="middle"')}
      ${actorLines.map((line, i) => text(line, actorX + (story ? 155 : 30), actorY + (story ? 120 : 163) + i * 31, story ? 36 : 25, theme.ink, 700)).join('')}
      ${text(card.topActor ? `${card.topActor.count} просмотров с участием` : 'Состав пока не заполнен', actorX + (story ? 155 : 30), actorY + (story ? 162 : 235), story ? 23 : 17, theme.muted)}
      ${text(`Состав известен: ${card.castCoverage.known} из ${card.castCoverage.total}`, actorX + (story ? 155 : 30), actorY + (story ? 198 : 257), story ? 18 : 13, theme.muted)}
      ${panel(60, crownY, 960, story ? 365 : 190, true)}
      ${crown(90, crownY + 31, 1.1)}
      ${label('КОРОННАЯ АЧИВКА', 135, crownY + 51)}
      ${text(c ? short(c.name, 34) : 'Твоя легенда начинается', 90, crownY + (story ? 142 : 106), story ? 47 : 37, theme.ink, 800)}
      ${text(c ? `${crownRarity} · ${c.hidden ? 'Скрытый трофей' : `Тир ${['I', 'II', 'III'][c.tier - 1]}`} · ${formatOwnershipPercentage(c.stats.percentage)} пользователей` : 'Открой достижение — и оно появится здесь', 90, crownY + (story ? 200 : 147), story ? 27 : 22, theme.accent, 600)}
      ${story ? text('Мой вкус. Мои истории. Моя киновселенная.', 90, crownY + 289, 25, theme.muted) : ''}
      <rect x="60" y="${height - 83}" width="960" height="2" fill="url(#line)" opacity=".5"/>
      ${text(short(profile, 65), 60, height - 37, 18, theme.muted)}
      ${text('У КАЖДОГО СВОЁ КИНО', 1020, height - 37, 14, theme.muted, 700, 'text-anchor="end" letter-spacing="2"')}
    </g>
  </svg>`;
}
