const base = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:3000';
if (!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw new Error('Only local audit servers are supported');
const until = Date.now() + 60000;
let ready = false;
while (Date.now() < until) {
  try { const response = await fetch(base + '/api/health', { signal: AbortSignal.timeout(1500) }); if (response.ok) { ready = true; break; } } catch { /* server/fixture startup */ }
  await new Promise(resolve => setTimeout(resolve, 300));
}
if (!ready) throw new Error('Isolated audit server did not become ready within 60 seconds');
console.log('Isolated audit server ready');
