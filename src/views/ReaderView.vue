<script setup>
import { ChevronLeft, ChevronRight, Settings2, X } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchVolume, fetchVolumeLines } from '../api/novels';
import Alert from '../components/ui/alert/Alert.vue';
import Button from '../components/ui/button/Button.vue';
import Card from '../components/ui/card/Card.vue';
import CardContent from '../components/ui/card/CardContent.vue';
import Select from '../components/ui/select/Select.vue';
import Slider from '../components/ui/slider/Slider.vue';
import {
  loadReaderSettings,
  loadReadingProgress,
  normalizeReaderItems,
  pushVolumeHistory,
  saveReaderSettings,
  saveReadingProgress
} from '../utils/reader';
import { applyAppTheme, loadAppTheme, saveAppTheme } from '../utils/theme';

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const error = ref('');
const book = ref(null);
const volume = ref(null);
const items = ref([]);
const settingsOpen = ref(false);
const settings = reactive(loadReaderSettings());
const appTheme = ref('light');

const routeKey = computed(() => `${route.params.pathWord}:${route.params.volumeId}`);
const readingStyle = computed(() => ({
  fontSize: `${settings.fontSize}px`,
  lineHeight: settings.lineHeight,
  fontFamily: settings.fontFamily || 'var(--reader-font-serif)'
}));
const themeClass = computed(() => (appTheme.value === 'night' ? 'reader-theme-night' : 'reader-theme-paper'));
const endActionLabel = computed(() => (volume.value?.next ? '跳转下一章' : '已经是最后一章'));

const fontOptions = [
  { label: '衬线体', value: 'var(--reader-font-serif)' },
  { label: '无衬线', value: 'var(--reader-font-sans)' }
];

const appThemeOptions = [
  { label: '浅色', value: 'light' },
  { label: '黑夜', value: 'night' }
];

function getScrollContainer() {
  return document.scrollingElement || document.documentElement;
}

function getCurrentScrollTop() {
  return getScrollContainer()?.scrollTop || window.scrollY || 0;
}

function setScrollTop(top) {
  const container = getScrollContainer();
  if (container) {
    container.scrollTo({ top, behavior: 'auto' });
  }
  window.scrollTo({ top, behavior: 'auto' });
}

function markJumpToTop(targetVolumeId) {
  sessionStorage.setItem(
    'reader-force-top',
    JSON.stringify({
      pathWord: route.params.pathWord,
      volumeId: String(targetVolumeId)
    })
  );
}

function closeSettings() {
  settingsOpen.value = false;
}

function goToVolume(targetVolumeId) {
  if (!targetVolumeId) return;

  markJumpToTop(targetVolumeId);
  closeSettings();
  router.push({
    name: 'reader',
    params: { pathWord: route.params.pathWord, volumeId: targetVolumeId }
  });
}

function updateAppTheme(value) {
  appTheme.value = value;
  applyAppTheme(value);
  saveAppTheme(value);
}

async function loadReader() {
  loading.value = true;
  error.value = '';

  try {
    const data = await fetchVolume(route.params.pathWord, route.params.volumeId);
    const lines = await fetchVolumeLines(data.volume.txtAddr, data.volume.txtEncoding);
    book.value = data.book;
    volume.value = data.volume;
    items.value = normalizeReaderItems(data.volume.contents, lines);

    pushVolumeHistory({
      pathWord: data.book.pathWord,
      bookTitle: data.book.title,
      volumeId: data.volume.id,
      volumeTitle: data.volume.title,
      updatedAt: new Date().toISOString()
    });

    restoreScroll();
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载阅读页失败。';
  } finally {
    loading.value = false;
  }
}

function persistSettings() {
  saveReaderSettings({
    fontSize: settings.fontSize,
    lineHeight: settings.lineHeight,
    fontFamily: settings.fontFamily || 'var(--reader-font-serif)'
  });
}

function persistScroll() {
  const progress = loadReadingProgress();
  progress[routeKey.value] = {
    scrollY: getCurrentScrollTop(),
    savedAt: new Date().toISOString(),
    title: volume.value?.title || ''
  };
  saveReadingProgress(progress);

  if (book.value && volume.value) {
    pushVolumeHistory({
      pathWord: book.value.pathWord,
      bookTitle: book.value.title,
      volumeId: volume.value.id,
      volumeTitle: volume.value.title,
      updatedAt: new Date().toISOString()
    });
  }
}

function restoreScroll() {
  const forceTopRaw = sessionStorage.getItem('reader-force-top');
  if (forceTopRaw) {
    try {
      const forceTop = JSON.parse(forceTopRaw);
      if (forceTop?.pathWord === route.params.pathWord && forceTop?.volumeId === String(route.params.volumeId)) {
        sessionStorage.removeItem('reader-force-top');
        requestAnimationFrame(() => setScrollTop(0));
        return;
      }
    } catch {
      sessionStorage.removeItem('reader-force-top');
    }
  }

  const progress = loadReadingProgress();
  const saved = progress[routeKey.value];
  requestAnimationFrame(() => setScrollTop(saved?.scrollY || 0));
}

watch(
  () => [settings.fontSize, settings.lineHeight, settings.fontFamily],
  () => persistSettings(),
  { deep: true }
);

watch(
  () => [route.params.pathWord, route.params.volumeId],
  () => {
    closeSettings();
    loadReader();
  }
);

onMounted(() => {
  appTheme.value = loadAppTheme();
  applyAppTheme(appTheme.value);
  loadReader();
  window.addEventListener('beforeunload', persistScroll);
});

onBeforeUnmount(() => {
  persistScroll();
  window.removeEventListener('beforeunload', persistScroll);
});
</script>

<template>
  <div :class="['reader-shell space-y-4 pb-24', themeClass]">
    <Alert v-if="error" variant="error">{{ error }}</Alert>

    <template v-if="book && volume">
      <Card class="reader-panel">
        <CardContent class="space-y-4 p-6 sm:p-8">
          <div>
            <p class="text-xs uppercase tracking-[0.32em] text-amber-700/80">Reader</p>
            <h1 class="mt-3 text-3xl font-bold leading-tight sm:text-5xl">{{ book.title }}</h1>
            <p class="mt-3 text-base text-muted-foreground">{{ volume.title }}</p>
          </div>

          <div class="flex flex-wrap gap-3">
            <router-link
              v-if="volume.prev"
              :to="{ name: 'reader', params: { pathWord: route.params.pathWord, volumeId: volume.prev } }"
              @click="markJumpToTop(volume.prev)"
            >
              <Button variant="outline" class="reader-nav-button">
                <ChevronLeft class="mr-1 size-4" />
                上一卷
              </Button>
            </router-link>

            <router-link :to="{ name: 'book', params: { pathWord: route.params.pathWord } }">
              <Button variant="outline" class="reader-nav-button">返回详情</Button>
            </router-link>

            <router-link
              v-if="volume.next"
              :to="{ name: 'reader', params: { pathWord: route.params.pathWord, volumeId: volume.next } }"
              @click="markJumpToTop(volume.next)"
            >
              <Button variant="outline" class="reader-nav-button">
                下一卷
                <ChevronRight class="ml-1 size-4" />
              </Button>
            </router-link>
          </div>
        </CardContent>
      </Card>

      <Card class="reader-panel">
        <CardContent class="p-6 sm:p-8">
          <article class="reader-content" :style="readingStyle">
            <section
              v-for="item in items"
              :key="item.id"
              class="reader-block"
              :class="item.type === 'image' ? 'reader-image-block' : ''"
            >
              <template v-if="item.type === 'text'">
                <h2 class="mb-4 text-2xl font-semibold leading-tight">{{ item.title }}</h2>
                <p v-for="(paragraph, index) in item.text.split('\n').filter(Boolean)" :key="`${item.id}-${index}`">
                  {{ paragraph }}
                </p>
              </template>

              <template v-else-if="item.type === 'image'">
                <h2 class="mb-4 text-2xl font-semibold leading-tight">{{ item.title }}</h2>
                <img :src="item.url" :alt="item.title" loading="lazy" class="mx-auto rounded-2xl" />
              </template>
            </section>
          </article>

          <div class="mt-8 border-t border-border/60 pt-6 text-center">
            <router-link
              v-if="volume.next"
              :to="{ name: 'reader', params: { pathWord: route.params.pathWord, volumeId: volume.next } }"
              @click="markJumpToTop(volume.next)"
            >
              <Button size="lg">{{ endActionLabel }}</Button>
            </router-link>
            <Button v-else size="lg" variant="outline" disabled>{{ endActionLabel }}</Button>
          </div>
        </CardContent>
      </Card>
    </template>

    <div v-else-if="loading" class="space-y-4">
      <div class="h-40 animate-pulse rounded-3xl bg-secondary" />
      <div class="h-96 animate-pulse rounded-3xl bg-secondary" />
    </div>

    <div v-if="settingsOpen" class="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" @click="closeSettings" />

    <div class="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-y-3 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="translate-y-3 opacity-0"
      >
        <Card v-if="settingsOpen" class="reader-panel w-[min(24rem,calc(100vw-2rem))] shadow-2xl">
          <CardContent class="space-y-4 p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-semibold">阅读设置</p>
                <p class="text-xs text-muted-foreground">这里保留字体与整站主题切换。</p>
              </div>
              <Button variant="ghost" size="icon" @click="closeSettings">
                <X class="size-4" />
              </Button>
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium">快捷切换</label>
              <div class="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  class="reader-nav-button w-full"
                  :disabled="!volume?.prev"
                  @click="goToVolume(volume?.prev)"
                >
                  <ChevronLeft class="mr-1 size-4" />
                  上一卷
                </Button>
                <Button
                  variant="outline"
                  class="reader-nav-button w-full"
                  :disabled="!volume?.next"
                  @click="goToVolume(volume?.next)"
                >
                  下一卷
                  <ChevronRight class="ml-1 size-4" />
                </Button>
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium">字号</label>
              <Slider v-model="settings.fontSize" :min="14" :max="30" :step="1" />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium">行距</label>
              <Slider v-model="settings.lineHeight" :min="1.4" :max="2.6" :step="0.1" />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium">字体</label>
              <Select v-model="settings.fontFamily" :options="fontOptions" />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium">全局主题</label>
              <Select :model-value="appTheme" :options="appThemeOptions" @update:model-value="updateAppTheme" />
            </div>
          </CardContent>
        </Card>
      </transition>

      <Button class="size-12 rounded-full shadow-lg" size="icon" @click="settingsOpen = !settingsOpen">
        <Settings2 class="size-5" />
      </Button>
    </div>
  </div>
</template>
