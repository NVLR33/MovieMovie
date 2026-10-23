import type { Metadata } from 'next';
import { getOverview } from '@/lib/data';
import MovieGoApp from '@/components/movie-go-app';

export const dynamic = 'force-dynamic';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://moviego-gamma.vercel.app';

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
export default async function RoutedPage() {
  const films = await getOverview();

  return <MovieGoApp initialFilms={films} />;
}
