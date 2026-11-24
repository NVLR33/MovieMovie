'use client';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { browserStorage } from '@/lib/browser-preferences';
import { paletteTokens, type AmbientPalette } from '@/lib/ambient-palette';
import { ambientImageSource, imagePalette } from '@/lib/ambient-image';
const PREFERENCE = 'mg_ambient_canvas',
  EVENT = 'moviemovie:ambient';
let memoryPreference: boolean | undefined;
function subscribe(callback: () => void) {
  const stored = (event: StorageEvent) => {
    if (event.key === PREFERENCE || event.key === null) {
      memoryPreference = undefined;
      callback();
    }
  };
  window.addEventListener(EVENT, callback);
  window.addEventListener('storage', stored);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener('storage', stored);
  };
}
const snapshot = () =>
  memoryPreference ?? browserStorage.getItem(PREFERENCE) !== 'false';
const serverSnapshot = () => true;
export function useAmbientPreference() {
  const enabled = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const setEnabled = (value: boolean) => {
    memoryPreference = value;
    browserStorage.setItem(PREFERENCE, String(value));
    window.dispatchEvent(new Event(EVENT));
  };
  return [enabled, setEnabled] as const;
}
function clearPalette(root: HTMLElement) {
  delete root.dataset.ambient;
  for (const property of Array.from(root.style))
    if (property.startsWith('--ambient-')) root.style.removeProperty(property);
}
function apply(root: HTMLElement, palette: AmbientPalette) {
  const tokens = paletteTokens(palette, root.dataset.theme === 'light');
  for (const [property, value] of Object.entries(tokens))
    root.style.setProperty(property, value);
  root.dataset.ambient = 'on';
  root.dataset.ambientStatus = 'ready';
}
export default function AmbientCanvas({
  poster,
  backdrop,
}: {
  poster?: string | null;
  backdrop?: string | null;
}) {
  const [enabled] = useAmbientPreference(),
    current = useRef<AmbientPalette | null>(null);
  const posterSource = ambientImageSource(poster),
    backdropSource = ambientImageSource(backdrop);
  const source = backdropSource || posterSource;
  useEffect(() => {
    const root = document.documentElement;
    const previous = new Map(
      Array.from(root.style)
        .filter((key) => key.startsWith('--ambient-'))
        .map((key) => [key, root.style.getPropertyValue(key)]),
    );
    const previousMode = root.getAttribute('data-ambient'),
      previousStatus = root.getAttribute('data-ambient-status');
    const observer = new MutationObserver(() => {
      if (current.current && root.dataset.ambient === 'on')
        apply(root, current.current);
    });
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => {
      observer.disconnect();
      clearPalette(root);
      for (const [key, value] of previous) root.style.setProperty(key, value);
      if (previousMode === null) delete root.dataset.ambient;
      else root.setAttribute('data-ambient', previousMode);
      if (previousStatus === null) delete root.dataset.ambientStatus;
      else root.setAttribute('data-ambient-status', previousStatus);
    };
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    let cancelled = false;
    const fallback = (status: string) => {
      current.current = null;
      clearPalette(root);
      root.dataset.ambientStatus = status;
    };
    if (!enabled) {
      fallback('off');
      return;
    }
    if (!source) {
      fallback('fallback');
      return;
    }
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    if (
      connection?.saveData ||
      window.matchMedia('(prefers-reduced-data: reduce)').matches
    ) {
      fallback('data-saver');
      return;
    }
    root.dataset.ambientStatus = 'loading';
    const run = async () => {
      let palette: AmbientPalette | null = null;
      try {
        for (const candidate of [
          ...new Set(
            [posterSource, backdropSource].filter(
              (value): value is string => !!value,
            ),
          ),
        ]) {
          if (cancelled) return;
          palette = await imagePalette(candidate);
          if (palette) break;
        }
      } catch {
        /* Keep the neutral theme and original blurred artwork if canvas is unavailable. */
      }
      if (cancelled) return;
      if (palette) {
        current.current = palette;
        apply(root, palette);
      } else fallback('fallback');
    };
    // Let initial layout/interaction win. One 40x56 sample, not a full-resolution scan.
    const idle = typeof window.requestIdleCallback === 'function';
    const handle = idle
      ? window.requestIdleCallback(
          () => {
            void run();
          },
          { timeout: 900 },
        )
      : window.setTimeout(() => {
          void run();
        }, 40);
    return () => {
      cancelled = true;
      if (idle) window.cancelIdleCallback(handle);
      else clearTimeout(handle);
    };
  }, [enabled, source, posterSource, backdropSource]);
  if (!enabled || !source) return null;
  return (
    <div className="cinema-atmosphere ambient-canvas" aria-hidden="true">
      <div
        className="ambient-poster"
        style={{ backgroundImage: `url(${JSON.stringify(source)})` }}
      />
      <div className="ambient-wash" />
      <span />
    </div>
  );
}
