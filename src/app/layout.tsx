import type { Metadata, Viewport } from 'next';
import { BRAND_NAME, BRAND_SOCIAL_IMAGE, DEFAULT_SITE_URL } from '@/lib/brand';
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
import '../components/material-cards.css';
import '../components/responsive-repairs.css';
import '../components/cinema-roulette.css';
import '../components/material-cover.css';
import '../components/material-player.css';
import '../components/material-detail.css';
import '../components/location-showtimes.css';
import '../components/community-section.css';
import '../components/header-account.css';
import '../components/shell-navigation.css';

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', interactiveWidget: 'resizes-content' };

// [SEO:METADATA]
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL
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
    siteName: BRAND_NAME,
    title: 'moviemovie — твоя киновселенная',
    description:
      'Твоя киновселенная: фильмы, сериалы, аниме, оценки, достижения и друзья.',
    url: '/',
    images: [{ url: BRAND_SOCIAL_IMAGE, width: 1200, height: 630, alt: BRAND_NAME }],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'moviemovie — твоя киновселенная',
    images: [BRAND_SOCIAL_IMAGE],
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
