<script setup>
import { NAlert, NButton, NCard, NFlex, NGrid, NGridItem, NSpace, NSpin, NTag } from 'naive-ui';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { fetchBookBundle } from '../api/novels';
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
  <n-spin :show="loading">
    <n-space vertical :size="20">
      <n-alert v-if="error" type="error" :show-icon="false">{{ error }}</n-alert>

      <template v-else-if="book">
        <n-card :bordered="false">
          <n-grid :cols="24" :x-gap="20" :y-gap="16">
            <n-grid-item :span="6" :m="6" :s="24" :xs="24">
              <img class="detail-cover" :src="book.cover" :alt="book.title" />
            </n-grid-item>
            <n-grid-item :span="18" :m="18" :s="24" :xs="24">
              <n-space vertical :size="16">
                <div>
                  <p class="eyebrow">BOOK DETAIL</p>
                  <h1 class="page-title">{{ book.title }}</h1>
                  <p class="page-desc">{{ book.authors.join(' / ') || '未知作者' }}</p>
                </div>

                <n-flex wrap="wrap" :size="10">
                  <n-tag round>{{ book.status || '未知状态' }}</n-tag>
                  <n-tag round>{{ book.region || '未知地区' }}</n-tag>
                  <n-tag round type="warning">热度 {{ book.popularity }}</n-tag>
                  <n-tag round type="success">更新 {{ book.updatedAt }}</n-tag>
                </n-flex>

                <n-flex v-if="book.themes.length" wrap="wrap" :size="8">
                  <n-tag v-for="theme in book.themes" :key="theme" size="small" type="info" round>
                    {{ theme }}
                  </n-tag>
                </n-flex>

                <p class="detail-brief">{{ book.brief }}</p>

                <n-flex wrap="wrap" :size="10">
                  <n-tag v-if="meta?.isVip" type="warning" round>详情接口标记为 VIP 内容</n-tag>
                  <n-tag v-if="meta?.isLock" type="error" round>当前作品处于锁定状态</n-tag>
                  <n-tag v-if="book.lastChapter" type="primary" round>最新卷：{{ book.lastChapter.name }}</n-tag>
                </n-flex>
              </n-space>
            </n-grid-item>
          </n-grid>
        </n-card>

        <n-card title="卷列表" :bordered="false">
          <n-space vertical :size="12">
            <router-link
              v-for="volume in volumes"
              :key="volume.id"
              class="volume-link"
              :to="{ name: 'reader', params: { pathWord: book.pathWord, volumeId: volume.id } }"
            >
              <n-card hoverable embedded class="volume-item-card">
                <n-flex justify="space-between" align="center">
                  <div>
                    <strong>{{ volume.title }}</strong>
                    <p class="muted-text">共 {{ volume.count }} 个内容节点</p>
                  </div>
                  <n-button type="primary" tertiary>开始阅读</n-button>
                </n-flex>
              </n-card>
            </router-link>
          </n-space>
        </n-card>
      </template>
    </n-space>
  </n-spin>
</template>
