<script setup>
import { NButton, NCard, NEmpty, NGrid, NGridItem, NSpace, NThing } from 'naive-ui';
import { computed, onMounted, ref } from 'vue';
import { loadHistory, saveHistory } from '../utils/reader';

const history = ref({
  books: [],
  volumes: []
});

const hasHistory = computed(() => history.value.books.length || history.value.volumes.length);

function refreshHistory() {
  history.value = loadHistory();
}

function clearHistory() {
  history.value = {
    books: [],
    volumes: []
  };
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
  <n-space vertical :size="20">
    <n-grid :cols="24" :x-gap="16" :y-gap="16">
      <n-grid-item :span="18">
        <n-card class="hero-card" :bordered="false">
          <p class="eyebrow">HISTORY</p>
          <h1 class="page-title">历史记录</h1>
          <p class="page-desc">查看最近浏览过的书籍，以及上次阅读到哪一卷。</p>
        </n-card>
      </n-grid-item>
      <n-grid-item :span="6">
        <n-card class="stat-card" :bordered="false">
          <div class="history-stat">
            <div class="history-stat-label">历史总数</div>
            <div class="history-stat-value">{{ history.books.length + history.volumes.length }}</div>
            <n-button v-if="hasHistory" type="primary" secondary block @click="clearHistory">清空历史</n-button>
          </div>
        </n-card>
      </n-grid-item>
    </n-grid>

    <template v-if="hasHistory">
      <n-grid :cols="24" :x-gap="16" :y-gap="16">
        <n-grid-item :span="12">
          <n-card title="书籍历史" :bordered="false">
            <n-space vertical :size="12">
              <router-link
                v-for="item in history.books"
                :key="`book-${item.pathWord}`"
                class="history-link"
                :to="{ name: 'book', params: { pathWord: item.pathWord } }"
              >
                <n-card hoverable embedded class="history-item-card">
                  <div class="history-book-item">
                    <img :src="item.cover" :alt="item.title" loading="lazy" />
                    <n-thing>
                      <template #header>{{ item.title }}</template>
                      <template #description>{{ (item.authors || []).join(' / ') || '未知作者' }}</template>
                      <p class="history-time">浏览于 {{ formatTime(item.updatedAt) }}</p>
                    </n-thing>
                  </div>
                </n-card>
              </router-link>
            </n-space>
          </n-card>
        </n-grid-item>

        <n-grid-item :span="12">
          <n-card title="卷历史" :bordered="false">
            <n-space vertical :size="12">
              <router-link
                v-for="item in history.volumes"
                :key="`volume-${item.pathWord}-${item.volumeId}`"
                class="history-link"
                :to="{ name: 'reader', params: { pathWord: item.pathWord, volumeId: item.volumeId } }"
              >
                <n-card hoverable embedded class="history-item-card">
                  <n-thing>
                    <template #header>{{ item.bookTitle }}</template>
                    <template #description>{{ item.volumeTitle }}</template>
                    <p class="history-time">阅读于 {{ formatTime(item.updatedAt) }}</p>
                  </n-thing>
                </n-card>
              </router-link>
            </n-space>
          </n-card>
        </n-grid-item>
      </n-grid>
    </template>

    <n-card v-else :bordered="false">
      <n-empty description="还没有历史记录，先去浏览一本小说吧。" />
    </n-card>
  </n-space>
</template>
