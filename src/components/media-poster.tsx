'use client';
/* eslint-disable @next/next/no-img-element */
import { useCallback, useState, type ComponentPropsWithoutRef } from 'react';
import { Film as FilmIcon, Star } from 'lucide-react';
import { ageRatingTone } from '@/lib/age-rating';
import { formatFilmRating } from '@/lib/rating-display';

type Rated = { rating: number; ratingCount: number };
/** Shared catalog geometry and error handling. Children are sibling overlays, never nested controls. */
export default function MediaPoster({
  src,
  alt = '',
  className = '',
  children,
  ...props
}: ComponentPropsWithoutRef<'span'> & { src?: string | null; alt?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  // Cached/SSR image failures can happen before React attaches onError.
  const inspectImage = useCallback(
    (node: HTMLImageElement | null) => {
      if (src && node?.complete && node.naturalWidth === 0) setFailed(src);
    },
    [src],
  );
  return (
    <span
      {...props}
      className={`cinema-poster ${className}`}
      data-poster-state={src && failed !== src ? 'image' : 'fallback'}
    >
      {src && failed !== src ? (
        <img
          ref={inspectImage}
          className="cinema-poster-image"
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(src)}
        />
      ) : (
        <span
          className="cinema-poster-fallback"
          role="img"
          aria-label={alt || 'Постер недоступен'}
        >
          <FilmIcon size={32} aria-hidden="true" />
        </span>
      )}
      {children}
    </span>
  );
}
export function MediaRating({
  film,
  className = '',
}: {
  film: Rated;
  className?: string;
}) {
  return (
    <span
      className={`cinema-rating ${className}`}
      title={`${formatFilmRating(film)} / 10 · ${film.ratingCount || 0}`}
    >
      <Star size={12} fill="currentColor" aria-hidden="true" />
      {formatFilmRating(film)}
    </span>
  );
}
export function MediaAge({
  value,
  className = '',
}: {
  value?: string | null;
  className?: string;
}) {
  const age = String(value || '').trim();
  if (!age) return null;
  const tone = ageRatingTone(age);
  return (
    <span
      className={`cinema-age card-age-rating age-${tone} ${className}`}
      title={`Возрастное ограничение: ${age}`}
    >
      {age}
    </span>
  );
}
