<script setup>
import { BookOpen, Heart, Images, LoaderCircle, Trash2 } from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import Alert from '../components/ui/alert/Alert.vue';
import Badge from '../components/ui/badge/Badge.vue';
import Button from '../components/ui/button/Button.vue';
import Card from '../components/ui/card/Card.vue';
import CardContent from '../components/ui/card/CardContent.vue';
import CardDescription from '../components/ui/card/CardDescription.vue';
import CardHeader from '../components/ui/card/CardHeader.vue';
import CardTitle from '../components/ui/card/CardTitle.vue';
import { authState } from '../services/auth';
import { deleteFavorite, listFavorites } from '../services/favorites';

const favorites = ref([]);
const activeType = ref('all');
const loading = ref(false);
const error = ref('');
const removingId = ref('');

const visibleFavorites = computed(() => {
  if (activeType.value === 'all') return favorites.value;
  return favorites.value.filter((item) => item.contentType === activeType.value);
});

const novelCount = computed(() => favorites.value.filter((item) => item.contentType === 'novel').length);
const comicCount = computed(() => favorites.value.filter((item) => item.contentType === 'comic').length);

function detailRoute(item) {
  return item.contentType === 'comic'
    ? { name: 'comic', params: { pathWord: item.pathWord } }
    : { name: 'book', params: { pathWord: item.pathWord } };
}

async function loadFavorites() {
  if (!authState.user) {
    favorites.value = [];
    return;
  }

  loading.value = true;
  error.value = '';
  try {
    favorites.value = await listFavorites();
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载收藏失败';
  } finally {
    loading.value = false;
  }
}

async function removeFavorite(item) {
  removingId.value = item.id;
  error.value = '';
  try {
    await deleteFavorite(item.contentType, item.pathWord);
    favorites.value = favorites.value.filter((favorite) => favorite.id !== item.id);
  } catch (err) {
    error.value = err instanceof Error ? err.message : '取消收藏失败';
  } finally {
    removingId.value = '';
  }
}

onMounted(loadFavorites);
watch(() => authState.user?.id, loadFavorites);
</script>

<template>
  <div class="space-y-5">
    <Card class="overflow-hidden">
      <CardHeader class="bg-gradient-to-br from-primary/10 via-card to-amber-100/40 dark:to-amber-950/10 sm:p-8">
        <div class="flex items-start gap-4">
          <div class="rounded-2xl bg-primary p-3 text-primary-foreground">
            <Heart class="size-6" />
          </div>
          <div>
            <CardTitle class="text-3xl sm:text-4xl">我的收藏</CardTitle>
            <CardDescription class="mt-2 text-base">收藏的小说和漫画会跟随账号同步。</CardDescription>
          </div>
        </div>
      </CardHeader>
    </Card>

    <Alert v-if="error" variant="error">{{ error }}</Alert>

    <Card v-if="!authState.loading && !authState.user">
      <CardContent class="flex min-h-52 flex-col items-center justify-center gap-4 text-center">
        <Heart class="size-10 text-muted-foreground" />
        <div>
          <p class="text-lg font-semibold">登录后使用云端收藏</p>
          <p class="mt-1 text-sm text-muted-foreground">收藏会在你的不同设备之间同步。</p>
        </div>
        <router-link :to="{ name: 'account' }"><Button>前往登录</Button></router-link>
      </CardContent>
    </Card>

    <template v-else-if="authState.user">
      <Card>
        <CardContent class="flex flex-wrap items-center gap-2 p-4">
          <Button :variant="activeType === 'all' ? 'default' : 'outline'" @click="activeType = 'all'">
            全部 {{ favorites.length }}
          </Button>
          <Button :variant="activeType === 'novel' ? 'default' : 'outline'" @click="activeType = 'novel'">
            <BookOpen class="mr-1 size-4" />小说 {{ novelCount }}
          </Button>
          <Button :variant="activeType === 'comic' ? 'default' : 'outline'" @click="activeType = 'comic'">
            <Images class="mr-1 size-4" />漫画 {{ comicCount }}
          </Button>
        </CardContent>
      </Card>

      <div v-if="loading" class="flex min-h-48 items-center justify-center">
        <LoaderCircle class="size-8 animate-spin text-primary" />
      </div>

      <div v-else-if="visibleFavorites.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card v-for="item in visibleFavorites" :key="item.id" class="group overflow-hidden">
          <CardContent class="flex gap-4 p-4">
            <router-link :to="detailRoute(item)" class="shrink-0">
              <img :src="item.cover" :alt="item.title" class="h-32 w-24 rounded-xl object-cover shadow-sm transition group-hover:scale-[1.02]" />
            </router-link>
            <div class="flex min-w-0 flex-1 flex-col">
              <div class="flex items-start justify-between gap-2">
                <Badge variant="outline">{{ item.contentType === 'comic' ? '漫画' : '小说' }}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  class="-mr-2 -mt-2 size-8 shrink-0 text-muted-foreground hover:text-destructive"
                  :disabled="removingId === item.id"
                  aria-label="取消收藏"
                  @click="removeFavorite(item)"
                >
                  <LoaderCircle v-if="removingId === item.id" class="size-4 animate-spin" />
                  <Trash2 v-else class="size-4" />
                </Button>
              </div>
              <router-link :to="detailRoute(item)" class="mt-2 line-clamp-2 font-semibold leading-6 hover:text-primary">
                {{ item.title }}
              </router-link>
              <p class="mt-2 line-clamp-1 text-sm text-muted-foreground">{{ item.authors.join(' / ') || '未知作者' }}</p>
              <router-link :to="detailRoute(item)" class="mt-auto pt-3 text-sm font-medium text-primary hover:underline">
                查看详情
              </router-link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card v-else>
        <CardContent class="flex min-h-52 flex-col items-center justify-center text-center">
          <Heart class="size-10 text-muted-foreground" />
          <p class="mt-4 text-lg font-semibold">这里还没有收藏</p>
          <p class="mt-1 text-sm text-muted-foreground">打开小说或漫画详情页，点击收藏按钮即可加入。</p>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
