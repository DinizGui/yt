export default async function handler(req, res) {
  const { id } = req.query;
  if (!id || !/^[A-Za-z0-9_-]{6,15}$/.test(id)) {
    return res.status(400).json({ error: 'id inválido' });
  }

  try {
    const html = await fetch(`https://www.youtube.com/watch?v=${id}&hl=pt-BR&persist_hl=1`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    }).then((r) => r.text());

    const initialDataMatch = html.match(/var ytInitialData = ({.+?});<\/script>/s);
    if (!initialDataMatch) throw new Error('ytInitialData não encontrado');
    const initialData = JSON.parse(initialDataMatch[1]);

    const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
    if (!apiKeyMatch) throw new Error('INNERTUBE_API_KEY não encontrado');
    const apiKey = apiKeyMatch[1];

    const contextMatch = html.match(/"INNERTUBE_CONTEXT":(\{.+?\}),"INNERTUBE_CONTEXT_CLIENT_NAME"/s);
    if (!contextMatch) throw new Error('INNERTUBE_CONTEXT não encontrado');
    const context = JSON.parse(contextMatch[1]);

    let continuation = null;
    const panels = initialData?.engagementPanels || [];
    for (const panel of panels) {
      const sectionList = panel?.engagementPanelSectionListRenderer?.content?.sectionListRenderer;
      if (!sectionList) continue;
      const targetId = panel?.engagementPanelSectionListRenderer?.panelIdentifier || '';
      if (!targetId.includes('comment')) continue;
      for (const section of sectionList.contents || []) {
        const itemSection = section?.itemSectionRenderer;
        if (!itemSection) continue;
        for (const item of itemSection.contents || []) {
          const token = item?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
          if (token) { continuation = token; break; }
        }
        if (continuation) break;
      }
      if (continuation) break;
    }

    if (!continuation) {
      return res.status(404).json({ error: 'Comentários desabilitados ou indisponíveis pra este vídeo' });
    }

    const next = await fetch(`https://www.youtube.com/youtubei/v1/next?key=${apiKey}&prettyPrint=false`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Origin': 'https://www.youtube.com',
        'Referer': `https://www.youtube.com/watch?v=${id}`,
      },
      body: JSON.stringify({ context, continuation }),
    }).then((r) => r.json());

    const entityMap = {};
    const mutations = next?.frameworkUpdates?.entityBatchUpdate?.mutations || [];
    for (const m of mutations) {
      const e = m?.payload?.commentEntityPayload;
      if (e?.key) entityMap[e.key] = e;
    }

    const comments = [];
    const endpoints = next?.onResponseReceivedEndpoints || [];
    for (const ep of endpoints) {
      const items = ep?.reloadContinuationItemsCommand?.continuationItems
        || ep?.appendContinuationItemsAction?.continuationItems
        || [];
      for (const item of items) {
        const vm = item?.commentThreadRenderer?.commentViewModel?.commentViewModel
          || item?.commentViewModel?.commentViewModel
          || item?.commentViewModel;
        const key = vm?.commentKey || vm?.commentId;
        if (!key) continue;
        const e = entityMap[key];
        if (!e) continue;
        comments.push({
          author: e.author?.displayName || '',
          channelId: e.author?.channelId || '',
          avatar: e.author?.avatarThumbnailUrl || '',
          text: e.properties?.content?.content || '',
          publishedTime: e.properties?.publishedTime || '',
          likes: e.toolbar?.likeCountNotliked || '0',
          replyCount: Number(e.toolbar?.replyCount || 0),
          isHearted: !!e.properties?.authorIsCreator,
        });
      }
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ videoId: id, count: comments.length, comments });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'erro desconhecido' });
  }
}
