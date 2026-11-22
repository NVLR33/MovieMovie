import { NextRequest } from 'next/server';
import { getUser } from '@/lib/auth';
import { subscribeLive } from '@/lib/realtime-hub';

// pg needs Node TCP. Web-standard SSE streaming does not require Edge or WebSockets.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin) {
    try { if (![request.nextUrl.host, request.headers.get('host')].includes(new URL(origin).host)) return new Response('Forbidden', { status: 403 }); }
    catch { return new Response('Forbidden', { status: 403 }); }
  }
  if (request.headers.get('sec-fetch-site') === 'cross-site') return new Response('Forbidden', { status: 403 });
  const user = await getUser();
  const encoder = new TextEncoder();
  let cleanup: () => void = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      let lifetime: ReturnType<typeof setTimeout> | undefined;
      let unsubscribe: (() => void) | null = null;
      cleanup = () => {
        if (closed) return;
        closed = true; unsubscribe?.();
        if (heartbeat) clearInterval(heartbeat);
        if (lifetime) clearTimeout(lifetime);
        request.signal.removeEventListener('abort', cleanup);
        try { controller.close(); } catch { /* Browser already cancelled. */ }
      };
      const write = (text: string) => {
        if (closed) return;
        // Never buffer unbounded data behind a slow/disconnected reader.
        if ((controller.desiredSize ?? 0) < -4) { cleanup(); return; }
        try { controller.enqueue(encoder.encode(text)); } catch { cleanup(); }
      };
      write('retry: 4000\n: connected\n\n');
      unsubscribe = subscribeLive(user?.id || 0, event => {
        if (event.unavailable) { write('event: unavailable\ndata: {}\n\n'); cleanup(); return; }
        write(`event: sync\ndata: ${JSON.stringify(event)}\n\n`);
      });
      if (!unsubscribe) { write('retry: 30000\nevent: unavailable\ndata: {}\n\n'); cleanup(); return; }
      // Resync on every connection: changes while disconnected cannot be lost.
      write(`event: sync\ndata: ${JSON.stringify({ channels: user ? ['pulse', 'chat', 'social'] : ['pulse'] })}\n\n`);
      heartbeat = setInterval(() => write(': heartbeat\n\n'), 15000);
      // Bound lifetime and revalidate the session on the next browser reconnect.
      lifetime = setTimeout(cleanup, 55000);
      request.signal.addEventListener('abort', cleanup, { once: true });
      if (request.signal.aborted) cleanup();
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'private, no-cache, no-store, no-transform', 'X-Accel-Buffering': 'no', 'Vary': 'Cookie' } });
}
