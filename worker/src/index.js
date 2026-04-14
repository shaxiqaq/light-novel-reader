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
