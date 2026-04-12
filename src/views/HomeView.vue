<script setup>
import {
  NAlert,
  NButton,
  NCard,
  NEmpty,
  NFlex,
  NGrid,
  NGridItem,
  NInput,
  NPagination,
  NSpace,
  NSpin,
  NStatistic,
  NTag,
  NThing
} from 'naive-ui';
import { computed, onMounted, ref } from 'vue';
import { fetchBooks, searchBooks } from '../api/novels';

const books = ref([]);
const total = ref(0);
const offset = ref(0);
const limit = ref(20);
const loading = ref(false);
const error = ref('');
const keyword = ref('');
const searchResults = ref([]);
const searchLoading = ref(false);
const searchError = ref('');
const searchTotal = ref(0);
const searchOffset = ref(0);
const searchLimit = ref(20);

const isSearching = computed(() => keyword.value.trim().length > 0);
const displayBooks = computed(() => (isSearching.value ? searchResults.value : books.value));
const browsePage = computed(() => Math.floor(offset.value / limit.value) + 1);
const browsePageCount = computed(() => Math.max(Math.ceil(total.value / limit.value), 1));
const searchPage = computed(() => Math.floor(searchOffset.value / searchLimit.value) + 1);
const searchPageCount = computed(() => Math.max(Math.ceil(searchTotal.value / searchLimit.value), 1));

function formatStatus(status) {
  if (status === 1) return '完结';
  if (status === 0) return '连载';
  return '未知';
}

async function loadPage(nextOffset = 0) {
  loading.value = true;
  error.value = '';

  try {
    const data = await fetchBooks({ offset: nextOffset, limit: limit.value });
    books.value = data.list;
    total.value = data.total;
    offset.value = data.offset;
    limit.value = data.limit;
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载首页失败';
  } finally {
    loading.value = false;
  }
}

async function runSearch(nextOffset = 0) {
  const query = keyword.value.trim();

  if (!query) {
    searchResults.value = [];
    searchError.value = '';
    searchTotal.value = 0;
    searchOffset.value = 0;
    return;
  }

  searchLoading.value = true;
  searchError.value = '';

  try {
    const data = await searchBooks({
      keyword: query,
      offset: nextOffset,
      limit: searchLimit.value
    });
    searchResults.value = data.list;
    searchTotal.value = data.total;
    searchOffset.value = data.offset;
    searchLimit.value = data.limit;
  } catch (err) {
    searchError.value = err instanceof Error ? err.message : '搜索失败';
    searchResults.value = [];
    searchTotal.value = 0;
  } finally {
    searchLoading.value = false;
  }
}

function clearSearch() {
  keyword.value = '';
  searchResults.value = [];
  searchError.value = '';
  searchTotal.value = 0;
  searchOffset.value = 0;
}

function handleBrowsePageChange(page) {
  loadPage((page - 1) * limit.value);
}

function handleSearchPageChange(page) {
  runSearch((page - 1) * searchLimit.value);
}

onMounted(() => {
  loadPage(0);
});
</script>

<template>
  <n-space vertical :size="20">
    <n-grid :cols="24" :x-gap="16" :y-gap="16">
      <n-grid-item :span="18" :m="18" :s="24" :xs="24">
        <n-card class="hero-card" :bordered="false">
          <p class="eyebrow">DIRECT API READER</p>
          <h1 class="page-title">轻小说首页</h1>
          <p class="page-desc">直接读取上游移动端 API，浏览最新更新的轻小说。</p>
        </n-card>
      </n-grid-item>
      <n-grid-item :span="6" :m="6" :s="24" :xs="24">
        <n-card class="stat-card" :bordered="false">
          <n-statistic label="总作品数" :value="total" />
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-card class="search-card" :bordered="false">
      <n-space vertical :size="14">
        <n-flex :wrap="false" :size="12" class="search-row">
          <n-input
            v-model:value="keyword"
            clearable
            size="large"
            placeholder="搜索书名、作者或 path_word"
            @keydown.enter.prevent="runSearch()"
          />
          <n-button type="primary" size="large" :loading="searchLoading" @click="runSearch()">搜索</n-button>
          <n-button v-if="isSearching" size="large" @click="clearSearch">清空</n-button>
        </n-flex>

        <n-alert v-if="isSearching" type="info" :show-icon="false">
          已切换为上游搜索接口。当前第 {{ searchPage }} / {{ searchPageCount }} 页，共 {{ searchTotal }} 条结果。
        </n-alert>
        <n-alert v-else type="default" :show-icon="false">
          最近浏览和继续阅读已经移到独立的“历史记录”页面。
          <router-link class="inline-link" :to="{ name: 'history' }">前往查看</router-link>
        </n-alert>
      </n-space>
    </n-card>

    <n-alert v-if="error" type="error" :show-icon="false">{{ error }}</n-alert>
    <n-alert v-if="searchError" type="error" :show-icon="false">{{ searchError }}</n-alert>

    <n-card :bordered="false">
      <n-space vertical :size="18">
        <n-flex justify="center">
          <n-pagination
            class="pager"
            v-if="!isSearching"
            :page="browsePage"
            :page-count="browsePageCount"
            @update:page="handleBrowsePageChange"
          />
          <n-pagination
            class="pager"
            v-else
            :page="searchPage"
            :page-count="searchPageCount"
            @update:page="handleSearchPageChange"
          />
        </n-flex>

        <n-spin :show="loading || searchLoading">
          <template v-if="displayBooks.length">
            <div class="book-grid">
              <router-link
                v-for="book in displayBooks"
                :key="book.pathWord"
                class="book-link"
                :to="{ name: 'book', params: { pathWord: book.pathWord } }"
              >
                <n-card class="book-card" hoverable>
                  <img class="book-cover" :src="book.cover" :alt="book.title" loading="lazy" />
                  <n-thing class="book-thing">
                    <template #header>{{ book.title }}</template>
                    <template #description>
                      {{ book.authors.join(' / ') || '未知作者' }}
                    </template>
                    <n-space size="small" class="book-meta-row">
                      <n-tag size="small" round>{{ formatStatus(book.status) }}</n-tag>
                      <n-tag size="small" round type="warning">热度 {{ book.popularity }}</n-tag>
                    </n-space>
                    <p class="book-updated">{{ book.updatedAt ? `更新于 ${book.updatedAt}` : '来自搜索结果' }}</p>
                  </n-thing>
                </n-card>
              </router-link>
            </div>
          </template>
          <n-empty v-else description="没有找到匹配的作品，请换个关键词试试。" />
        </n-spin>
      </n-space>
    </n-card>
  </n-space>
</template>
