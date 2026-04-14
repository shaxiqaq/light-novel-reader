function getConfig() {
  return {
    apiBase: (import.meta.env.VITE_CLOUDFLARE_PROGRESS_API || '').replace(/\/$/, ''),
    syncKey: import.meta.env.VITE_READING_SYNC_KEY || ''
  };
}

export function isCloudSyncEnabled() {
  const config = getConfig();
  return Boolean(config.apiBase && config.syncKey);
}

function buildUrl(path, params = {}) {
  const { apiBase, syncKey } = getConfig();
  const url = new URL(`${apiBase}${path}`);
  url.searchParams.set('syncKey', syncKey);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

async function readJson(response, action) {
  if (!response.ok) {
    throw new Error(`${action} failed with HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!data?.ok) {
    throw new Error(data?.error || `${action} failed`);
  }

  return data;
}

function normalizeRecord(record) {
  if (!record) {
    return null;
  }

  return {
    objectId: record.id || '',
    syncKey: record.syncKey || '',
    bookId: record.bookId || '',
    bookTitle: record.bookTitle || '',
    volumeId: String(record.volumeId || ''),
    volumeTitle: record.volumeTitle || '',
    anchorId: record.anchorId || '',
    anchorOffset: Number(record.anchorOffset || 0),
    scrollY: Number(record.scrollY || 0),
    updatedAtClient: record.updatedAt || ''
  };
}

export async function fetchCloudProgress(bookId) {
  if (!isCloudSyncEnabled()) {
    return null;
  }

  const response = await fetch(buildUrl('/api/progress', { bookId }));
  const data = await readJson(response, 'Loading cloud progress');
  return normalizeRecord(data.record);
}

export async function listCloudProgress() {
  if (!isCloudSyncEnabled()) {
    return [];
  }

  const response = await fetch(buildUrl('/api/progress/list'));
  const data = await readJson(response, 'Loading cloud progress list');
  return (data.records || []).map(normalizeRecord).filter(Boolean);
}

export async function saveCloudProgress(progress) {
  if (!isCloudSyncEnabled()) {
    return null;
  }

  const { syncKey } = getConfig();
  const response = await fetch(buildUrl('/api/progress'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      syncKey,
      bookId: progress.bookId,
      bookTitle: progress.bookTitle,
      volumeId: String(progress.volumeId || ''),
      volumeTitle: progress.volumeTitle,
      anchorId: progress.anchorId,
      anchorOffset: Number(progress.anchorOffset || 0),
      scrollY: Number(progress.scrollY || 0),
      updatedAt: progress.updatedAtClient || new Date().toISOString()
    })
  });

  const data = await readJson(response, 'Saving cloud progress');
  return normalizeRecord(data.record);
}
