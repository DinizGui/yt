# gatilho-yt

Gatilho HTTP para Burp — dar view no vídeo fixo (sem player).

**Vídeo:** `https://www.youtube.com/watch?v=2sTS91HNoIs` (início **0s**)

Config em `video.config.js`.

- `/v` — `js/view.js` + **YouTube IFrame API** (autoplay, mute, start=0, ~30s tocando)
- `/api/view` — gatilho extra pro Burp (servidor; view real é só no navegador via JS)

**Vídeo:** `video.config.js` → `https://www.youtube.com/watch?v=2sTS91HNoIs`

**Burp:** `GET /api/view` ou `GET /v`
