export const MATERIAL_TOP_LIMITS = [10, 50, 100] as const;
export type MaterialTopLimit = (typeof MATERIAL_TOP_LIMITS)[number];
export type MaterialMetric = 'rating' | 'views' | 'favorites';
export const MATERIAL_CATEGORIES = ['Все', 'Фильм', 'Сериал', 'Мультфильм', 'Мультсериал', 'Аниме-сериал', 'Аниме-фильм'] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];
export type MaterialTopOptions = { metric: MaterialMetric; category: MaterialCategory; limit: MaterialTopLimit };

type RankableMaterial = { id: number; category: string; rating: number; ratingCount: number; views: number | null; favoriteCount?: number };

export function parseMaterialTopOptions(params: { get(name: string): string | null }): MaterialTopOptions {
  const rawLimit = params.get('limit');
  const category = params.get('category');
  return {
    metric: params.get('metric') === 'favorites' ? 'favorites' : params.get('metric') === 'views' ? 'views' : 'rating',
    limit: MATERIAL_TOP_LIMITS.find(limit => String(limit) === rawLimit) ?? 10,
    category: MATERIAL_CATEGORIES.find(value => value === category) ?? 'Все',
  };
}

export function materialTopUrl(options: MaterialTopOptions) {
  const params = new URLSearchParams({ metric: options.metric, limit: String(options.limit) });
  if (options.category !== 'Все') params.set('category', options.category);
  return `/top?${params}`;
}

export function rankMaterials<T extends RankableMaterial>(materials: readonly T[], options: MaterialTopOptions) {
  // Unrated/unwatched/unfavorited entries cannot win a ranking without a real signal.
  // Secondary keys give ties an explicit, deterministic order without mutating the catalog.
  const eligible = materials.filter(material =>
    (options.category === 'Все' || material.category === options.category) &&
    (options.metric === 'rating'
      ? material.ratingCount > 0 && Number.isFinite(material.rating) && material.rating > 0
      : options.metric === 'favorites'
        ? Number.isFinite(material.favoriteCount) && (material.favoriteCount ?? 0) > 0
        : Number.isFinite(material.views) && (material.views ?? 0) > 0),
  );
  eligible.sort((a, b) => options.metric === 'rating'
    ? b.rating - a.rating || b.ratingCount - a.ratingCount || (b.views ?? 0) - (a.views ?? 0) || a.id - b.id
    : options.metric === 'favorites'
      ? (b.favoriteCount ?? 0) - (a.favoriteCount ?? 0) || b.rating - a.rating || b.ratingCount - a.ratingCount || (b.views ?? 0) - (a.views ?? 0) || a.id - b.id
      : (b.views ?? 0) - (a.views ?? 0) || b.rating - a.rating || b.ratingCount - a.ratingCount || a.id - b.id);
  return { materials: eligible.slice(0, options.limit), eligibleCount: eligible.length };
}
