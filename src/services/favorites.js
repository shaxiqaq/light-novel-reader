import { cloudSyncConfig } from '../config/cloudSync';

const API_BASE = (import.meta.env.VITE_CLOUDFLARE_PROGRESS_API || cloudSyncConfig.apiBase || '').replace(/\/$/, '');

function buildUrl(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

async function readJson(response, action) {
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || `${action}失败（HTTP ${response.status}）`);
  }
  return data;
}

export async function getFavorite(contentType, pathWord) {
  const response = await fetch(buildUrl('/api/favorites', { contentType, pathWord }), {
    credentials: 'include'
  });
  const data = await readJson(response, '读取收藏状态');
  return data.favorite || null;
}

export async function listFavorites(contentType = '') {
  const response = await fetch(buildUrl('/api/favorites/list', { contentType }), {
    credentials: 'include'
  });
  const data = await readJson(response, '读取收藏列表');
  return data.favorites || [];
}

export async function saveFavorite(favorite) {
  const response = await fetch(buildUrl('/api/favorites'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(favorite)
  });
  const data = await readJson(response, '保存收藏');
  return data.favorite;
}

export async function deleteFavorite(contentType, pathWord) {
  const response = await fetch(buildUrl('/api/favorites', { contentType, pathWord }), {
    method: 'DELETE',
    credentials: 'include'
  });
  await readJson(response, '取消收藏');
}
