'use client';
import type { ComponentPropsWithoutRef } from 'react';
import { materialTone } from '@/lib/trailers';
import MediaPoster, { MediaAge, MediaRating } from './media-poster';
import { TrailerSurface } from './trailer-preview';

export type CoverFilm = {
  poster?: string | null;
  title?: string;
  category?: string;
  rating?: number;
  ratingCount?: number;
  ageRating?: string | null;
  trailerUrl?: string | null;
};
/** One catalog-style surface. No navigation or nested controls: callers own actions.
 * Tiny thumbnails keep the frame/fallback, but hide chips rather than crowd the artwork.
 * Missing rating metadata is not interpreted as a real score. */
export default function MaterialCover({
  film,
  className = '',
  children,
  preview = true,
  badges = true,
  alt = '',
  ...props
}: ComponentPropsWithoutRef<'span'> & {
  film: CoverFilm;
  preview?: boolean;
  badges?: boolean;
  alt?: string;
}) {
  const rated = {
    rating: film.rating ?? 0,
    ratingCount: film.ratingCount ?? 0,
  };
  return (
    <TrailerSurface
      {...props}
      className={`material-cover tone-${materialTone(rated)} ${className}`}
      film={film.category ? { category: film.category } : undefined}
      trailerUrl={preview ? film.trailerUrl : undefined}
      data-material-cover="true"
    >
      <MediaPoster src={film.poster} alt={alt} />
      {badges && (
        <span className="material-cover-chips">
          {film.rating !== undefined && film.ratingCount !== undefined && (
            <MediaRating film={rated} className="cover-score card-score" />
          )}
          <MediaAge value={film.ageRating} className="cover-age" />
        </span>
      )}
      {children}
    </TrailerSurface>
  );
}
