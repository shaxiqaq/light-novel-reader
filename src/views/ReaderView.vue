<script setup>
import { NAlert, NButton, NCard, NEmpty, NFlex, NSelect, NSlider, NSpace, NSpin, NThing } from 'naive-ui';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { fetchVolume, fetchVolumeLines } from '../api/novels';
import {
  loadReaderSettings,
  loadReadingProgress,
  normalizeReaderItems,
  pushVolumeHistory,
  saveReaderSettings,
  saveReadingProgress
} from '../utils/reader';

const route = useRoute();

const loading = ref(false);
const error = ref('');
const book = ref(null);
const volume = ref(null);
const items = ref([]);

const settings = reactive(loadReaderSettings());

const routeKey = computed(() => `${route.params.pathWord}:${route.params.volumeId}`);

const readingStyle = computed(() => ({
  fontSize: `${settings.fontSize}px`,
  lineHeight: settings.lineHeight
}));

const themeClass = computed(() => `reader-theme-${settings.theme}`);
const endActionLabel = computed(() => (volume.value?.next ? '跳转下一章' : '已经是最后一章'));

const themeOptions = [
  { label: '白天', value: 'paper' },
  { label: '柔和', value: 'mist' },
  { label: '黑夜', value: 'night' }
];

function getScrollContainers() {
  const containers = [];
  const scrollingElement = document.scrollingElement || document.documentElement;

  if (scrollingElement) {
    containers.push(scrollingElement);
  }

  document.querySelectorAll('.n-layout-scroll-container').forEach((element) => {
    if (!containers.includes(element)) {
      containers.push(element);
    }
  });

  return containers;
}

function getCurrentScrollTop() {
  const [container] = getScrollContainers();
  return container ? container.scrollTop : window.scrollY || 0;
}

function setScrollTop(top) {
  getScrollContainers().forEach((container) => {
    container.scrollTo({ top, behavior: 'auto' });
  });

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
    error.value = err instanceof Error ? err.message : '加载阅读页失败';
  } finally {
    loading.value = false;
  }
}

function persistSettings() {
  saveReaderSettings({
    fontSize: settings.fontSize,
    lineHeight: settings.lineHeight,
    theme: settings.theme
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
      if (
        forceTop?.pathWord === route.params.pathWord &&
        forceTop?.volumeId === String(route.params.volumeId)
      ) {
        sessionStorage.removeItem('reader-force-top');
        requestAnimationFrame(() => {
          setScrollTop(0);
        });
        return;
      }
    } catch {
      sessionStorage.removeItem('reader-force-top');
    }
  }

  const progress = loadReadingProgress();
  const saved = progress[routeKey.value];

  if (!saved) {
    requestAnimationFrame(() => {
      setScrollTop(0);
    });
    return;
  }

  requestAnimationFrame(() => {
    setScrollTop(saved.scrollY || 0);
  });
}

function scrollToTop() {
  requestAnimationFrame(() => {
    setScrollTop(0);
  });
}

watch(
  () => [settings.fontSize, settings.lineHeight, settings.theme],
  () => persistSettings(),
  { deep: true }
);

watch(
  () => [route.params.pathWord, route.params.volumeId],
  () => {
    scrollToTop();
    loadReader();
  }
);

function handleBeforeUnload() {
  persistScroll();
}

onMounted(() => {
  scrollToTop();
  loadReader();
  window.addEventListener('beforeunload', handleBeforeUnload);
});

onBeforeUnmount(() => {
  persistScroll();
  window.removeEventListener('beforeunload', handleBeforeUnload);
});
</script>

<template>
  <div class="reader-shell" :class="themeClass">
    <n-space vertical :size="16">
      <n-card class="reader-toolbar-card" :bordered="false">
        <n-flex justify="space-between" align="center" :wrap="true" :size="16" class="reader-toolbar-flex">
          <router-link :to="{ name: 'book', params: { pathWord: route.params.pathWord } }">
            <n-button tertiary>返回详情</n-button>
          </router-link>

          <n-flex align="center" :wrap="true" :size="16" class="reader-controls">
            <div class="reader-control">
              <span>字号</span>
              <n-slider v-model:value="settings.fontSize" :min="14" :max="30" :step="1" style="width: 140px" />
            </div>
            <div class="reader-control">
              <span>行距</span>
              <n-slider v-model:value="settings.lineHeight" :min="1.4" :max="2.6" :step="0.1" style="width: 140px" />
            </div>
            <div class="reader-control">
              <span>模式</span>
              <n-select v-model:value="settings.theme" :options="themeOptions" style="width: 120px" />
            </div>
          </n-flex>
        </n-flex>
      </n-card>

      <n-alert v-if="error" type="error" :show-icon="false">{{ error }}</n-alert>

      <n-spin :show="loading">
        <template v-if="book && volume">
          <n-card class="reader-header-card" :bordered="false">
            <n-space vertical :size="12">
              <div>
                <p class="eyebrow">READER</p>
                <h1 class="page-title">{{ book.title }}</h1>
                <p class="page-desc">{{ volume.title }}</p>
              </div>

              <n-flex :size="12">
                <router-link
                  v-if="volume.prev"
                  :to="{ name: 'reader', params: { pathWord: route.params.pathWord, volumeId: volume.prev } }"
                >
                  <n-button secondary>上一卷</n-button>
                </router-link>
                <router-link
                  v-if="volume.next"
                  :to="{ name: 'reader', params: { pathWord: route.params.pathWord, volumeId: volume.next } }"
                >
                  <n-button secondary>下一卷</n-button>
                </router-link>
              </n-flex>
            </n-space>
          </n-card>

          <n-card class="reader-content-card" :bordered="false">
            <article class="reader-content" :style="readingStyle">
              <section
                v-for="item in items"
                :key="item.id"
                class="reader-block"
                :class="item.type === 'image' ? 'reader-image-block' : ''"
              >
                <template v-if="item.type === 'text'">
                  <n-thing>
                    <template #header>{{ item.title }}</template>
                  </n-thing>
                  <p v-for="(paragraph, index) in item.text.split('\n').filter(Boolean)" :key="`${item.id}-${index}`">
                    {{ paragraph }}
                  </p>
                </template>

                <template v-else-if="item.type === 'image'">
                  <n-thing>
                    <template #header>{{ item.title }}</template>
                  </n-thing>
                  <img :src="item.url" :alt="item.title" loading="lazy" />
                </template>
              </section>
            </article>

            <n-flex justify="center" class="reader-end-actions">
              <router-link
                v-if="volume.next"
                :to="{ name: 'reader', params: { pathWord: route.params.pathWord, volumeId: volume.next } }"
                @click="markJumpToTop(volume.next)"
              >
                <n-button type="primary" size="large">{{ endActionLabel }}</n-button>
              </router-link>
              <n-button v-else size="large" disabled>{{ endActionLabel }}</n-button>
            </n-flex>
          </n-card>
        </template>

        <n-card v-else-if="!error" :bordered="false">
          <n-empty description="暂无可显示的正文内容" />
        </n-card>
      </n-spin>
    </n-space>
  </div>
</template>
