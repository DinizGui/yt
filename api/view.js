import { VIDEO_ID, VIDEO_START, WATCH_URL } from '../video.config.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';

export default async function handler(req, res) {
  const id = VIDEO_ID;

  try {
    const watchUrl = `${WATCH_URL}&hl=pt-BR`;
    const embedUrl = `https://www.youtube.com/embed/${id}?start=${VIDEO_START}`;

    const headers = {
      'User-Agent': UA,
      'Accept-Language': 'pt-BR,pt;q=0.9',
      'Referer': 'https://www.youtube.com/',
    };

    const [watchRes, embedRes] = await Promise.all([
      fetch(watchUrl, { headers, redirect: 'follow' }),
      fetch(embedUrl, { headers, redirect: 'follow' }),
    ]);

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
      return res.status(502).json({ error: 'falha ao acessar página do vídeo no YouTube' });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      ok: true,
      videoId: id,
      start: VIDEO_START,
      title,
      channel,
      watchUrl: WATCH_URL,
      embedUrl,
      triggerUrl: '/v',
      youtubeStatus: watchRes.status,
      embedStatus: embedRes.status,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'erro desconhecido' });
  }
}
