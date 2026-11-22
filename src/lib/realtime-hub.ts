import { inArray } from 'drizzle-orm';
import { db } from '@/db';
import { realtimeVersions } from '@/db/schema';

export type LiveChannel = 'pulse' | 'chat' | 'social';
export type LiveEvent = { channels: LiveChannel[]; unavailable?: boolean };
type Subscriber = { userId: number; receive: (event: LiveEvent) => void; publicVersion?: string; privateVersion?: string };
// One bounded batch query per process every 3s, not one query/connection/client.
const subscribers = new Set<Subscriber>();
let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
async function tick() {
  if (running || !subscribers.size) return;
  running = true;
  try {
    const ids = [...new Set([0, ...[...subscribers].map(s => s.userId)])];
    const rows = await db.select().from(realtimeVersions).where(inArray(realtimeVersions.audienceId, ids));
    const versions = new Map(rows.map(r => [r.audienceId, String(r.revision)]));
    for (const s of subscribers) {
      const pub = versions.get(0) || '0', own = versions.get(s.userId) || '0';
      const channels: LiveChannel[] = [];
      if (s.publicVersion !== pub) channels.push('pulse');
      if (s.userId && s.privateVersion !== own) channels.push('chat', 'social');
      s.publicVersion = pub; s.privateVersion = own;
      if (channels.length) s.receive({ channels });
    }
  } catch {
    for (const s of subscribers) s.receive({ channels: [], unavailable: true });
  } finally {
    running = false;
    if (subscribers.size) timer = setTimeout(tick, 3000);
  }
}
export function subscribeLive(userId: number, receive: Subscriber['receive']) {
  if (subscribers.size >= 150 || [...subscribers].filter(s => s.userId === userId).length >= (userId ? 8 : 60)) return null;
  const subscription: Subscriber = { userId, receive };
  subscribers.add(subscription);
  if (!timer && !running) void tick();
  return () => {
    subscribers.delete(subscription);
    if (!subscribers.size && timer) { clearTimeout(timer); timer = undefined; }
  };
}
