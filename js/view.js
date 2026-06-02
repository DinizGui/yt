import { VIDEO_ID, VIDEO_START, WATCH_URL } from '../video.config.js';

const MIN_PLAY_MS = 30_000;

function carregarYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve();
  return new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev();
      resolve();
    };
    if (!document.querySelector('script[src*="iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  });
}

function dispararApiBurp() {
  return fetch('/api/view').catch(() => null);
}

function criarPlayer(elementId, onStatus) {
  return new Promise((resolve, reject) => {
    let player;
    try {
      player = new YT.Player(elementId, {
        videoId: VIDEO_ID,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          mute: 1,
          start: VIDEO_START,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (e) => {
            e.target.mute();
            e.target.seekTo(VIDEO_START, true);
            e.target.playVideo();
            onStatus?.(`view • ${VIDEO_ID} • 0s`);
            resolve(e.target);
          },
          onError: () => reject(new Error('player erro')),
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING) {
              onStatus?.(`view • ${VIDEO_ID} • tocando`);
            }
          },
        },
      });
    } catch (err) {
      reject(err);
    }
  });
}

export async function iniciarView({ elementId = 'player', onStatus } = {}) {
  onStatus?.(`view • ${VIDEO_ID} • carregando`);

  const burp = dispararApiBurp();
  await carregarYouTubeApi();
  const player = await criarPlayer(elementId, onStatus);
  await burp;

  setTimeout(() => {
    if (player.getPlayerState?.() === YT.PlayerState.PLAYING) {
      onStatus?.(`view • ${VIDEO_ID} • ${MIN_PLAY_MS / 1000}s+`);
    }
  }, MIN_PLAY_MS);

  return { player, watchUrl: WATCH_URL, videoId: VIDEO_ID };
}

if (document.getElementById('player')) {
  iniciarView({
    onStatus: (msg) => {
      const el = document.getElementById('status');
      if (el) el.textContent = msg;
    },
  }).catch((err) => {
    const el = document.getElementById('status');
    if (el) el.textContent = `erro: ${err.message}`;
    console.error(err);
  });
}
