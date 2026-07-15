<script setup>
import { BookOpen, ChevronRight } from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { fetchAllComicChapters, fetchComic } from '../api/manga';
import Alert from '../components/ui/alert/Alert.vue';
import Badge from '../components/ui/badge/Badge.vue';
import Button from '../components/ui/button/Button.vue';
import Card from '../components/ui/card/Card.vue';
import CardContent from '../components/ui/card/CardContent.vue';
import CardDescription from '../components/ui/card/CardDescription.vue';
import CardHeader from '../components/ui/card/CardHeader.vue';
import CardTitle from '../components/ui/card/CardTitle.vue';

const route = useRoute();
const comic = ref(null);
const chapters = ref([]);
const loading = ref(false);
const error = ref('');
const pathWord = computed(() => String(route.params.pathWord || ''));

async function loadComic() {
  loading.value = true;
  error.value = '';

  try {
    const [comicData, chapterData] = await Promise.all([fetchComic(pathWord.value), fetchAllComicChapters(pathWord.value)]);
    comic.value = comicData;
    chapters.value = chapterData;
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载漫画详情失败';
  } finally {
    loading.value = false;
  }
}

onMounted(loadComic);
watch(pathWord, loadComic);
</script>

<template>
  <div class="space-y-5">
    <Alert v-if="error" variant="error">{{ error }}</Alert>

    <template v-if="comic">
      <Card class="overflow-hidden">
        <CardContent class="grid gap-6 p-4 sm:p-6 md:grid-cols-[220px_1fr]">
          <div class="mx-auto w-full max-w-[180px] md:max-w-none">
            <img :src="comic.cover" :alt="comic.title" class="aspect-[3/4] w-full rounded-2xl object-cover shadow-xl" />
          </div>

          <div class="min-w-0 space-y-5">
            <div>
              <p class="text-xs uppercase tracking-[0.32em] text-primary">Comic detail</p>
              <h1 class="mt-3 text-3xl font-black leading-tight sm:text-5xl">{{ comic.title }}</h1>
              <p v-if="comic.alias" class="mt-2 text-sm text-muted-foreground">{{ comic.alias }}</p>
              <p class="mt-3 text-base text-muted-foreground">{{ comic.authors.join(' / ') || '未知作者' }}</p>
            </div>

            <div class="flex flex-wrap gap-2">
              <Badge v-if="comic.status" variant="soft">{{ comic.status }}</Badge>
              <Badge v-if="comic.region" variant="outline">{{ comic.region }}</Badge>
              <Badge variant="outline">共 {{ chapters.length }} 话</Badge>
              <Badge v-if="comic.popularity" variant="outline">热度 {{ comic.popularity }}</Badge>
            </div>

            <div v-if="comic.themes.length" class="flex flex-wrap gap-2">
              <Badge v-for="theme in comic.themes" :key="theme" variant="outline">{{ theme }}</Badge>
            </div>

            <p class="whitespace-pre-wrap text-sm leading-7 text-foreground/85 sm:text-base sm:leading-8">{{ comic.brief || '暂无简介。' }}</p>

            <router-link
              v-if="chapters.length"
              :to="{ name: 'comic-reader', params: { pathWord, chapterUuid: chapters[0].uuid } }"
              class="inline-block"
            >
              <Button size="lg">
                <BookOpen class="mr-2 size-4" />
                从第一话开始
              </Button>
            </router-link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle class="text-2xl">章节目录</CardTitle>
          <CardDescription>章节按阅读顺序排列，点击后进入连续图片阅读模式。</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <router-link
              v-for="chapter in chapters"
              :key="chapter.uuid"
              :to="{ name: 'comic-reader', params: { pathWord, chapterUuid: chapter.uuid } }"
              class="group flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background p-4 transition hover:border-primary/50 hover:bg-accent/50"
            >
              <div class="min-w-0">
                <p class="truncate font-medium">{{ chapter.name }}</p>
                <p v-if="chapter.updatedAt" class="mt-1 truncate text-xs text-muted-foreground">{{ chapter.updatedAt }}</p>
              </div>
              <ChevronRight class="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
            </router-link>
          </div>
        </CardContent>
      </Card>
    </template>

    <div v-else-if="loading" class="space-y-4">
      <div class="h-80 animate-pulse rounded-3xl bg-secondary" />
      <div class="h-96 animate-pulse rounded-3xl bg-secondary" />
    </div>
  </div>
</template>
