const BASE_URL = 'https://api.hikerapi.com/v1';

export type MediaType = 'video' | 'image';

export type MediaItem = {
  type: MediaType;
  downloadUrl: string;
  thumbnailUrl?: string;
};

export type FetchResult = {
  id: string;
  caption?: string;
  thumbnailUrl?: string;
  items: MediaItem[];
};

export class ApiError extends Error {}

// `media_type`: 1 = photo, 2 = video, 8 = album. For photos, `thumbnail_url`
// is the full-size image.
function toItem(raw: any): MediaItem | null {
  const isVideo = raw?.media_type === 2 || !!raw?.video_url;
  const downloadUrl = isVideo ? raw?.video_url : raw?.thumbnail_url;
  if (typeof downloadUrl !== 'string') return null;
  return {
    type: isVideo ? 'video' : 'image',
    downloadUrl,
    thumbnailUrl: raw?.thumbnail_url ?? undefined,
  };
}

async function get(
  path: string,
  params: Record<string, string>,
  apiKey: string,
): Promise<any> {
  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  const res = await fetch(`${BASE_URL}${path}?${query}`, {
    headers: { 'x-access-key': apiKey },
  });

  let body: any;
  try {
    body = await res.json();
  } catch {
    throw new ApiError(`Resposta inválida da API (HTTP ${res.status})`);
  }

  if (!res.ok || body?.state === false) {
    const msg = body?.error ?? body?.detail ?? `HTTP ${res.status}`;
    throw new ApiError(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return body;
}

// Each kind of link has its own endpoint. /s/ links must be resolved through
// /share/by/url first. Posts and reels go by code, since /media/by/url is only
// documented for /p/ links; /share/ links carry no media code.
async function fetchByLink(url: string, apiKey: string): Promise<any> {
  if (/instagram\.com\/s\//.test(url)) {
    const { pk, type } = await get('/share/by/url', { url }, apiKey);
    const path = type === 'highlight' ? '/highlight/by/id' : '/story/by/id';
    return get(path, { id: String(pk) }, apiKey);
  }
  if (url.includes('/stories/highlights/')) {
    return get('/highlight/by/url', { url }, apiKey);
  }
  if (url.includes('/stories/')) {
    return get('/story/by/url', { url }, apiKey);
  }
  const code = url.match(/\/(?:p|reels?|tv)\/([\w-]+)/)?.[1];
  if (code && !url.includes('/share/')) {
    return get('/media/by/code', { code }, apiKey);
  }
  return get('/media/by/url', { url }, apiKey);
}

export async function fetchMedia(
  url: string,
  apiKey: string,
): Promise<FetchResult> {
  if (!apiKey) {
    throw new ApiError('HIKER_API_KEY não definida no .env');
  }
  const body = await fetchByLink(url.trim(), apiKey);

  // Albums list their media in `resources`, highlights in `items`.
  const rawItems = body.resources?.length
    ? body.resources
    : body.items?.length
    ? body.items
    : [body];
  const items = rawItems
    .map(toItem)
    .filter((i: MediaItem | null): i is MediaItem => i !== null);
  if (items.length === 0)
    throw new ApiError('Nenhuma mídia encontrada nesse link');

  return {
    id: String(body.pk ?? Date.now()),
    caption: body.caption_text || body.title,
    thumbnailUrl: body.thumbnail_url ?? items[0].thumbnailUrl,
    items,
  };
}
