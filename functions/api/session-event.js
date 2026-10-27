// Aggregated startup counters only. No raw logs, identifiers or public read API.
const columns = {launch_attempt: 'attempts', runtime_started: 'started', launch_error: 'errors'};
const hosts = new Set(['yugiohfm.online', 'yugioh-fm-web.pages.dev']);
const reply = status => new Response(null, {status, headers: {'Cache-Control': 'no-store'}});
export async function onRequest({request, env}) {
  if (request.method !== 'POST') return reply(405);
  const url = new URL(request.url);
  if (!hosts.has(url.hostname) || request.headers.get('Origin') !== url.origin) return reply(403);
  if (request.headers.get('DNT') === '1' || request.headers.get('Sec-GPC') === '1') return reply(204);
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return reply(415);
  if (Number(request.headers.get('Content-Length') || 0) > 128) return reply(413);
  let data;
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply(400);
    let chunks = [], size = 0;
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 128) {await reader.cancel(); return reply(413);}
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {return reply(400);}
  if (!data || data.v !== 1 || !Object.hasOwn(columns, data.event) ||
      Object.keys(data).some(key => key !== 'v' && key !== 'event')) return reply(400);
  if (!env.YFM_METRICS) return reply(503);
  const column = columns[data.event]; // SQL identifier is from the fixed allowlist.
  const day = new Date().toISOString().slice(0, 10);
  try {
    await env.YFM_METRICS.prepare(`INSERT INTO session_daily(day, ${column}) VALUES (?, 1)
      ON CONFLICT(day) DO UPDATE SET ${column} = ${column} + 1`).bind(day).run();
    return reply(204);
  } catch {return reply(503);}
}
