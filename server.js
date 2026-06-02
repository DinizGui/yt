import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { dispararView } from './view-bot.js';
import { VIDEO_ID, WATCH_URL } from './video.config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const clients = new Set();
let stats = { total: 0, ok: 0, fail: 0, running: false, lastResult: null };

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch {}
  }
}

function emitLog(msg) {
  broadcast('log', { msg, ts: new Date().toISOString() });
}

function emitStats() {
  broadcast('stats', stats);
}

async function handleTrigger(res) {
  if (stats.running) {
    res.writeHead(409, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'view em andamento' }));
    return;
  }
  stats.running = true;
  emitStats();
  emitLog('--- nova view solicitada ---');
  res.writeHead(202, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ accepted: true }));

  dispararView({ onLog: emitLog })
    .then((result) => {
      stats.total += 1;
      if (result.ok) stats.ok += 1; else stats.fail += 1;
      stats.lastResult = result;
    })
    .catch((e) => {
      stats.total += 1;
      stats.fail += 1;
      stats.lastResult = { ok: false, error: e.message };
      emitLog(`erro: ${e.message}`);
    })
    .finally(() => {
      stats.running = false;
      emitStats();
    });
}

function handleSse(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(`event: hello\ndata: ${JSON.stringify({ videoId: VIDEO_ID, watchUrl: WATCH_URL, stats })}\n\n`);
  clients.add(res);
  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch {}
  }, 15_000);
  res.on('close', () => {
    clearInterval(ping);
    clients.delete(res);
  });
}

async function serveFile(res, path, type) {
  try {
    const content = await readFile(join(__dirname, path));
    res.writeHead(200, { 'Content-Type': type });
    res.end(content);
  } catch {
    res.writeHead(404).end('not found');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/panel')) {
    return serveFile(res, 'panel.html', 'text/html; charset=utf-8');
  }
  if (req.method === 'GET' && url.pathname === '/events') {
    return handleSse(res);
  }
  if (req.method === 'POST' && url.pathname === '/trigger') {
    return handleTrigger(res);
  }
  if (req.method === 'GET' && url.pathname === '/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ videoId: VIDEO_ID, watchUrl: WATCH_URL, stats }));
  }
  res.writeHead(404).end('not found');
});

server.listen(PORT, () => {
  console.log(`painel: http://localhost:${PORT}`);
});
