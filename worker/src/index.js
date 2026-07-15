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

function badRequest(message, status = 400) {
  return json({ ok: false, error: message }, { status });
}

const COPY_API_BASE = 'https://api.2026copy.com/api/v3';
const MANGA_ROUTE_PATTERN = /^(?:comics|search\/comic|comic2\/[^/]+|comic\/[^/]+\/(?:group\/default\/chapters|chapter2?\/[^/]+))$/;
const NOVEL_ROUTE_PATTERN = /^(?:books|search\/books|book\/[^/]+(?:\/volumes|\/volume\/[^/]+)?)$/;

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

async function handleMangaProxy(request) {
  const url = new URL(request.url);
  const apiPath = url.pathname.slice('/api/manga/'.length);

  if (!MANGA_ROUTE_PATTERN.test(apiPath)) {
    return badRequest('Unsupported manga endpoint', 404);
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
    id: `${row.sync_key}:${row.book_id}`,
    syncKey: row.sync_key,
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

async function handleGetProgress(request, env) {
  const url = new URL(request.url);
  const syncKey = url.searchParams.get('syncKey');
  const bookId = url.searchParams.get('bookId');

  if (!syncKey) return badRequest('Missing syncKey');
  if (!bookId) return badRequest('Missing bookId');

  const { results } = await env.DB.prepare(
    `SELECT * FROM reading_progress WHERE sync_key = ?1 AND book_id = ?2 LIMIT 1`
  )
    .bind(syncKey, bookId)
    .all();

  return json({
    ok: true,
    record: normalizeRow(results?.[0] || null)
  });
}

async function handleListProgress(request, env) {
  const url = new URL(request.url);
  const syncKey = url.searchParams.get('syncKey');

  if (!syncKey) return badRequest('Missing syncKey');

  const { results } = await env.DB.prepare(
    `SELECT * FROM reading_progress WHERE sync_key = ?1 ORDER BY updated_at DESC LIMIT 200`
  )
    .bind(syncKey)
    .all();

  return json({
    ok: true,
    records: (results || []).map(normalizeRow)
  });
}

async function handleSaveProgress(request, env) {
  const body = await request.json().catch(() => null);
  if (!body) return badRequest('Invalid JSON');

  const syncKey = body.syncKey;
  const bookId = body.bookId;
  const volumeId = String(body.volumeId || '');
  const updatedAt = body.updatedAt || new Date().toISOString();

  if (!syncKey) return badRequest('Missing syncKey');
  if (!bookId) return badRequest('Missing bookId');
  if (!volumeId) return badRequest('Missing volumeId');

  await env.DB.prepare(
    `
    INSERT INTO reading_progress (
      sync_key, book_id, book_title, volume_id, volume_title,
      anchor_id, anchor_offset, scroll_y, updated_at
    )
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    ON CONFLICT(sync_key, book_id) DO UPDATE SET
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
      syncKey,
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
    `SELECT * FROM reading_progress WHERE sync_key = ?1 AND book_id = ?2 LIMIT 1`
  )
    .bind(syncKey, bookId)
    .all();

  return json({
    ok: true,
    record: normalizeRow(results?.[0] || null)
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return json({ ok: true });
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

    return badRequest('Not found', 404);
  }
};
