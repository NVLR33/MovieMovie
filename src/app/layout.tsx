import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Unbounded, Golos_Text, Rubik } from 'next/font/google';
import './globals.css';

// Заголовки
const unbounded = Unbounded({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-unbounded',
  display: 'swap',
});

// Основной интерфейс
const golos = Golos_Text({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-golos',
  display: 'swap',
});

// Карточки и статистика
const rubik = Rubik({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-rubik',
  display: 'swap',
});

// [SEO:METADATA]
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      'https://moviego-gamma.vercel.app'
  ),

  title: {
    default: 'moviemovie — твоя киновселенная',
    template: '%s',
  },

  description:
    'Смотри, отмечай, оценивай. Твой личный киноархив будущего: фильмы, сериалы и аниме в одном месте.',

  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    siteName: 'moviemovie',
    title: 'moviemovie — твоя киновселенная',
    description:
      'Твоя киновселенная: фильмы, сериалы, аниме, оценки, достижения и друзья.',
    url: '/',
  },

  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="ru">
      <body
        className={`
          ${unbounded.variable}
          ${golos.variable}
          ${rubik.variable}
        `}
      >
        {children}
      </body>
    </html>
  );
}
