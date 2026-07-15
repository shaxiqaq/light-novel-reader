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
const MANGA_ROUTE_PATTERN = /^(?:comics|search\/comic|comic2\/[^/]+|comic\/[^/]+\/(?:group\/default\/chapters|chapter\/[^/]+))$/;
const NOVEL_ROUTE_PATTERN = /^(?:books|search\/books|book\/[^/]+(?:\/volumes|\/volume\/[^/]+)?)$/;
const DESKTOP_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';

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

async function decryptDesktopChapter(contentKey, decryptKey) {
  const iv = new TextEncoder().encode(contentKey.slice(0, 16));
  const encryptedHex = contentKey.slice(16);

  if (iv.length !== 16 || encryptedHex.length % 2 !== 0 || !/^[\da-f]+$/i.test(encryptedHex)) {
    throw new Error('Desktop chapter payload is invalid');
  }

  const encrypted = new Uint8Array(encryptedHex.length / 2);
  for (let index = 0; index < encrypted.length; index += 1) {
    encrypted[index] = Number.parseInt(encryptedHex.slice(index * 2, index * 2 + 2), 16);
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(decryptKey),
    { name: 'AES-CBC' },
    false,
    ['decrypt']
  );
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, encrypted);
  const contents = JSON.parse(new TextDecoder().decode(decrypted));

  if (!Array.isArray(contents) || contents.some((item) => typeof item?.url !== 'string')) {
    throw new Error('Desktop chapter image list is invalid');
  }

  return contents;
}

async function fetchDesktopComicChapter(pathWord, chapterUuid) {
  const chapterUrl = `${COPY_WEB_BASE}/comic/${encodeURIComponent(pathWord)}/chapter/${encodeURIComponent(chapterUuid)}`;
  const upstream = await fetch(chapterUrl, {
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
  } catch (error) {
    return json({ code: 502, message: error instanceof Error ? error.message : 'Desktop chapter decoding failed' }, { status: 502 });
  }
}

async function handleMangaProxy(request) {
  const url = new URL(request.url);
  const apiPath = url.pathname.slice('/api/manga/'.length);

  if (!MANGA_ROUTE_PATTERN.test(apiPath)) {
    return badRequest('Unsupported manga endpoint', 404);
  }

  const desktopChapter = apiPath.match(/^comic\/([^/]+)\/chapter\/([^/]+)$/);
  if (desktopChapter) {
    return fetchDesktopComicChapter(
      decodeURIComponent(desktopChapter[1]),
      decodeURIComponent(desktopChapter[2])
    );
  }

  return fetchCopyApi(apiPath, url.search);
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
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
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

async function handleRequest(request, env) {
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
      return handleMangaProxy(request);
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
