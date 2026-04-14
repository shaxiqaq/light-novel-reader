<script setup>
import { BookMarked, Cloud, History, Trash2 } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import Alert from '../components/ui/alert/Alert.vue';
import Button from '../components/ui/button/Button.vue';
import Card from '../components/ui/card/Card.vue';
import CardContent from '../components/ui/card/CardContent.vue';
import CardDescription from '../components/ui/card/CardDescription.vue';
import CardHeader from '../components/ui/card/CardHeader.vue';
import CardTitle from '../components/ui/card/CardTitle.vue';
import { isCloudSyncEnabled, listCloudProgress } from '../services/cloudProgress';
import { loadHistory, saveHistory } from '../utils/reader';

const history = ref({ books: [], volumes: [] });
const cloudSyncReady = isCloudSyncEnabled();
const cloudLoading = ref(false);

const uniqueVolumeHistory = computed(() => {
  const seen = new Set();
  return history.value.volumes.filter((item) => {
    if (!item?.pathWord || seen.has(item.pathWord)) {
      return false;
    }
    seen.add(item.pathWord);
    return true;
  });
});

const totalHistoryCount = computed(() => history.value.books.length + uniqueVolumeHistory.value.length);
const hasHistory = computed(() => history.value.books.length > 0 || uniqueVolumeHistory.value.length > 0);

function dedupeVolumes(volumes) {
  const seen = new Set();
  return volumes.filter((item) => {
    if (!item?.pathWord || seen.has(item.pathWord)) {
      return false;
    }
    seen.add(item.pathWord);
    return true;
  });
}

async function refreshHistory() {
  const rawHistory = loadHistory();
  let mergedVolumes = dedupeVolumes(rawHistory.volumes || []);

  if (cloudSyncReady) {
    cloudLoading.value = true;
    try {
      const cloudProgress = await listCloudProgress();
      const cloudVolumes = cloudProgress.map((item) => ({
        pathWord: item.bookId,
        bookTitle: item.bookTitle,
        volumeId: item.volumeId,
        volumeTitle: item.volumeTitle,
        updatedAt: item.updatedAtClient
      }));

      const mergedMap = new Map();
      for (const item of [...cloudVolumes, ...mergedVolumes]) {
        const current = mergedMap.get(item.pathWord);
        const currentTime = current?.updatedAt ? new Date(current.updatedAt).getTime() : 0;
        const nextTime = item?.updatedAt ? new Date(item.updatedAt).getTime() : 0;
        if (!current || nextTime >= currentTime) {
          mergedMap.set(item.pathWord, item);
        }
      }
      mergedVolumes = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      );
    } catch (err) {
      console.error('读取云端继续阅读失败:', err);
    } finally {
      cloudLoading.value = false;
    }
  }

  history.value = {
    books: rawHistory.books || [],
    volumes: mergedVolumes
  };

  saveHistory(history.value);
}

function clearHistory() {
  history.value = { books: [], volumes: [] };
  saveHistory(history.value);
}

function formatTime(value) {
  if (!value) return '未知时间';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

onMounted(refreshHistory);
</script>

<template>
  <div class="space-y-5">
    <div class="grid gap-4 lg:grid-cols-[1fr_220px]">
      <Card class="bg-[linear-gradient(120deg,rgba(255,248,236,0.98),rgba(248,236,209,0.9))]">
        <CardHeader>
          <div class="flex flex-wrap items-center gap-2">
            <p class="text-xs uppercase tracking-[0.32em] text-amber-700/80">History</p>
            <span
              v-if="cloudSyncReady"
              class="inline-flex items-center gap-1 rounded-full border border-border/70 px-2 py-1 text-xs text-muted-foreground"
            >
              <Cloud class="size-3.5" />
              云端继续阅读已开启
            </span>
          </div>
          <CardTitle class="text-4xl sm:text-5xl">历史记录</CardTitle>
          <CardDescription class="text-base leading-7">查看最近浏览过的书籍，以及每本书最近一次继续阅读的位置。</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader class="pb-3">
          <CardDescription>历史总数</CardDescription>
          <CardTitle class="text-5xl">{{ totalHistoryCount }}</CardTitle>
        </CardHeader>
        <CardContent>
          <Button v-if="hasHistory" class="w-full" variant="outline" @click="clearHistory">
            <Trash2 class="mr-2 size-4" />
            清空历史
          </Button>
        </CardContent>
      </Card>
    </div>

    <Alert v-if="cloudLoading" variant="info">正在同步云端阅读记录…</Alert>
    <Alert v-else-if="cloudSyncReady" variant="info">继续阅读会优先使用 LeanCloud 中保存的最新进度。</Alert>
    <Alert v-else variant="info">未配置 LeanCloud 环境变量，当前历史记录仅保存在本地。</Alert>

    <template v-if="hasHistory">
      <div class="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div class="flex items-center gap-2">
              <BookMarked class="size-5 text-primary" />
              <CardTitle class="text-2xl">书籍历史</CardTitle>
            </div>
          </CardHeader>
          <CardContent class="space-y-3">
            <router-link
              v-for="item in history.books"
              :key="`book-${item.pathWord}`"
              :to="{ name: 'book', params: { pathWord: item.pathWord } }"
              class="block"
            >
              <div class="flex gap-4 rounded-2xl border border-border/70 bg-background p-3 transition hover:border-primary/40 hover:bg-accent/40">
                <img :src="item.cover" :alt="item.title" class="h-28 w-20 rounded-xl object-cover" loading="lazy" />
                <div class="min-w-0 flex-1">
                  <h3 class="line-clamp-2 text-base font-semibold">{{ item.title }}</h3>
                  <p class="mt-2 text-sm text-muted-foreground">{{ (item.authors || []).join(' / ') || '未知作者' }}</p>
                  <p class="mt-3 text-sm text-muted-foreground">浏览于 {{ formatTime(item.updatedAt) }}</p>
                </div>
              </div>
            </router-link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div class="flex items-center gap-2">
              <History class="size-5 text-primary" />
              <CardTitle class="text-2xl">继续阅读</CardTitle>
            </div>
          </CardHeader>
          <CardContent class="space-y-3">
            <router-link
              v-for="item in uniqueVolumeHistory"
              :key="`volume-${item.pathWord}`"
              :to="{ name: 'reader', params: { pathWord: item.pathWord, volumeId: item.volumeId } }"
              class="block"
            >
              <div class="rounded-2xl border border-border/70 bg-background p-4 transition hover:border-primary/40 hover:bg-accent/40">
                <h3 class="text-base font-semibold">{{ item.bookTitle }}</h3>
                <p class="mt-2 text-sm text-muted-foreground">{{ item.volumeTitle }}</p>
                <p class="mt-3 text-sm text-muted-foreground">阅读于 {{ formatTime(item.updatedAt) }}</p>
              </div>
            </router-link>
          </CardContent>
        </Card>
      </div>
    </template>

    <Alert v-else>还没有历史记录，先去浏览一本小说吧。</Alert>
  </div>
</template>
