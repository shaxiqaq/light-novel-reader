import { createAuthClient } from 'better-auth/vue';
import { reactive } from 'vue';
import { cloudSyncConfig } from '../config/cloudSync';

const API_BASE = (
  import.meta.env.VITE_CLOUDFLARE_PROGRESS_API ||
  cloudSyncConfig.apiBase ||
  ''
).replace(/\/$/, '');

export const authClient = createAuthClient({
  baseURL: API_BASE,
  fetchOptions: {
    credentials: 'include'
  }
});

export const authState = reactive({
  user: null,
  session: null,
  loading: true
});

export async function refreshSession() {
  authState.loading = true;
  try {
    const { data } = await authClient.getSession();
    authState.user = data?.user || null;
    authState.session = data?.session || null;
    return data || null;
  } catch {
    authState.user = null;
    authState.session = null;
    return null;
  } finally {
    authState.loading = false;
  }
}

export async function signOutAccount() {
  await authClient.signOut();
  await refreshSession();
}
