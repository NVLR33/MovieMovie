'use client';
import { seriesPosterLabel, type SeriesPosterFilm } from '@/lib/series-poster';
import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from 'react';
import { createPortal } from 'react-dom';
import { Play, X, ExternalLink } from 'lucide-react';
import { trailerSource, trailerPreviewUrl } from '@/lib/trailers';

function mayPreview() {
  return (
    document.visibilityState === 'visible' &&
    matchMedia('(hover: hover) and (pointer: fine)').matches &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches &&
    !(navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection?.saveData
  );
}
/** Dwell-only, muted, bounded preview. No video/provider requests before deliberate desktop hover. */
export function TrailerSurface({
  trailerUrl,
  film,
  className = '',
  children,
  onPointerEnter,
  onPointerLeave,
  ...props
}: ComponentPropsWithoutRef<'span'> & {
  trailerUrl?: string | null;
  film?: SeriesPosterFilm;
}) {
  const serial = seriesPosterLabel(film);
  const source = trailerSource(trailerUrl),
    [active, setActive] = useState(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    session = useRef<object>({});
  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  useEffect(() => {
    if (!source?.hover) return;
    const stop = () => {
      if (timer.current) clearTimeout(timer.current);
      setActive(false);
    };
    const other = (event: Event) => {
      if ((event as CustomEvent).detail !== session.current) stop();
    };
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    document.addEventListener('visibilitychange', stop);
    window.addEventListener('blur', stop);
    window.addEventListener('mg-trailer-preview', other);
    media.addEventListener('change', stop);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', stop);
      window.removeEventListener('blur', stop);
      window.removeEventListener('mg-trailer-preview', other);
      media.removeEventListener('change', stop);
    };
  }, [source?.hover]);
  useEffect(() => {
    if (!active) return;
    const stop = () => setActive(false);
    document.addEventListener('scroll', stop, true);
    const timeout = setTimeout(stop, 20000);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('scroll', stop, true);
    };
  }, [active]);
  return (
    <span
      {...props}
      className={`${className}${serial ? ' series-poster' : ''}`}
      data-series={serial ? 'true' : undefined}
      title={serial?.description || props.title}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        clear();
        if (event.pointerType !== 'mouse' || !source?.hover || !mayPreview())
          return;
        timer.current = setTimeout(() => {
          if (!mayPreview()) return;
          window.dispatchEvent(
            new CustomEvent('mg-trailer-preview', { detail: session.current }),
          );
          setActive(true);
        }, 650);
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        clear();
        setActive(false);
      }}
    >
      {children}
      {source && (
        <span
          className="trailer-indicator"
          aria-hidden="true"
          title="Есть трейлер"
        >
          <Play size={18} />
        </span>
      )}
      {active && source?.hover && (
        <span className="trailer-preview" aria-hidden="true">
          {source.kind === 'video' ? (
            <video
              key={source.url}
              src={source.url}
              autoPlay
              muted
              playsInline
              preload="none"
              onError={() => setActive(false)}
              onEnded={() => setActive(false)}
            />
          ) : (
            <iframe
              key={source.url}
              title="Трейлер без звука"
              src={trailerPreviewUrl(source)}
              tabIndex={-1}
              allow="autoplay"
              sandbox="allow-scripts allow-same-origin allow-presentation"
              referrerPolicy="no-referrer"
              onError={() => setActive(false)}
            />
          )}
          <small>Трейлер · без звука</small>
        </span>
      )}
    </span>
  );
}
export function TrailerDialog({
  url,
  title,
  close,
}: {
  url: string;
  title: string;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    source = trailerSource(url);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  if (!source) return null;
  return createPortal(
    <dialog
      className="trailer-dialog"
      ref={ref}
      aria-label={`Трейлер: ${title}`}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const b = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < b.left ||
            event.clientX > b.right ||
            event.clientY < b.top ||
            event.clientY > b.bottom
          )
            close();
        }
      }}
    >
      <header>
        <h2>Трейлер · {title}</h2>
        <button
          type="button"
          autoFocus
          aria-label="Закрыть трейлер"
          onClick={close}
        >
          <X size={20} />
        </button>
      </header>
      {source.kind === 'video' ? (
        <video src={source.url} controls playsInline preload="metadata" />
      ) : (
        <iframe
          title={`Трейлер: ${title}`}
          src={source.url}
          allow="fullscreen; picture-in-picture"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-presentation"
          referrerPolicy="no-referrer"
        />
      )}
      <p>
        Если плеер недоступен,{' '}
        <a href={source.url} target="_blank" rel="noopener noreferrer">
          открой источник <ExternalLink size={13} />
        </a>
        . Автоматический звук отключён.
      </p>
    </dialog>,
    document.body,
  );
}
