<script setup>
import { Heart, LoaderCircle } from 'lucide-vue-next';
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import Button from './ui/button/Button.vue';
import { authState } from '../services/auth';
import { deleteFavorite, getFavorite, saveFavorite } from '../services/favorites';

const props = defineProps({
  contentType: { type: String, required: true },
  pathWord: { type: String, required: true },
  title: { type: String, required: true },
  cover: { type: String, default: '' },
  authors: { type: Array, default: () => [] }
});

const router = useRouter();
const favorite = ref(false);
const loading = ref(false);
const error = ref('');

async function loadState() {
  error.value = '';
  if (!authState.user || !props.pathWord) {
    favorite.value = false;
    return;
  }

  loading.value = true;
  try {
    favorite.value = Boolean(await getFavorite(props.contentType, props.pathWord));
  } catch (err) {
    error.value = err instanceof Error ? err.message : '读取收藏状态失败';
  } finally {
    loading.value = false;
  }
}

async function toggleFavorite() {
  if (!authState.user) {
    await router.push({ name: 'account' });
    return;
  }

  loading.value = true;
  error.value = '';
  try {
    if (favorite.value) {
      await deleteFavorite(props.contentType, props.pathWord);
      favorite.value = false;
    } else {
      await saveFavorite({
        contentType: props.contentType,
        pathWord: props.pathWord,
        title: props.title,
        cover: props.cover,
        authors: props.authors
      });
      favorite.value = true;
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '更新收藏失败';
  } finally {
    loading.value = false;
  }
}

watch(() => [authState.user?.id, props.contentType, props.pathWord], loadState, { immediate: true });
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <Button :variant="favorite ? 'default' : 'outline'" :disabled="loading" @click="toggleFavorite">
      <LoaderCircle v-if="loading" class="mr-2 size-4 animate-spin" />
      <Heart v-else class="mr-2 size-4" :class="favorite ? 'fill-current' : ''" />
      {{ authState.user ? (favorite ? '已收藏' : '加入收藏') : '登录后收藏' }}
    </Button>
    <span v-if="error" class="text-sm text-destructive">{{ error }}</span>
  </div>
</template>
