import { VIDEO_ID, VIDEO_START, WATCH_URL, EMBED_URL } from '../video.config.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';

export default async function handler(req, res) {
  try {
    const headers = {
      'User-Agent': UA,
      'Accept-Language': 'pt-BR,pt;q=0.9',
      'Referer': WATCH_URL,
    };

    const watchRes = await fetch(`${WATCH_URL}&hl=pt-BR`, { headers, redirect: 'follow' });
    const html = await watchRes.text();

    let title = '';
    let channel = '';
    const playerMatch = html.match(/var ytInitialPlayerResponse = ({.+?});(?:var|<\/script>)/s);
    if (playerMatch) {
      const details = JSON.parse(playerMatch[1])?.videoDetails;
      title = details?.title || '';
      channel = details?.author || '';
    }

    if (!watchRes.ok) {
      return res.status(502).json({ error: 'falha ao acessar o vídeo no YouTube' });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      ok: true,
      videoId: VIDEO_ID,
      start: VIDEO_START,
      title,
      channel,
      watchUrl: WATCH_URL,
      embedUrl: EMBED_URL,
      triggerUrl: '/v',
      youtubeStatus: watchRes.status,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'erro desconhecido' });
  }
}
