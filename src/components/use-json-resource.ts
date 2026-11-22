'use client';

import { useCallback, useEffect, useState } from 'react';

// Polling is cancelled on URL changes/unmount; old responses cannot overwrite a new conversation.
export function useJsonResource<T>(url: string | null, intervalMs = 0) {
  const [result, setResult] = useState<{ url: string; data: T } | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    let pending = false;
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
      }
    }
    void load();
    const timer = intervalMs > 0 ? setInterval(load, intervalMs) : undefined;
    return () => {
      controller.abort();
      if (timer) clearInterval(timer);
    };
  }, [url, intervalMs, revision]);

  return [result?.url === url ? result.data : null, refresh] as const;
}
