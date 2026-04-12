const API_BASE = 'https://api.2026copy.com/api/v3';

function ensureOk(response, action) {
  if (!response.ok) {
    throw new Error(`${action} failed with HTTP ${response.status}`);
  }
}

async function readJson(response, action) {
  ensureOk(response, action);
  const data = await response.json();

  if (data?.code !== 200 || !data?.results) {
    throw new Error(data?.message || `${action} failed`);
  }

  return data.results;
}

export async function fetchBooks({ offset = 0, limit = 20 } = {}) {
  const query = new URLSearchParams({
    ordering: '-datetime_updated',
    limit: String(limit),
    offset: String(offset),
    free_type: '1',
    _update: 'true'
  });

  const response = await fetch(`${API_BASE}/books?${query.toString()}`);
  const results = await readJson(response, 'Loading book list');

  return {
    total: results.total ?? 0,
    limit: results.limit ?? limit,
    offset: results.offset ?? offset,
    list: (results.list || []).map((item) => ({
      pathWord: item.path_word,
      title: item.name,
      cover: item.cover,
      authors: (item.author || []).map((author) => author.name),
      status: item.status,
      popularity: item.popular,
      updatedAt: item.datetime_updated
    }))
  };
}

export async function searchBooks({ keyword, offset = 0, limit = 20, qType = '' } = {}) {
  const query = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    q: keyword,
    _update: 'true'
  });

  if (qType !== '' && qType !== null && qType !== undefined) {
    query.set('q_type', String(qType));
  }

  const response = await fetch(`${API_BASE}/search/books?${query.toString()}`);
  const results = await readJson(response, 'Searching books');

  return {
    total: results.total ?? 0,
    limit: results.limit ?? limit,
    offset: results.offset ?? offset,
    list: (results.list || []).map((item) => ({
      pathWord: item.path_word,
      title: item.name,
      cover: item.cover,
      authors: (item.author || []).map((author) => author.name),
      status: item.status ?? null,
      popularity: item.popular,
      updatedAt: item.datetime_updated ?? ''
    }))
  };
}

export async function fetchBookBundle(pathWord) {
  const [detailResponse, volumesResponse] = await Promise.all([
    fetch(`${API_BASE}/book/${pathWord}?_update=true`),
    fetch(`${API_BASE}/book/${pathWord}/volumes`)
  ]);

  const [detailResults, volumeResults] = await Promise.all([
    readJson(detailResponse, 'Loading book detail'),
    readJson(volumesResponse, 'Loading volume list')
  ]);

  return {
    meta: {
      isLock: detailResults.is_lock,
      isLogin: detailResults.is_login,
      isVip: detailResults.is_vip,
      isMobileBind: detailResults.is_mobile_bind
    },
    book: {
      uuid: detailResults.book.uuid,
      title: detailResults.book.name,
      pathWord: detailResults.book.path_word,
      brief: detailResults.book.brief,
      cover: detailResults.book.cover,
      updatedAt: detailResults.book.datetime_updated,
      popularity: detailResults.book.popular,
      region: detailResults.book.region?.display || '',
      status: detailResults.book.status?.display || '',
      authors: (detailResults.book.author || []).map((author) => author.name),
      themes: (detailResults.book.theme || []).map((theme) => theme.name),
      lastChapter: detailResults.book.last_chapter
        ? {
            id: detailResults.book.last_chapter.id,
            name: detailResults.book.last_chapter.name
          }
        : null
    },
    volumes: (volumeResults.list || []).map((volume) => ({
      id: volume.id,
      index: volume.index,
      count: volume.count,
      sort: volume.sort,
      title: volume.name,
      prev: volume.prev,
      next: volume.next
    }))
  };
}

export async function fetchVolume(pathWord, volumeId) {
  const response = await fetch(`${API_BASE}/book/${pathWord}/volume/${volumeId}?_update=true`);
  const results = await readJson(response, 'Loading volume content');

  return {
    meta: {
      isLock: results.is_lock,
      isLogin: results.is_login,
      isVip: results.is_vip,
      isMobileBind: results.is_mobile_bind
    },
    book: {
      title: results.book.name,
      uuid: results.book.uuid,
      pathWord: results.book.path_word
    },
    volume: {
      id: results.volume.id,
      index: results.volume.index,
      title: results.volume.name,
      prev: results.volume.prev,
      next: results.volume.next,
      count: results.volume.count,
      txtAddr: results.volume.txt_addr,
      txtEncoding: results.volume.txt_encoding || 'GBK',
      contents: results.volume.contents || []
    }
  };
}

export async function fetchVolumeLines(txtAddr, txtEncoding = 'gbk') {
  const response = await fetch(txtAddr);
  ensureOk(response, 'Loading text file');

  const buffer = await response.arrayBuffer();
  const encoding = (txtEncoding || 'gbk').toLowerCase();
  const decoder = new TextDecoder(encoding);
  const text = decoder.decode(buffer);

  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}
