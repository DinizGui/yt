import http from 'node:http';
import puppeteer from 'puppeteer';
import { VIDEO_ID, VIDEO_START, WATCH_URL } from './video.config.js';

const WATCH_MS = 35_000;

const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>view</title>
<style>html,body,#p{margin:0;padding:0;width:100%;height:100vh;background:#000}</style>
</head><body><div id="p"></div>
<script src="https://www.youtube.com/iframe_api"></script>
<script>
  window.__ytReady = new Promise(r => { window.onYouTubeIframeAPIReady = r; });
  window.__startPlayer = () => new Promise((resolve) => {
    const player = new YT.Player('p', {
      videoId: '${VIDEO_ID}',
      width: '100%', height: '100%',
      playerVars: { autoplay: 1, mute: 1, start: ${VIDEO_START}, playsinline: 1, rel: 0, controls: 1, enablejsapi: 1, origin: window.location.origin },
      events: {
        onReady: (e) => { e.target.mute(); e.target.playVideo(); window.__player = e.target; resolve('ready'); },
        onStateChange: (e) => { window.__lastState = e.data; },
        onError: (e) => { window.__playerError = e.data; }
      }
    });
  });
</script></body></html>`;

function startLocalServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(HTML);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ url: `http://127.0.0.1:${port}/`, server });
    });
  });
}

export async function dispararView({ onLog = () => {}, watchMs = WATCH_MS } = {}) {
  const log = (msg) => {
    const stamped = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
    console.log(stamped);
    onLog(msg);
  };

  log(`alvo: ${WATCH_URL} (start=${VIDEO_START}s, watch=${watchMs / 1000}s)`);

  const { url, server } = await startLocalServer();
  log(`server local: ${url}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--mute-audio',
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--lang=pt-BR',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 800 });
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' });

    log('abrindo página local…');
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction('window.YT && window.YT.Player', { timeout: 20_000 });
    log('YT API ok, criando player…');
    await page.evaluate(() => window.__startPlayer());

    log(`segurando ${watchMs / 1000}s…`);
    let lastTime = 0;
    const interval = setInterval(async () => {
      try {
        const info = await page.evaluate(() => ({
          t: window.__player?.getCurrentTime?.() ?? 0,
          state: window.__lastState ?? -2,
          err: window.__playerError,
        }));
        if (info.t !== lastTime || info.err) {
          log(`t=${info.t.toFixed(1)}s state=${info.state}${info.err ? ' err=' + info.err : ''}`);
          lastTime = info.t;
        }
      } catch {}
    }, 3_000);

    await new Promise((r) => setTimeout(r, watchMs));
    clearInterval(interval);

    const final = await page.evaluate(() => ({
      t: window.__player?.getCurrentTime?.() ?? 0,
      state: window.__lastState ?? -2,
    }));
    log(`fim: tempo=${final.t.toFixed(1)}s state=${final.state}`);

    const ok = final.t >= 25;
    if (ok) log(`OK: ${final.t.toFixed(1)}s tocados — view enviada`);
    else log('AVISO: tocou menos de 25s — view provavelmente NÃO contou');

    return { ok, secondsPlayed: final.t, finalState: final.state };
  } finally {
    await browser.close();
    server.close();
    log('encerrado');
  }
}

const isCliRun = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` ||
                 import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());

if (isCliRun) {
  dispararView().catch((e) => {
    console.error('erro:', e.message);
    process.exit(1);
  });
}
