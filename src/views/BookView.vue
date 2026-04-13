<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { fetchBookBundle } from '../api/novels';
import Alert from '../components/ui/alert/Alert.vue';
import Badge from '../components/ui/badge/Badge.vue';
import Button from '../components/ui/button/Button.vue';
import Card from '../components/ui/card/Card.vue';
import CardContent from '../components/ui/card/CardContent.vue';
import CardDescription from '../components/ui/card/CardDescription.vue';
import CardHeader from '../components/ui/card/CardHeader.vue';
import CardTitle from '../components/ui/card/CardTitle.vue';
import { pushBookHistory } from '../utils/reader';

const route = useRoute();

const loading = ref(false);
const error = ref('');
const book = ref(null);
const meta = ref(null);
const volumes = ref([]);

const pathWord = computed(() => route.params.pathWord);

async function loadBook() {
  loading.value = true;
  error.value = '';
  try {
    const data = await fetchBookBundle(pathWord.value);
    book.value = data.book;
    meta.value = data.meta;
    volumes.value = data.volumes;
    pushBookHistory({
      pathWord: data.book.pathWord,
      title: data.book.title,
      cover: data.book.cover,
      authors: data.book.authors,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载详情失败';
  } finally {
    loading.value = false;
  }
}

onMounted(loadBook);
watch(pathWord, loadBook);
</script>

<template>
  <div class="space-y-5">
    <Alert v-if="error" variant="error">{{ error }}</Alert>

    <template v-else-if="book">
      <Card>
        <CardContent class="grid gap-6 p-4 sm:p-6 lg:grid-cols-[220px_1fr]">
          <div class="mx-auto w-full max-w-[180px] lg:max-w-none">
            <img :src="book.cover" :alt="book.title" class="w-full rounded-2xl object-cover shadow-sm" />
          </div>

          <div class="space-y-5">
            <div class="space-y-3">
              <p class="text-xs uppercase tracking-[0.32em] text-amber-700/80">Book Detail</p>
              <h1 class="text-3xl font-bold leading-tight sm:text-4xl">{{ book.title }}</h1>
              <p class="text-base text-muted-foreground">{{ book.authors.join(' / ') || '未知作者' }}</p>
            </div>

            <div class="flex flex-wrap gap-2">
              <Badge variant="soft">{{ book.status || '未知状态' }}</Badge>
              <Badge variant="outline">{{ book.region || '未知地区' }}</Badge>
              <Badge variant="outline">热度 {{ book.popularity }}</Badge>
              <Badge variant="outline">更新 {{ book.updatedAt }}</Badge>
            </div>

            <div v-if="book.themes.length" class="flex flex-wrap gap-2">
              <Badge v-for="theme in book.themes" :key="theme" variant="outline">{{ theme }}</Badge>
            </div>

            <p class="whitespace-pre-wrap text-base leading-8 text-foreground/90">{{ book.brief }}</p>

            <div class="flex flex-wrap gap-2">
              <Badge v-if="meta?.isVip" variant="soft">详情接口标记为 VIP 内容</Badge>
              <Badge v-if="meta?.isLock" variant="soft">当前作品处于锁定状态</Badge>
              <Badge v-if="book.lastChapter" variant="outline">最新卷：{{ book.lastChapter.name }}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle class="text-2xl">卷列表</CardTitle>
          <CardDescription>选择卷进入阅读页。</CardDescription>
        </CardHeader>
        <CardContent class="space-y-3">
          <router-link
            v-for="volume in volumes"
            :key="volume.id"
            :to="{ name: 'reader', params: { pathWord: book.pathWord, volumeId: volume.id } }"
            class="block"
          >
            <div class="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background p-4 transition hover:border-primary/40 hover:bg-accent/40 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <strong class="text-base">{{ volume.title }}</strong>
                <p class="mt-1 text-sm text-muted-foreground">共 {{ volume.count }} 个内容节点</p>
              </div>
              <Button variant="outline">开始阅读</Button>
            </div>
          </router-link>
        </CardContent>
      </Card>
    </template>

    <div v-else-if="loading" class="grid gap-4 lg:grid-cols-[220px_1fr]">
      <div class="aspect-[3/4] animate-pulse rounded-3xl bg-secondary" />
      <div class="rounded-3xl bg-secondary p-6" />
    </div>
  </div>
</template>
