import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
// Fonts are bundled locally: production builds no longer depend on Google Fonts access.
import '@fontsource-variable/unbounded';
import '@fontsource-variable/golos-text';
import '@fontsource-variable/rubik/wght.css';
import './globals.css';
import '../components/mobile-experience.css';
import '../components/ambient-canvas.css';
import '../components/cinema-hud.css';
import '../components/cinema-passport.css';
import '../components/memory-orbit.css';
import '../components/collection-showcase.css';
import '../components/weekly-cinema-pulse.css';
import '../components/site-settings.css';
import '../components/series-navigation.css';
import '../components/catalog-discovery.css';
import '../components/design-system.css';

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', interactiveWidget: 'resizes-content' };

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
      <body>
        {children}
      </body>
    </html>
  );
}
