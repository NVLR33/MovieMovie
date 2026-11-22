'use client';
import { useEffect, useRef, useState } from 'react';
export const LIVE_EVENT = 'moviemovie:live';
// Only the app shell opens EventSource. Chat widgets consume its DOM event.
export function useLiveUpdates(userId: number | undefined, refresh: (channels: string[]) => Promise<void>) {
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>('connecting');
  useEffect(() => {
    let source: EventSource | undefined;
    let stopped = false, refreshing = false, dirty = false;
    const pendingChannels = new Set<string>();
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const reload = async () => {
      debounce = undefined;
      if (stopped || document.visibilityState === 'hidden') return;
      if (refreshing) { dirty = true; return; }
      refreshing = true;
      const channels = [...pendingChannels]; pendingChannels.clear();
      try { await refreshRef.current(channels); } finally {
        refreshing = false;
        if (dirty && !stopped) { dirty = false; debounce = setTimeout(reload, 1500); }
      }
    };
    const synchronize = (channels: string[]) => {
      if (stopped || document.visibilityState === 'hidden') return;
      for (const channel of channels) pendingChannels.add(channel);
      window.dispatchEvent(new CustomEvent(LIVE_EVENT, { detail: { channels } }));
      if (!debounce) debounce = setTimeout(reload, 900);
    };
    const connect = () => {
      if (stopped || document.visibilityState === 'hidden' || source) return;
      if (typeof EventSource === 'undefined') { setStatus('offline'); return; }
      source = new EventSource('/api/events');
      source.onopen = () => setStatus('live');
      source.onerror = () => setStatus('offline'); // Native EventSource reconnects, respecting retry.
      source.addEventListener('unavailable', () => setStatus('offline'));
      source.addEventListener('sync', event => {
        try {
          const data = JSON.parse((event as MessageEvent).data);
          if (Array.isArray(data.channels)) synchronize(data.channels.filter((c: unknown) => ['pulse', 'chat', 'social'].includes(String(c))));
        } catch { /* Ignore invalid frames; never evaluate server strings. */ }
      });
    };
    const visibility = () => {
      if (document.visibilityState === 'hidden') { source?.close(); source = undefined; }
      else { connect(); synchronize(['pulse', 'chat', 'social']); }
    };
    connect();
    document.addEventListener('visibilitychange', visibility);
    // Degraded mode only. Healthy connections do not poll the REST API.
    const fallback = setInterval(() => { if (!source || source.readyState !== 1) synchronize(['pulse', 'chat', 'social']); }, 60000);
    return () => { stopped = true; source?.close(); clearInterval(fallback); if (debounce) clearTimeout(debounce); document.removeEventListener('visibilitychange', visibility); };
  }, [userId]);
  return status;
}
