'use client';

import { useMemo } from 'react';
import { Clapperboard, Sparkles, Star, Users } from 'lucide-react';
import { AnimatedNumber } from './animated-number';

export default function HeaderStats({
  films,
  peopleCount,
  watchesCount,
  en,
}: {
  films: readonly { rating: number }[];
  peopleCount: number;
  watchesCount: number | null;
  en: boolean;
}) {
  const averageRating = useMemo(
    () => films.length ? films.reduce((sum, film) => sum + film.rating, 0) / films.length : 0,
    [films],
  );
  const stats = [
    { key: 'library', icon: Clapperboard, label: en ? 'in library' : 'в каталоге', title: en ? 'Stories in the library' : 'Историй в каталоге', value: films.length, decimals: 0 },
    { key: 'rating', icon: Star, label: en ? 'avg. rating' : 'ср. рейтинг', title: en ? 'Average rating' : 'Средний рейтинг', value: averageRating, decimals: 1 },
    { key: 'people', icon: Users, label: en ? 'members' : 'зрителей', title: en ? 'Movie lovers' : 'Кинолюбителей', value: peopleCount, decimals: 0 },
    { key: 'watches', icon: Sparkles, label: watchesCount === null ? (en ? 'to discover' : 'впереди') : (en ? 'watched' : 'просмотрено'), title: watchesCount === null ? (en ? 'Moments ahead' : 'Впечатлений впереди') : (en ? 'Your watches' : 'Твоих просмотров'), value: watchesCount, decimals: 0 },
  ];

  return (
    <dl className="header-stats" aria-label={en ? 'MovieMovie statistics' : 'Статистика moviemovie'}>
      {stats.map(({ key, icon: Icon, label, title, value, decimals }) => (
        <div className={`header-stat header-stat--${key}`} key={key} title={title}>
          <dt>
            <span className="header-stat-icon" aria-hidden="true"><Icon size={15} /></span>
            {label}
          </dt>
          <dd>{value === null ? '∞' : <AnimatedNumber value={value} decimals={decimals} duration={1000} />}</dd>
        </div>
      ))}
    </dl>
  );
}
