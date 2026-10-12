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
  title: 'moviemovie — твоя киновселенная',
  description:
    'Смотри, отмечай, оценивай. Твой личный киноархив будущего: фильмы, сериалы и аниме в одном месте.',
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
