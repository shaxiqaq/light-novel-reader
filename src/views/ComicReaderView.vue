<script setup>
import { ArrowUp, BookOpen, ChevronLeft, ChevronRight, Home, Moon, Settings2, Sun, X } from 'lucide-vue-next';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchAllComicChapters, fetchComic, fetchComicChapter } from '../api/manga';
import Alert from '../components/ui/alert/Alert.vue';
import Button from '../components/ui/button/Button.vue';
import Card from '../components/ui/card/Card.vue';
import CardContent from '../components/ui/card/CardContent.vue';
import { applyAppTheme, loadAppTheme, saveAppTheme } from '../utils/theme';

const route = useRoute();
const router = useRouter();
const comic = ref(null);
const chapter = ref(null);
const chapters = ref([]);
const loading = ref(false);
const error = ref('');
const menuOpen = ref(false);
const appTheme = ref('light');

const currentIndex = computed(() => chapters.value.findIndex((item) => item.uuid === String(route.params.chapterUuid)));
const previousChapter = computed(() => (currentIndex.value > 0 ? chapters.value[currentIndex.value - 1] : null));
const nextChapter = computed(() =>
  currentIndex.value >= 0 && currentIndex.value < chapters.value.length - 1 ? chapters.value[currentIndex.value + 1] : null
);
const progressText = computed(() => {
  if (currentIndex.value < 0 || !chapters.value.length) return '';
  return `${currentIndex.value + 1} / ${chapters.value.length}`;
});

function updateTheme(theme) {
  appTheme.value = theme;
  applyAppTheme(theme);
  saveAppTheme(theme);
}

function toggleTheme() {
  updateTheme(appTheme.value === 'night' ? 'light' : 'night');
}

function goToChapter(target) {
  if (!target) return;
  menuOpen.value = false;
  router.push({
    name: 'comic-reader',
    params: { pathWord: route.params.pathWord, chapterUuid: target.uuid }
  });
}

function scrollToTop() {
  menuOpen.value = false;
  window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
}

async function loadReader() {
  loading.value = true;
  error.value = '';
  menuOpen.value = false;

  try {
    const [comicData, chapterData, chapterList] = await Promise.all([
      fetchComic(String(route.params.pathWord)),
      fetchComicChapter(String(route.params.pathWord), String(route.params.chapterUuid)),
      fetchAllComicChapters(String(route.params.pathWord))
    ]);
    comic.value = comicData;
    chapter.value = chapterData;
    chapters.value = chapterList;
    await nextTick();
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载漫画阅读页失败';
  } finally {
    loading.value = false;
  }
}

watch(() => [route.params.pathWord, route.params.chapterUuid], loadReader);

onMounted(() => {
  appTheme.value = loadAppTheme();
  applyAppTheme(appTheme.value);
  loadReader();
});
</script>

<template>
  <div class="comic-reader-shell min-h-screen pb-24">
    <Alert v-if="error" variant="error" class="mx-auto mt-4 max-w-3xl">{{ error }}</Alert>

    <template v-if="comic && chapter">
      <header class="comic-reader-heading mx-auto max-w-4xl px-4 py-8 text-center sm:py-10">
        <p class="text-xs uppercase tracking-[0.3em] text-primary">{{ progressText || 'Comic reader' }}</p>
        <h1 class="mt-3 text-xl font-bold sm:text-3xl">{{ comic.title }}</h1>
        <p class="mt-2 text-sm text-muted-foreground sm:text-base">{{ chapter.name }}</p>
      </header>

      <main class="comic-strip mx-auto max-w-[900px] overflow-hidden bg-black shadow-2xl">
        <img
          v-for="image in chapter.images"
          :key="`${chapter.uuid}-${image.index}`"
          :src="image.url"
          :alt="`${chapter.name} 第 ${image.index + 1} 页`"
          class="block h-auto w-full"
          loading="lazy"
          decoding="async"
        />
      </main>

      <div class="mx-auto flex max-w-4xl flex-col items-center gap-4 px-4 py-10">
        <p class="text-sm text-muted-foreground">本话共 {{ chapter.images.length }} 页</p>
        <div class="flex flex-wrap justify-center gap-3">
          <Button variant="outline" :disabled="!previousChapter" @click="goToChapter(previousChapter)">
            <ChevronLeft class="mr-1 size-4" />
            上一话
          </Button>
          <router-link :to="{ name: 'comic', params: { pathWord: route.params.pathWord } }">
            <Button variant="outline">查看目录</Button>
          </router-link>
          <Button :disabled="!nextChapter" @click="goToChapter(nextChapter)">
            下一话
            <ChevronRight class="ml-1 size-4" />
          </Button>
        </div>
      </div>
    </template>

    <div v-else-if="loading" class="mx-auto max-w-[900px] space-y-1 pt-5">
      <div class="h-24 animate-pulse bg-secondary" />
      <div v-for="n in 4" :key="n" class="aspect-[3/4] animate-pulse bg-secondary" />
    </div>

    <div v-if="menuOpen" class="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" @click="menuOpen = false" />

    <div class="fixed bottom-5 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-7 sm:right-7">
      <Card v-if="menuOpen" class="w-[min(22rem,calc(100vw-2rem))] shadow-2xl">
        <CardContent class="space-y-4 p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="font-semibold">漫画阅读菜单</p>
              <p class="text-xs text-muted-foreground">{{ chapter?.name || '正在加载章节' }}</p>
            </div>
            <Button size="icon" variant="ghost" @click="menuOpen = false"><X class="size-4" /></Button>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <Button variant="outline" @click="router.push({ name: 'manga-home' })"><Home class="mr-1 size-4" />漫画馆</Button>
            <Button variant="outline" @click="router.push({ name: 'comic', params: { pathWord: route.params.pathWord } })">
              <BookOpen class="mr-1 size-4" />目录
            </Button>
            <Button variant="outline" :disabled="!previousChapter" @click="goToChapter(previousChapter)">
              <ChevronLeft class="mr-1 size-4" />上一话
            </Button>
            <Button variant="outline" :disabled="!nextChapter" @click="goToChapter(nextChapter)">
              下一话<ChevronRight class="ml-1 size-4" />
            </Button>
            <Button variant="outline" @click="scrollToTop"><ArrowUp class="mr-1 size-4" />回到顶部</Button>
            <Button variant="outline" @click="toggleTheme">
              <Sun v-if="appTheme === 'night'" class="mr-1 size-4" />
              <Moon v-else class="mr-1 size-4" />
              {{ appTheme === 'night' ? '日间模式' : '黑夜模式' }}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Button size="icon" class="size-12 rounded-full shadow-xl" @click="menuOpen = !menuOpen">
        <Settings2 class="size-5" />
      </Button>
    </div>
  </div>
</template>
