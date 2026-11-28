'use client';

import { LIVE_EVENT } from './use-live-updates';
import { useCallback, useEffect, useState } from 'react';

// Polling is cancelled on URL changes/unmount; old responses cannot overwrite a new conversation.
export function useJsonResource<T>(url: string | null, intervalMs = 0) {
  const [result, setResult] = useState<{ url: string; data: T } | null>(null);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<{
    url: string;
    loading: boolean;
    error: string;
  } | null>(null);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    let pending = false,
      dirty = false;
    async function load() {
      if (pending) return;
      pending = true;
      if (!controller.signal.aborted)
        setStatus({ url: url!, loading: true, error: '' });
      try {
        const response = await fetch(url!, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok)
          throw new Error(
            response.status === 403
              ? 'Нет доступа к этим данным.'
              : 'Не удалось загрузить данные. Попробуй ещё раз.',
          );
        const data: T = await response.json();
        if (!controller.signal.aborted) {
          setResult({ url: url!, data });
          setStatus({ url: url!, loading: false, error: '' });
        }
      } catch (error) {
        // Keep the last successful snapshot on transient network errors.
        if (!controller.signal.aborted)
          setStatus({
            url: url!,
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : 'Не удалось загрузить данные.',
          });
      } finally {
        pending = false;
        if (dirty && !controller.signal.aborted) {
          dirty = false;
          void load();
        }
      }
    }
    const invalidate = (event: Event) => {
      if (
        url?.startsWith('/api/chat') &&
        (event as CustomEvent).detail?.channels?.includes('chat')
      ) {
        if (pending) dirty = true;
        else void load();
      }
    };
    window.addEventListener(LIVE_EVENT, invalidate);
    void load();
    const timer = intervalMs > 0 ? setInterval(load, intervalMs) : undefined;
    return () => {
      controller.abort();
      window.removeEventListener(LIVE_EVENT, invalidate);
      if (timer) clearInterval(timer);
    };
  }, [url, intervalMs, revision]);

  return [
    result?.url === url ? result.data : null,
    refresh,
    {
      loading: !!url && (status?.url !== url || status.loading),
      error: status?.url === url ? status.error : '',
    },
  ] as const;
}
