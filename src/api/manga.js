import { cloudSyncConfig } from '../config/cloudSync';

const DIRECT_API_BASE = 'https://api.2026copy.com/api/v3';
const PROXY_BASE = (
  import.meta.env.VITE_MANGA_API_BASE ||
  import.meta.env.VITE_CLOUDFLARE_PROGRESS_API ||
  cloudSyncConfig.apiBase ||
  ''
).replace(/\/$/, '');
const PLATFORM = '1';

function ensureOk(response, action) {
  if (!response.ok) {
    throw new Error(`${action}失败（HTTP ${response.status}）`);
  }
}

async function readJson(response, action) {
  ensureOk(response, action);
  const data = await response.json();

  if (data?.code !== 200 || !data?.results) {
    throw new Error(data?.message || data?.detail || `${action}失败`);
  }

  return data.results;
}

function apiUrl(path, params = {}) {
  const query = new URLSearchParams({
    ...params,
    platform: PLATFORM,
    _update: 'true'
  });
  const base = PROXY_BASE ? `${PROXY_BASE}/api/manga` : DIRECT_API_BASE;
  return `${base}${path}?${query.toString()}`;
}

function namesFrom(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => item?.name || item?.display || item).filter(Boolean);
}

function normalizeComic(item) {
  const comic = item?.comic || item || {};
  const status = comic.status?.display ?? comic.status ?? '';
  const region = comic.region?.display ?? comic.region ?? '';

  return {
    uuid: comic.uuid || '',
    pathWord: comic.path_word || '',
    title: comic.name || comic.alias || comic.path_word || '未命名漫画',
    alias: comic.alias || '',
    cover: comic.cover || '',
    brief: comic.brief || '',
    authors: namesFrom(comic.author),
    themes: namesFrom(comic.theme),
    status: typeof status === 'string' ? status : '',
    region: typeof region === 'string' ? region : '',
    popularity: comic.popular ?? comic.popularity ?? 0,
    updatedAt: comic.datetime_updated || item?.datetime_updated || '',
    lastChapter: comic.last_chapter || null
  };
}

function normalizeChapter(item, fallbackIndex) {
  const rawOrder = item?.index ?? item?.ordered ?? item?.sort ?? fallbackIndex;
  const numericOrder = Number(rawOrder);

  return {
    uuid: String(item?.uuid || item?.id || ''),
    name: item?.name || item?.title || `第 ${fallbackIndex + 1} 话`,
    order: Number.isFinite(numericOrder) ? numericOrder : fallbackIndex,
    updatedAt: item?.datetime_updated || item?.datetime_created || '',
    size: item?.size ?? 0
  };
}

export async function fetchComics({ offset = 0, limit = 20 } = {}) {
  const response = await fetch(
    apiUrl('/comics', {
      ordering: '-datetime_updated',
      limit: String(limit),
      offset: String(offset),
      free_type: '1'
    })
  );
  const results = await readJson(response, '加载漫画列表');

  return {
    total: Number(results.total || 0),
    offset: Number(results.offset ?? offset),
    limit: Number(results.limit ?? limit),
    list: (results.list || []).map(normalizeComic).filter((item) => item.pathWord)
  };
}

export async function searchComics({ keyword, offset = 0, limit = 20 } = {}) {
  const response = await fetch(
    apiUrl('/search/comic', {
      q: keyword,
      q_type: '',
      limit: String(limit),
      offset: String(offset)
    })
  );
  const results = await readJson(response, '搜索漫画');

  return {
    total: Number(results.total || 0),
    offset: Number(results.offset ?? offset),
    limit: Number(results.limit ?? limit),
    list: (results.list || []).map(normalizeComic).filter((item) => item.pathWord)
  };
}

export async function fetchComic(pathWord) {
  const response = await fetch(apiUrl(`/comic2/${encodeURIComponent(pathWord)}`));
  const results = await readJson(response, '加载漫画详情');
  return normalizeComic(results.comic || results);
}

async function fetchChapterPage(pathWord, offset, limit) {
  const response = await fetch(
    apiUrl(`/comic/${encodeURIComponent(pathWord)}/group/default/chapters`, {
      limit: String(limit),
      offset: String(offset)
    })
  );
  const results = await readJson(response, '加载漫画目录');
  const list = (results.list || []).map((item, index) => normalizeChapter(item, offset + index));

  return {
    total: Number(results.total ?? list.length),
    list
  };
}

export async function fetchAllComicChapters(pathWord) {
  const limit = 100;
  const firstPage = await fetchChapterPage(pathWord, 0, limit);
  const pages = Math.min(Math.ceil(firstPage.total / limit), 20);
  let chapters = [...firstPage.list];

  if (pages > 1) {
    const remaining = await Promise.all(
      Array.from({ length: pages - 1 }, (_, index) => fetchChapterPage(pathWord, (index + 1) * limit, limit))
    );
    chapters = chapters.concat(remaining.flatMap((page) => page.list));
  }

  const unique = Array.from(new Map(chapters.filter((item) => item.uuid).map((item) => [item.uuid, item])).values());
  return unique.sort((a, b) => a.order - b.order);
}

export async function fetchComicChapter(pathWord, chapterUuid) {
  const encodedPath = encodeURIComponent(pathWord);
  const encodedChapter = encodeURIComponent(chapterUuid);
  const response = await fetch(apiUrl(`/comic/${encodedPath}/chapter/${encodedChapter}`));

  const results = await readJson(response, '加载漫画图片');
  const chapter = results.chapter || results;
  const words = Array.isArray(chapter.words) ? chapter.words : [];
  const images = (chapter.contents || [])
    .map((item, index) => ({
      url: item?.url || item?.image || '',
      order: Number(words[index] ?? index)
    }))
    .filter((item) => item.url)
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, index }));

  return {
    uuid: String(chapter.uuid || chapterUuid),
    name: chapter.name || chapter.title || '漫画章节',
    images
  };
}
