import { notFound } from 'next/navigation';
import { resolveSiteRoute } from '@/lib/site-routes';
import type { Metadata } from 'next';
import { getOverview, db, users, eq } from '@/lib/data';
import MovieGoApp from '@/components/movie-go-app';

export const dynamic = 'force-dynamic';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://moviemovie.ru';

type PageProps = {
  params: Promise<{
    slug: string[];
  }>;
};

// [SEO:METADATA] Dynamic Open Graph for movie pages
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;

  if (slug?.[0] === 'world') return { title: 'Кино-карта мира | moviemovie', description: 'Исследуй кино по странам производства. Цветная карта каталога и личная география просмотров.', alternates: { canonical: `${SITE_URL}/world` } };

  if (slug?.[0] === 'top') {
    return {
      title: 'Лучшие материалы — топ-10, 50 и 100 | moviemovie',
      description: 'Лучшие фильмы, сериалы, мультфильмы и аниме по оценкам пользователей, просмотрам и добавлениям в любимое на moviemovie.',
      alternates: { canonical: `${SITE_URL}/top` },
    };
  }

  // Только страницы /movie/{id}
  if (slug?.[0] !== 'movie' || !slug[1]) {
    return {
      title: 'moviemovie — твоя киновселенная',
      description:
        'Смотри, отмечай и оценивай фильмы, сериалы и аниме на moviemovie.',
    };
  }

  const movieId = Number(slug[1]);

  if (!Number.isInteger(movieId) || movieId <= 0) {
    return {
      title: 'Фильм не найден — moviemovie',
    };
  }

  const films = await getOverview();

  const film = films.find(f => f.id === movieId);

  if (!film) {
    return {
      title: 'Фильм не найден — moviemovie',
    };
  }

  const title = `${film.title} — moviemovie`;

  const description = [
    `${film.title} (${film.year})`,
    film.category,
    film.genre,
    film.description,
  ]
    .filter(Boolean)
    .join(' · ')
    .slice(0, 240);

  const url = `${SITE_URL}/movie/${film.id}`;

  const poster = film.poster
    ? film.poster.startsWith('http')
      ? film.poster
      : `${SITE_URL}${film.poster.startsWith('/') ? '' : '/'}${film.poster}`
    : undefined;

  return {
    title,
    description,

    alternates: {
      canonical: url,
    },

    openGraph: {
      type: 'website',
      locale: 'ru_RU',
      siteName: 'moviemovie',
      title,
      description,
      url,
      images: poster
        ? [
            {
              url: poster,
              alt: `Постер фильма ${film.title}`,
            },
          ]
        : [],
    },

    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: poster ? [poster] : [],
    },
  };
}

// [PAGE:ROUTES] Direct links to catalog, profiles, games, and film details.
export default async function RoutedPage({ params }: PageProps) {
  const { slug } = await params;
  const route = resolveSiteRoute('/' + slug.join('/'));
  if (!route) notFound();
  if (route.page === 'viewuser' || route.page === 'compare') {
    const [person] = await db.select({ id: users.id }).from(users).where(eq(users.id, route.id!)).limit(1);
    if (!person) notFound();
  }
  const films = await getOverview();
  if (route.page === 'movie' && !films.some(film => film.id === route.id)) notFound();

  return <MovieGoApp initialFilms={films} />;
}
