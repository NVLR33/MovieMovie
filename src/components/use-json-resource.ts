'use client';

import { LIVE_EVENT } from './use-live-updates';
import { useCallback, useEffect, useState } from 'react';

// Polling is cancelled on URL changes/unmount; old responses cannot overwrite a new conversation.
export function useJsonResource<T>(url: string | null, intervalMs = 0) {
  const [result, setResult] = useState<{ url: string; data: T } | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    let pending = false, dirty = false;
    async function load() {
      if (pending) return;
      pending = true;
      try {
        const response = await fetch(url!, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) return;
        const data: T = await response.json();
        if (!controller.signal.aborted) setResult({ url: url!, data });
      } catch {
        // Keep the last successful snapshot on transient network errors.
      } finally {
        pending = false;
        if (dirty && !controller.signal.aborted) { dirty = false; void load(); }
      }
    }
    const invalidate = (event: Event) => { if (url?.startsWith('/api/chat') && (event as CustomEvent).detail?.channels?.includes('chat')) { if (pending) dirty = true; else void load(); } };
    window.addEventListener(LIVE_EVENT, invalidate);
    void load();
    const timer = intervalMs > 0 ? setInterval(load, intervalMs) : undefined;
    return () => {
      controller.abort();
      window.removeEventListener(LIVE_EVENT, invalidate);
      if (timer) clearInterval(timer);
    };
  }, [url, intervalMs, revision]);

  return [result?.url === url ? result.data : null, refresh] as const;
}
