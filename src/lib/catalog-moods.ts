// Editorial mood labels take precedence. Genre fallback is explicit, not an AI claim.
export const CATALOG_MOODS = [
  { id: 'popcorn', label: '🍿 Попкорновый аттракцион', en: '🍿 Popcorn ride', pattern: /попкорн|аттракцион|popcorn|приключен|adventure|боевик|action|комеди|comedy/iu },
  { id: 'mind', label: '🧠 Вскипятить мозги', en: '🧠 Mind-bending', pattern: /мозг|головолом|mind|детектив|detective|mystery|фантаст|sci-fi/iu },
  { id: 'tears', label: '😭 Поплакать', en: '😭 A good cry', pattern: /поплакать|слез|слёз|tears|драм|drama|мелодрам/iu },
  { id: 'night', label: '🌃 Эстетика ночи', en: '🌃 Night aesthetics', pattern: /ноч|неон|нуар|night|neon|noir|киберпанк|cyberpunk/iu },
  { id: 'cozy', label: '☕ Уютный вечер', en: '☕ Cozy evening', pattern: /уют|cozy|семейн|family/iu },
  { id: 'grip', label: '🦖 На одном дыхании', en: '🦖 Edge of your seat', pattern: /дыхани|напряж|grip|триллер|thriller|ужас|horror/iu },
] as const;
export type CatalogMood = 'all' | (typeof CATALOG_MOODS)[number]['id'];
export function parseCatalogMood(value: string | null): CatalogMood {
  const legacy: Record<string, string> = { cry: 'tears', 'mind-blowing': 'mind', 'fast-paced': 'grip' };
  return CATALOG_MOODS.find(mood => mood.id === (value && (legacy[value] || value)))?.id ?? 'all';
}
export function matchesCatalogMood(film: { mood?: string | null; genre: string }, mood: CatalogMood) {
  if (mood === 'all') return true;
  const editorial = parseCatalogMood(film.mood?.trim().toLowerCase() || null);
  if (editorial !== 'all') return editorial === mood;
  const definition = CATALOG_MOODS.find(item => item.id === mood);
  return !!definition && (film.mood?.toLowerCase() === mood || definition.pattern.test(film.mood?.trim() || film.genre));
}
