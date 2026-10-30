import { ApiError, fetchMedia } from '../src/api';

const mockFetch = jest.fn();
globalThis.fetch = mockFetch;

function respond(body: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status < 400,
    status,
    json: async () => body,
  });
}

const calledUrl = (n = 0) => mockFetch.mock.calls[n][0] as string;

beforeEach(() => mockFetch.mockReset());

test('sends the key and fetches reels by code', async () => {
  respond({
    pk: '1',
    media_type: 2,
    video_url: 'https://cdn/v.mp4',
    thumbnail_url: 'https://cdn/t.jpg',
    caption_text: 'oi',
    resources: [],
  });

  const result = await fetchMedia(
    ' https://www.instagram.com/reel/AbC-1_d/?igsh=x ',
    'key',
  );

  expect(calledUrl()).toBe(
    'https://api.hikerapi.com/v1/media/by/code?code=AbC-1_d',
  );
  expect(mockFetch.mock.calls[0][1].headers['x-access-key']).toBe('key');
  expect(result).toEqual({
    id: '1',
    caption: 'oi',
    thumbnailUrl: 'https://cdn/t.jpg',
    items: [
      {
        type: 'video',
        downloadUrl: 'https://cdn/v.mp4',
        thumbnailUrl: 'https://cdn/t.jpg',
      },
    ],
  });
});

test('maps album resources', async () => {
  respond({
    pk: '2',
    media_type: 8,
    thumbnail_url: null,
    caption_text: '',
    resources: [
      { media_type: 1, thumbnail_url: 'https://cdn/1.jpg' },
      {
        media_type: 2,
        video_url: 'https://cdn/2.mp4',
        thumbnail_url: 'https://cdn/2.jpg',
      },
    ],
  });

  const result = await fetchMedia('https://instagram.com/p/XYZ/', 'key');

  expect(result.thumbnailUrl).toBe('https://cdn/1.jpg');
  expect(result.items.map(i => [i.type, i.downloadUrl])).toEqual([
    ['image', 'https://cdn/1.jpg'],
    ['video', 'https://cdn/2.mp4'],
  ]);
});

test('routes stories and highlights', async () => {
  const media = { pk: '3', media_type: 1, thumbnail_url: 'https://cdn/s.jpg' };
  respond(media);
  await fetchMedia('https://www.instagram.com/stories/natgeo/123/', 'key');
  expect(calledUrl(0)).toContain('/v1/story/by/url?url=');

  respond({ pk: '4', title: 'Viagem', items: [media] });
  const highlight = await fetchMedia(
    'https://www.instagram.com/stories/highlights/456/',
    'key',
  );
  expect(calledUrl(1)).toContain('/v1/highlight/by/url?url=');
  expect(highlight.caption).toBe('Viagem');
  expect(highlight.items).toHaveLength(1);
});

test('resolves /s/ links before fetching', async () => {
  respond({ pk: 99, type: 'highlight' });
  respond({
    pk: '99',
    items: [{ media_type: 1, thumbnail_url: 'https://c/a' }],
  });

  await fetchMedia('https://www.instagram.com/s/aGlnaGxpZ2h0Ojk5', 'key');

  expect(calledUrl(0)).toContain('/v1/share/by/url?url=');
  expect(calledUrl(1)).toBe(
    'https://api.hikerapi.com/v1/highlight/by/id?id=99',
  );
});

test('sends /share/ links to the url endpoint', async () => {
  respond({ pk: '5', media_type: 1, thumbnail_url: 'https://c/a' });
  await fetchMedia('https://www.instagram.com/share/reel/BAabc/', 'key');
  expect(calledUrl()).toContain('/v1/media/by/url?url=');
});

test('surfaces API errors and a missing key', async () => {
  respond({ state: false, error: 'Unauthorized request' }, 401);
  await expect(
    fetchMedia('https://instagram.com/p/XYZ/', 'bad'),
  ).rejects.toThrow('Unauthorized request');

  await expect(fetchMedia('x', '')).rejects.toThrow(ApiError);
  expect(mockFetch).toHaveBeenCalledTimes(1);
});
