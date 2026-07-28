import { createAuth, isTrustedOrigin } from './auth.js';

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    ...init
  });
}

function credentialHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin'
  });

  if (origin && isTrustedOrigin(request, env)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }

  return headers;
}

function credentialJson(data, request, env, status = 200) {
  const headers = credentialHeaders(request, env);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { status, headers });
}

function withCredentialCors(response, request, env) {
  const headers = new Headers(response.headers);
  for (const [name, value] of credentialHeaders(request, env)) {
    headers.set(name, value);
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function badRequest(message, status = 400) {
  return json({ ok: false, error: message }, { status });
}

const COPY_API_BASE = 'https://api.2026copy.com/api/v3';
const COPY_WEB_BASE = 'https://www.mangacopy.com';
const MANGA_API_FALLBACK_BASE = 'https://api.2024manga.com/api/v3';
const MANGA_ROUTE_PATTERN = /^(?:comics|search\/comic|comic2\/[^/]+|comic\/[^/]+\/(?:group\/default\/chapters|chapter\/[^/]+))$/;
const NOVEL_ROUTE_PATTERN = /^(?:books|search\/books|book\/[^/]+(?:\/volumes|\/volume\/[^/]+)?)$/;
const MANGA_CACHE_VERSION = 'desktop-hybrid-v6';
const MANGA_STALE_SECONDS = 7 * 24 * 60 * 60;
const MANGA_CIRCUIT_SECONDS = 60 * 60;
const UPSTREAM_RESTRICTION_PATTERN = /(?:copy3000|\u7834\u89e3\u7248|\u7834\u89e3\u7248\u672c|\u7b49\u5f85\s*1\s*\u5c0f\u65f6|\u66f4\u65b0\u6700\u65b0\s*APP|cf-chl|challenge-platform)/i;
const DESKTOP_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';
const MERGED_COMIC_PATHS = Object.freeze({ liadierdeadishang: 'liadierdedadishang' });
const resolveComicPath = (pathWord) => MERGED_COMIC_PATHS[pathWord] || pathWord;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

async function fetchCopyApi(apiPath, search) {
  const target = new URL(`${COPY_API_BASE}/${apiPath}`);
  target.search = search;

  const upstream = await fetch(target, {
    signal: AbortSignal.timeout(15000),
    headers: {
      Accept: 'application/json',
      Origin: 'https://mangacopy.com',
      Referer: 'https://mangacopy.com/',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/146.0.0.0 Mobile Safari/537.36',
      platform: '1',
      region: '1',
      version: '2026.03.30',
      webp: '1'
    }
  });

  const headers = new Headers(corsHeaders());
  headers.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'public, max-age=60, s-maxage=180');

  return new Response(upstream.body, {
    status: upstream.status,
    headers
  });
}

function decodeHtml(value = '') {
  return value.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
}

function cleanHtmlText(value = '') {
  return decodeHtml(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function desktopHeaders(accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8') {
  return { Accept: accept, 'Accept-Language': 'zh-CN,zh;q=0.9', Referer: `${COPY_WEB_BASE}/`, 'User-Agent': DESKTOP_USER_AGENT };
}

function assertUpstreamContent(body, status) {
  if (UPSTREAM_RESTRICTION_PATTERN.test(body)) {
    const error = new Error('\u6f2b\u753b\u6570\u636e\u6e90\u6682\u65f6\u89e6\u53d1\u8bbf\u95ee\u9650\u5236\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002\u5df2\u6709\u7f13\u5b58\u7684\u5185\u5bb9\u4ecd\u53ef\u7ee7\u7eed\u9605\u8bfb\u3002');
    error.upstreamRestricted = true;
    throw error;
  }
  if (status < 200 || status >= 300) throw new Error(`\u6f2b\u753b\u6570\u636e\u6e90\u8bf7\u6c42\u5931\u8d25\uff08HTTP ${status}\uff09`);
}

async function fetchDesktopHtml(pathname, search = '') {
  const target = new URL(pathname, COPY_WEB_BASE);
  target.search = search;
  const response = await fetch(target, { headers: desktopHeaders(), signal: AbortSignal.timeout(15000) });
  const body = await response.text();
  assertUpstreamContent(body, response.status);
  return body;
}

async function fetchDesktopJson(pathname, search = '') {
  const target = new URL(pathname, COPY_WEB_BASE);
  target.search = search;
  const response = await fetch(target, { headers: desktopHeaders('application/json'), signal: AbortSignal.timeout(15000) });
  const body = await response.text();
  assertUpstreamContent(body, response.status);
  let data;
  try { data = JSON.parse(body); } catch { throw new Error('\u6f2b\u753b\u6570\u636e\u6e90\u8fd4\u56de\u4e86\u65e0\u6cd5\u8bc6\u522b\u7684\u6570\u636e'); }
  if (data?.code !== 200 || !data?.results) throw new Error(data?.message || '\u6f2b\u753b\u6570\u636e\u6e90\u8fd4\u56de\u5f02\u5e38');
  return data.results;
}


function decodePythonString(value = '') {
  return value.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
}

function parseComicListAttribute(html) {
  const encoded = html.match(/class="[^"]*\bexemptComic-box\b[^"]*"[^>]*\blist="([^"]*)"/i)?.[1] || '';
  const source = decodeHtml(encoded);
  const list = [];
  const itemPattern = /'path_word':\s*'((?:\\.|[^'])*)',\s*'name':\s*'((?:\\.|[^'])*)',\s*'cover':\s*'((?:\\.|[^'])*)',\s*'status':\s*(\d+),\s*'author':\s*\[([\s\S]*?)\](?=\s*})/g;
  for (const match of source.matchAll(itemPattern)) {
    const authors = Array.from(match[5].matchAll(/'name':\s*'((?:\\.|[^'])*)'/g), (author) => ({ name: decodePythonString(author[1]) }));
    list.push({ path_word: decodePythonString(match[1]), name: decodePythonString(match[2]), cover: decodePythonString(match[3]), status: Number(match[4]), author: authors, theme: [], region: '' });
  }
  return list;
}
function parseComicList(html, offset, limit) {
  const total = Number(html.match(/class="[^"]*\bexemptComic-box\b[^"]*"[^>]*\btotal="(\d+)"/i)?.[1] || 0);
  const list = parseComicListAttribute(html).slice(0, limit);
  if (!list.length) throw new Error('\u684c\u9762\u6f2b\u753b\u5217\u8868\u89e3\u6790\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5');
  return { total, offset, limit, list };
}

function extractListSection(html, labels) {
  return new RegExp(`<li>\\s*<span[^>]*>(?:${labels})[\uff1a:]<\\/span>([\\s\\S]*?)<\\/li>`, 'i').exec(html)?.[1] || '';
}

function parseComicDetail(html, pathWord) {
  const title = decodeHtml(html.match(/<h6\b[^>]*title="([^"]+)"/i)?.[1] || '').trim();
  const coverBlock = html.match(/<div\b[^>]*class="[^"]*\bcomicParticulars-left-img\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || '';
  const cover = decodeHtml(coverBlock.match(/(?:data-src|src)="([^"]+)"/i)?.[1] || '');
  const authorBlock = extractListSection(html, '\u4f5c\u8005');
  const themeBlock = extractListSection(html, '\u984c\u6750|\u9898\u6750');
  const links = (block) => Array.from(block.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi), (match) => ({ name: cleanHtmlText(match[1]).replace(/^#/, '') })).filter((item) => item.name);
  if (!title || !cover) throw new Error('\u684c\u9762\u6f2b\u753b\u8be6\u60c5\u89e3\u6790\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5');
  return { path_word: pathWord, name: title, alias: cleanHtmlText(extractListSection(html, '\u5225\u540d|\u522b\u540d')), cover, brief: cleanHtmlText(html.match(/<p\b[^>]*class="[^"]*\bintro\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1] || ''), author: links(authorBlock), theme: links(themeBlock), status: cleanHtmlText(extractListSection(html, '\u72c0\u614b|\u72b6\u6001')), region: '', popular: cleanHtmlText(extractListSection(html, '\u71b1\u5ea6|\u70ed\u5ea6')), datetime_updated: cleanHtmlText(extractListSection(html, '\u6700\u5f8c\u66f4\u65b0|\u6700\u540e\u66f4\u65b0')) };
}

function mangaCacheKey(request) {
  const url = new URL(request.url);
  url.protocol = 'https:';
  url.hostname = 'manga-cache.internal';
  url.port = '';
  url.searchParams.delete('_update');
  url.searchParams.delete('platform');
  url.searchParams.sort();
  url.searchParams.set('_source', MANGA_CACHE_VERSION);
  return new Request(url.toString());
}

const circuitCacheKey = () => new Request(`https://manga-cache.internal/${MANGA_CACHE_VERSION}/circuit`);

async function getCachePayload(key) {
  const cache = globalThis.caches?.default;
  if (!cache) return null;
  const response = await cache.match(key);
  return response?.json().catch(() => null) || null;
}

function storeCachePayload(key, payload, maxAge, ctx) {
  const cache = globalThis.caches?.default;
  if (!cache) return;
  const response = new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${maxAge}` } });
  const task = cache.put(key, response);
  if (ctx?.waitUntil) ctx.waitUntil(task);
}

async function isMangaCircuitOpen() {
  const payload = await getCachePayload(circuitCacheKey());
  return Number(payload?.blockedUntil || 0) > Date.now();
}

function mangaResponse(payload, cacheState = 'MISS') {
  const response = json(payload);
  response.headers.set('Cache-Control', 'private, max-age=30');
  response.headers.set('X-Manga-Cache', cacheState);
  return response;
}

async function loadCachedManga(request, ctx, freshSeconds, loader) {
  const key = mangaCacheKey(request);
  const cached = await getCachePayload(key);
  const age = cached?._proxy?.cachedAt ? Date.now() - cached._proxy.cachedAt : Number.POSITIVE_INFINITY;
  if (cached && age <= freshSeconds * 1000) return mangaResponse(cached, 'HIT');
  if (await isMangaCircuitOpen()) return cached ? mangaResponse(cached, 'STALE') : mangaResponse({ code: 503, message: '\u6f2b\u753b\u6570\u636e\u6e90\u6b63\u5728\u9650\u5236\u8bbf\u95ee\uff0c\u8bf7\u7ea6\u4e00\u5c0f\u65f6\u540e\u518d\u8bd5\u3002' }, 'BLOCKED');
  try {
    const payload = { code: 200, results: await loader(), _proxy: { source: 'mangacopy-desktop', cachedAt: Date.now() } };
    storeCachePayload(key, payload, MANGA_STALE_SECONDS, ctx);
    return mangaResponse(payload);
  } catch (error) {
    if (error?.upstreamRestricted || UPSTREAM_RESTRICTION_PATTERN.test(error?.message || '')) storeCachePayload(circuitCacheKey(), { blockedUntil: Date.now() + MANGA_CIRCUIT_SECONDS * 1000 }, MANGA_CIRCUIT_SECONDS, ctx);
    if (cached) return mangaResponse(cached, 'STALE');
    return mangaResponse({ code: 503, message: error instanceof Error ? error.message : '\u6f2b\u753b\u6570\u636e\u6e90\u6682\u65f6\u4e0d\u53ef\u7528\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5' }, 'ERROR');
  }
}

function extractDesktopChapterKeys(html) {
  const script = Array.from(html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))
    .map((match) => match[1])
    .find((content) => /\bcontentKey\s*=/.test(content));

  if (!script) {
    throw new Error('Desktop chapter payload was not found');
  }

  const variables = Object.fromEntries(
    Array.from(script.matchAll(/var\s+([A-Za-z_$][\w$]*)\s*=\s*'([^']*)'/g), (match) => [match[1], match[2]])
  );
  const contentKey = variables.contentKey;
  const decryptKey = variables.cct || Object.entries(variables)
    .find(([name, value]) => name !== 'contentKey' && new TextEncoder().encode(value).length === 16)?.[1];

  if (!contentKey || !decryptKey) {
    throw new Error('Desktop chapter decryption keys were not found');
  }

  return { contentKey, decryptKey };
}

async function decryptDesktopPayload(contentKey, decryptKey) {
  const iv = new TextEncoder().encode(contentKey.slice(0, 16));
  const encryptedHex = contentKey.slice(16);
  if (iv.length !== 16 || encryptedHex.length % 2 !== 0 || !/^[\da-f]+$/i.test(encryptedHex)) throw new Error('Desktop encrypted payload is invalid');
  const encrypted = new Uint8Array(encryptedHex.length / 2);
  for (let index = 0; index < encrypted.length; index += 1) encrypted[index] = Number.parseInt(encryptedHex.slice(index * 2, index * 2 + 2), 16);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(decryptKey), { name: 'AES-CBC' }, false, ['decrypt']);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, encrypted);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

async function decryptDesktopChapter(contentKey, decryptKey) {
  const contents = await decryptDesktopPayload(contentKey, decryptKey);
  if (!Array.isArray(contents) || contents.some((item) => typeof item?.url !== 'string')) throw new Error('Desktop chapter image list is invalid');
  return contents;
}

function normalizeDesktopChapters(payload) {
  const chapters = [];
  const seen = new Set();

  const visit = (value, key = '', depth = 0) => {
    if (!value || depth > 8 || key === 'last_chapter' || key === 'build') return;
    if (typeof value === 'string' && /^[\s]*[\[{]/.test(value)) {
      try { visit(JSON.parse(value), key, depth + 1); } catch { /* Ignore non-JSON text fields. */ }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, key, depth + 1));
      return;
    }
    if (typeof value !== 'object') return;

    const id = value.id ?? value.uuid;
    const name = value.name ?? value.title;
    if ((typeof id === 'string' || typeof id === 'number') && String(id) && typeof name === 'string' && name.trim()) {
      const uuid = String(id);
      if (!seen.has(uuid)) {
        seen.add(uuid);
        chapters.push({ uuid, name: name.trim(), index: chapters.length });
      }
      return;
    }

    Object.entries(value).forEach(([childKey, child]) => visit(child, childKey, depth + 1));
  };

  visit(payload, 'payload');
  return chapters;
}

async function fetchApiComicDetail(pathWord) {
  const resolvedPathWord = resolveComicPath(pathWord);
  const target = new URL(`${MANGA_API_FALLBACK_BASE}/comic2/${encodeURIComponent(resolvedPathWord)}`);
  target.search = new URLSearchParams({ _update: 'true', platform: '1' }).toString();
  const response = await fetch(target, {
    signal: AbortSignal.timeout(15000),
    headers: {
      Accept: 'application/json',
      Origin: COPY_WEB_BASE,
      Referer: `${COPY_WEB_BASE}/comic/${encodeURIComponent(resolvedPathWord)}`,
      'User-Agent': DESKTOP_USER_AGENT,
      platform: '1',
      region: '1',
      version: '2026.03.30',
      webp: '1'
    }
  });
  const body = await response.text();
  assertUpstreamContent(body, response.status);
  let data;
  try { data = JSON.parse(body); } catch { throw new Error('Comic detail fallback returned invalid data'); }
  const comic = data?.code === 200 ? (data?.results?.comic || data?.results) : null;
  if (!comic?.name) throw new Error(data?.message || 'Comic detail fallback returned no content');
  return comic;
}

async function fetchApiComicChapters(pathWord) {
  const resolvedPathWord = resolveComicPath(pathWord);
  const target = new URL(`${MANGA_API_FALLBACK_BASE}/comic/${encodeURIComponent(resolvedPathWord)}/group/default/chapters`);
  target.search = new URLSearchParams({ limit: '500', offset: '0', _update: 'true' }).toString();
  const response = await fetch(target, {
    signal: AbortSignal.timeout(15000),
    headers: {
      Accept: 'application/json',
      Origin: COPY_WEB_BASE,
      Referer: `${COPY_WEB_BASE}/comic/${encodeURIComponent(pathWord)}`,
      'User-Agent': DESKTOP_USER_AGENT,
      platform: '1',
      region: '1',
      version: '2026.03.30',
      webp: '1'
    }
  });
  const body = await response.text();
  assertUpstreamContent(body, response.status);
  let data;
  try { data = JSON.parse(body); } catch { throw new Error('Comic catalog fallback returned invalid data'); }
  const list = data?.code === 200 && Array.isArray(data?.results?.list) ? data.results.list : [];
  if (!list.length) throw new Error(data?.message || '\u684c\u9762\u6f2b\u753b\u76ee\u5f55\u4e3a\u7a7a');
  return list.map((chapter, index) => ({
    uuid: String(chapter.uuid || chapter.id || ''),
    name: chapter.name || `\u7b2c ${index + 1} \u8bdd`,
    index: Number.isFinite(Number(chapter.index)) ? Number(chapter.index) : index
  })).filter((chapter) => chapter.uuid);
}

async function fetchDesktopComicChapters(pathWord) {
  if (resolveComicPath(pathWord) !== pathWord) return fetchApiComicChapters(pathWord);
  const resolvedPathWord = resolveComicPath(pathWord);
  const detailPath = `/comic/${encodeURIComponent(resolvedPathWord)}`;
  const html = await fetchDesktopHtml(detailPath);
  const decryptKey = html.match(/\bvar\s+ccz\s*=\s*'([^']+)'/i)?.[1];
  const dnts = html.match(/id="dnt"[^>]*\bvalue="([^"]+)"/i)?.[1];
  if (!decryptKey || !dnts) throw new Error('\u684c\u9762\u6f2b\u753b\u76ee\u5f55\u5bc6\u94a5\u89e3\u6790\u5931\u8d25');
  const target = new URL(`/comicdetail/${encodeURIComponent(resolvedPathWord)}/chapters`, COPY_WEB_BASE);
  const response = await fetch(target, { signal: AbortSignal.timeout(15000), headers: { ...desktopHeaders('application/json'), dnts, Referer: new URL(detailPath, COPY_WEB_BASE).toString() } });
  const body = await response.text();
  assertUpstreamContent(body, response.status);
  let data;
  try { data = JSON.parse(body); } catch { throw new Error('\u684c\u9762\u6f2b\u753b\u76ee\u5f55\u8fd4\u56de\u5f02\u5e38'); }
  if (data?.code !== 200 || typeof data?.results !== 'string') throw new Error(data?.message || '\u684c\u9762\u6f2b\u753b\u76ee\u5f55\u52a0\u8f7d\u5931\u8d25');
  const payload = await decryptDesktopPayload(data.results, decryptKey);
  const chapters = normalizeDesktopChapters(payload);
  if (!chapters.length) {
    console.warn('Desktop comic catalog is empty; using API fallback', { pathWord });
    return fetchApiComicChapters(pathWord);
  }
  return chapters;
}

async function fetchApiComicChapter(pathWord, chapterUuid) {
  const resolvedPathWord = resolveComicPath(pathWord);
  const target = new URL(`${MANGA_API_FALLBACK_BASE}/comic/${encodeURIComponent(resolvedPathWord)}/chapter/${encodeURIComponent(chapterUuid)}`);
  target.search = new URLSearchParams({ _update: 'true', platform: '1' }).toString();
  const response = await fetch(target, {
    signal: AbortSignal.timeout(15000),
    headers: {
      Accept: 'application/json',
      Origin: COPY_WEB_BASE,
      Referer: `${COPY_WEB_BASE}/comic/${encodeURIComponent(resolvedPathWord)}/chapter/${encodeURIComponent(chapterUuid)}`,
      'User-Agent': DESKTOP_USER_AGENT,
      platform: '1',
      region: '1',
      version: '2026.03.30',
      webp: '1'
    }
  });
  const body = await response.text();
  assertUpstreamContent(body, response.status);
  let data;
  try { data = JSON.parse(body); } catch { throw new Error('Comic chapter fallback returned invalid data'); }
  const chapter = data?.code === 200 ? (data?.results?.chapter || data?.results) : null;
  const contents = Array.isArray(chapter?.contents) ? chapter.contents.filter((item) => typeof item?.url === 'string' && item.url) : [];
  if (!contents.length) throw new Error(data?.message || 'Comic chapter fallback returned no images');
  return {
    chapter: {
      ...chapter,
      uuid: String(chapter.uuid || chapterUuid),
      contents,
      words: Array.isArray(chapter.words) ? chapter.words : contents.map((_, index) => index),
      resolved_path_word: resolvedPathWord
    }
  };
}

async function fetchDesktopComicChapter(pathWord, chapterUuid) {
  const resolvedPathWord = resolveComicPath(pathWord);
  const chapterUrl = `${COPY_WEB_BASE}/comic/${encodeURIComponent(resolvedPathWord)}/chapter/${encodeURIComponent(chapterUuid)}`;
  const upstream = await fetch(chapterUrl, {
    signal: AbortSignal.timeout(15000),
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'User-Agent': DESKTOP_USER_AGENT
    }
  });

  if (!upstream.ok) {
    return json({ code: upstream.status, message: `Desktop chapter request failed (HTTP ${upstream.status})` }, { status: upstream.status });
  }

  try {
    const html = await upstream.text();
    const { contentKey, decryptKey } = extractDesktopChapterKeys(html);
    const contents = await decryptDesktopChapter(contentKey, decryptKey);
    const response = json({
      code: 200,
      results: {
        chapter: {
          uuid: chapterUuid,
          contents,
          words: contents.map((_, index) => index)
        }
      }
    });
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=3600');
    return response;
  } catch (desktopError) {
    try {
      const results = await fetchApiComicChapter(pathWord, chapterUuid);
      const response = json({ code: 200, results });
      response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=3600');
      response.headers.set('X-Manga-Source', 'api-fallback');
      return response;
    } catch (fallbackError) {
      const message = fallbackError instanceof Error
        ? fallbackError.message
        : (desktopError instanceof Error ? desktopError.message : 'Comic chapter loading failed');
      return json({ code: 502, message }, { status: 502 });
    }
  }
}

async function handleMangaProxy(request, ctx) {
  const url = new URL(request.url);
  const apiPath = url.pathname.slice('/api/manga/'.length);
  if (!MANGA_ROUTE_PATTERN.test(apiPath)) return badRequest('Unsupported manga endpoint', 404);

  const chapterMatch = apiPath.match(/^comic\/([^/]+)\/chapter\/([^/]+)$/);
  if (chapterMatch) {
    const pathWord = decodeURIComponent(chapterMatch[1]);
    const chapterUuid = decodeURIComponent(chapterMatch[2]);
    return loadCachedManga(request, ctx, 24 * 60 * 60, async () => {
      const response = await fetchDesktopComicChapter(pathWord, chapterUuid);
      const data = await response.json();
      if (data?.code !== 200 || !data?.results) throw new Error(data?.message || 'Desktop chapter loading failed');
      return data.results;
    });
  }

  if (apiPath === 'comics') {
    const offset = Math.max(Number(url.searchParams.get('offset') || 0), 0);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 20), 1), 50);
    const search = new URLSearchParams({ ordering: url.searchParams.get('ordering') || '-datetime_updated', offset: String(offset), limit: String(limit) });
    return loadCachedManga(request, ctx, 10 * 60, async () => parseComicList(await fetchDesktopHtml('/comics', search.toString()), offset, limit));
  }

  if (apiPath === 'search/comic') {
    const offset = Math.max(Number(url.searchParams.get('offset') || 0), 0);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 20), 1), 50);
    const search = new URLSearchParams({ offset: String(offset), platform: '2', limit: String(limit), q: url.searchParams.get('q') || '', q_type: url.searchParams.get('q_type') || '' });
    return loadCachedManga(request, ctx, 10 * 60, async () => {
      const results = await fetchDesktopJson('/api/kb/web/searchci/comics', search.toString());
      return { total: Number(results.total || 0), offset, limit, list: Array.isArray(results.list) ? results.list : [] };
    });
  }

  const detailMatch = apiPath.match(/^comic2\/([^/]+)$/);
  if (detailMatch) {
    const pathWord = decodeURIComponent(detailMatch[1]);
    return loadCachedManga(request, ctx, 6 * 60 * 60, async () => {
      if (resolveComicPath(pathWord) !== pathWord) return { comic: await fetchApiComicDetail(pathWord) };
      try {
        return { comic: parseComicDetail(await fetchDesktopHtml(`/comic/${encodeURIComponent(pathWord)}`), pathWord) };
      } catch {
        return { comic: await fetchApiComicDetail(pathWord) };
      }
    });
  }

  const chaptersMatch = apiPath.match(/^comic\/([^/]+)\/group\/default\/chapters$/);
  if (chaptersMatch) {
    const pathWord = decodeURIComponent(chaptersMatch[1]);
    const offset = Math.max(Number(url.searchParams.get('offset') || 0), 0);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 100), 1), 500);
    return loadCachedManga(request, ctx, 6 * 60 * 60, async () => {
      const chapters = await fetchDesktopComicChapters(pathWord);
      return { total: chapters.length, offset, limit, list: chapters.slice(offset, offset + limit) };
    });
  }

  return badRequest('Unsupported manga endpoint', 404);
}

async function handleNovelProxy(request) {
  const url = new URL(request.url);
  const apiPath = url.pathname.slice('/api/novels/'.length);

  if (!NOVEL_ROUTE_PATTERN.test(apiPath)) {
    return badRequest('Unsupported novel endpoint', 404);
  }

  return fetchCopyApi(apiPath, url.search);
}

function normalizeRow(row) {
  if (!row) return null;

  return {
    id: `${row.user_id}:${row.book_id}`,
    bookId: row.book_id,
    bookTitle: row.book_title,
    volumeId: row.volume_id,
    volumeTitle: row.volume_title,
    anchorId: row.anchor_id,
    anchorOffset: Number(row.anchor_offset || 0),
    scrollY: Number(row.scroll_y || 0),
    updatedAt: row.updated_at
  };
}

function normalizeFavorite(row) {
  if (!row) return null;

  let authors = [];
  try {
    authors = JSON.parse(row.authors || '[]');
  } catch {
    authors = [];
  }

  return {
    id: `${row.user_id}:${row.content_type}:${row.path_word}`,
    contentType: row.content_type,
    pathWord: row.path_word,
    title: row.title,
    cover: row.cover,
    authors: Array.isArray(authors) ? authors : [],
    updatedAt: row.updated_at
  };
}

async function requireUser(request, env) {
  const session = await createAuth(request, env).api.getSession({ headers: request.headers });
  return session?.user || null;
}

async function handleGetProgress(request, env) {
  const url = new URL(request.url);
  const bookId = url.searchParams.get('bookId');
  const user = await requireUser(request, env);

  if (!user) return credentialJson({ ok: false, error: '请先登录' }, request, env, 401);
  if (!bookId) return credentialJson({ ok: false, error: 'Missing bookId' }, request, env, 400);

  const { results } = await env.DB.prepare(
    `SELECT * FROM user_reading_progress WHERE user_id = ?1 AND book_id = ?2 LIMIT 1`
  )
    .bind(user.id, bookId)
    .all();

  return credentialJson({
    ok: true,
    record: normalizeRow(results?.[0] || null)
  }, request, env);
}

async function handleListProgress(request, env) {
  const user = await requireUser(request, env);

  if (!user) return credentialJson({ ok: false, error: '请先登录' }, request, env, 401);

  const { results } = await env.DB.prepare(
    `SELECT * FROM user_reading_progress WHERE user_id = ?1 ORDER BY updated_at DESC LIMIT 200`
  )
    .bind(user.id)
    .all();

  return credentialJson({
    ok: true,
    records: (results || []).map(normalizeRow)
  }, request, env);
}

async function handleSaveProgress(request, env) {
  const user = await requireUser(request, env);
  if (!user) return credentialJson({ ok: false, error: '请先登录' }, request, env, 401);

  const body = await request.json().catch(() => null);
  if (!body) return credentialJson({ ok: false, error: 'Invalid JSON' }, request, env, 400);

  const bookId = body.bookId;
  const volumeId = String(body.volumeId || '');
  const updatedAt = body.updatedAt || new Date().toISOString();

  if (!bookId) return credentialJson({ ok: false, error: 'Missing bookId' }, request, env, 400);
  if (!volumeId) return credentialJson({ ok: false, error: 'Missing volumeId' }, request, env, 400);

  await env.DB.prepare(
    `
    INSERT INTO user_reading_progress (
      user_id, book_id, book_title, volume_id, volume_title,
      anchor_id, anchor_offset, scroll_y, updated_at
    )
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    ON CONFLICT(user_id, book_id) DO UPDATE SET
      book_title = excluded.book_title,
      volume_id = excluded.volume_id,
      volume_title = excluded.volume_title,
      anchor_id = excluded.anchor_id,
      anchor_offset = excluded.anchor_offset,
      scroll_y = excluded.scroll_y,
      updated_at = excluded.updated_at
    `
  )
    .bind(
      user.id,
      bookId,
      body.bookTitle || '',
      volumeId,
      body.volumeTitle || '',
      body.anchorId || '',
      Number(body.anchorOffset || 0),
      Number(body.scrollY || 0),
      updatedAt
    )
    .run();

  const { results } = await env.DB.prepare(
    `SELECT * FROM user_reading_progress WHERE user_id = ?1 AND book_id = ?2 LIMIT 1`
  )
    .bind(user.id, bookId)
    .all();

  return credentialJson({
    ok: true,
    record: normalizeRow(results?.[0] || null)
  }, request, env);
}

function readFavoriteIdentity(url) {
  return {
    contentType: url.searchParams.get('contentType'),
    pathWord: url.searchParams.get('pathWord')
  };
}

function isValidContentType(value) {
  return value === 'novel' || value === 'comic';
}

async function handleGetFavorite(request, env) {
  const user = await requireUser(request, env);
  if (!user) return credentialJson({ ok: false, error: '请先登录' }, request, env, 401);

  const { contentType, pathWord } = readFavoriteIdentity(new URL(request.url));
  if (!isValidContentType(contentType)) {
    return credentialJson({ ok: false, error: 'Invalid contentType' }, request, env, 400);
  }
  if (!pathWord) return credentialJson({ ok: false, error: 'Missing pathWord' }, request, env, 400);

  const row = await env.DB.prepare(
    `SELECT * FROM user_favorites WHERE user_id = ?1 AND content_type = ?2 AND path_word = ?3 LIMIT 1`
  )
    .bind(user.id, contentType, pathWord)
    .first();

  return credentialJson({ ok: true, favorite: normalizeFavorite(row) }, request, env);
}

async function handleListFavorites(request, env) {
  const user = await requireUser(request, env);
  if (!user) return credentialJson({ ok: false, error: '请先登录' }, request, env, 401);

  const contentType = new URL(request.url).searchParams.get('contentType');
  if (contentType && !isValidContentType(contentType)) {
    return credentialJson({ ok: false, error: 'Invalid contentType' }, request, env, 400);
  }

  const statement = contentType
    ? env.DB.prepare(
        `SELECT * FROM user_favorites WHERE user_id = ?1 AND content_type = ?2 ORDER BY updated_at DESC LIMIT 500`
      ).bind(user.id, contentType)
    : env.DB.prepare(
        `SELECT * FROM user_favorites WHERE user_id = ?1 ORDER BY updated_at DESC LIMIT 500`
      ).bind(user.id);
  const { results } = await statement.all();

  return credentialJson({
    ok: true,
    favorites: (results || []).map(normalizeFavorite)
  }, request, env);
}

async function handleSaveFavorite(request, env) {
  const user = await requireUser(request, env);
  if (!user) return credentialJson({ ok: false, error: '请先登录' }, request, env, 401);

  const body = await request.json().catch(() => null);
  if (!body) return credentialJson({ ok: false, error: 'Invalid JSON' }, request, env, 400);
  if (!isValidContentType(body.contentType)) {
    return credentialJson({ ok: false, error: 'Invalid contentType' }, request, env, 400);
  }
  if (!body.pathWord) return credentialJson({ ok: false, error: 'Missing pathWord' }, request, env, 400);
  if (!body.title) return credentialJson({ ok: false, error: 'Missing title' }, request, env, 400);

  const updatedAt = new Date().toISOString();
  await env.DB.prepare(
    `
    INSERT INTO user_favorites (user_id, content_type, path_word, title, cover, authors, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
    ON CONFLICT(user_id, content_type, path_word) DO UPDATE SET
      title = excluded.title,
      cover = excluded.cover,
      authors = excluded.authors,
      updated_at = excluded.updated_at
    `
  )
    .bind(
      user.id,
      body.contentType,
      String(body.pathWord),
      String(body.title),
      String(body.cover || ''),
      JSON.stringify(Array.isArray(body.authors) ? body.authors : []),
      updatedAt
    )
    .run();

  const row = await env.DB.prepare(
    `SELECT * FROM user_favorites WHERE user_id = ?1 AND content_type = ?2 AND path_word = ?3 LIMIT 1`
  )
    .bind(user.id, body.contentType, body.pathWord)
    .first();

  return credentialJson({ ok: true, favorite: normalizeFavorite(row) }, request, env);
}

async function handleDeleteFavorite(request, env) {
  const user = await requireUser(request, env);
  if (!user) return credentialJson({ ok: false, error: '请先登录' }, request, env, 401);

  const { contentType, pathWord } = readFavoriteIdentity(new URL(request.url));
  if (!isValidContentType(contentType)) {
    return credentialJson({ ok: false, error: 'Invalid contentType' }, request, env, 400);
  }
  if (!pathWord) return credentialJson({ ok: false, error: 'Missing pathWord' }, request, env, 400);

  await env.DB.prepare(
    `DELETE FROM user_favorites WHERE user_id = ?1 AND content_type = ?2 AND path_word = ?3`
  )
    .bind(user.id, contentType, pathWord)
    .run();

  return credentialJson({ ok: true }, request, env);
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env, ctx);
    } catch (error) {
      console.error('Unhandled worker request error', error);
      const url = new URL(request.url);
      const credentialRoute =
        url.pathname.startsWith('/api/auth/') ||
        url.pathname.startsWith('/api/progress') ||
        url.pathname.startsWith('/api/favorites');

      if (credentialRoute) {
        return credentialJson({ ok: false, error: '服务器暂时无法处理请求，请稍后重试' }, request, env, 500);
      }

      return json({ ok: false, error: '服务器暂时无法处理请求，请稍后重试' }, { status: 500 });
    }
  }
};

async function handleRequest(request, env, ctx) {
    const url = new URL(request.url);

    const credentialRoute =
      url.pathname.startsWith('/api/auth/') ||
      url.pathname.startsWith('/api/progress') ||
      url.pathname.startsWith('/api/favorites');

    if (request.method === 'OPTIONS' && credentialRoute) {
      return new Response(null, { status: 204, headers: credentialHeaders(request, env) });
    }

    if (request.method === 'OPTIONS') {
      return json({ ok: true });
    }

    if (url.pathname.startsWith('/api/auth/')) {
      if (!isTrustedOrigin(request, env)) {
        return credentialJson({ message: 'Origin not allowed' }, request, env, 403);
      }
      return withCredentialCors(await createAuth(request, env).handler(request), request, env);
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/manga/')) {
      return handleMangaProxy(request, ctx);
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/novels/')) {
      return handleNovelProxy(request);
    }

    if (request.method === 'GET' && url.pathname === '/api/progress') {
      return handleGetProgress(request, env);
    }

    if (request.method === 'GET' && url.pathname === '/api/progress/list') {
      return handleListProgress(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/api/progress') {
      return handleSaveProgress(request, env);
    }

    if (request.method === 'GET' && url.pathname === '/api/favorites') {
      return handleGetFavorite(request, env);
    }

    if (request.method === 'GET' && url.pathname === '/api/favorites/list') {
      return handleListFavorites(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/api/favorites') {
      return handleSaveFavorite(request, env);
    }

    if (request.method === 'DELETE' && url.pathname === '/api/favorites') {
      return handleDeleteFavorite(request, env);
    }

    return badRequest('Not found', 404);
}
