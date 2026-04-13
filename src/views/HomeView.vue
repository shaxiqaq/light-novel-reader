<script setup>
import { Moon, Search, Sun } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { fetchBooks, searchBooks } from '../api/novels';
import Alert from '../components/ui/alert/Alert.vue';
import Badge from '../components/ui/badge/Badge.vue';
import Button from '../components/ui/button/Button.vue';
import Card from '../components/ui/card/Card.vue';
import CardContent from '../components/ui/card/CardContent.vue';
import CardDescription from '../components/ui/card/CardDescription.vue';
import CardHeader from '../components/ui/card/CardHeader.vue';
import CardTitle from '../components/ui/card/CardTitle.vue';
import Input from '../components/ui/input/Input.vue';
import Pagination from '../components/ui/pagination/Pagination.vue';
import { applyAppTheme, loadAppTheme, saveAppTheme } from '../utils/theme';

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
const appTheme = ref('light');

const isSearching = computed(() => keyword.value.trim().length > 0);
const displayBooks = computed(() => (isSearching.value ? searchResults.value : books.value));
const browsePage = computed(() => Math.floor(offset.value / limit.value) + 1);
const browsePageCount = computed(() => Math.max(Math.ceil(total.value / limit.value), 1));
const searchPage = computed(() => Math.floor(searchOffset.value / searchLimit.value) + 1);
const searchPageCount = computed(() => Math.max(Math.ceil(searchTotal.value / searchLimit.value), 1));

function formatStatus(status) {
  if (status === 1) return '完结';
  if (status === 0) return '连载中';
  return '未知';
}

function updateTheme(theme) {
  appTheme.value = theme;
  applyAppTheme(theme);
  saveAppTheme(theme);
}

function toggleTheme() {
  updateTheme(appTheme.value === 'night' ? 'light' : 'night');
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

onMounted(() => {
  appTheme.value = loadAppTheme();
  applyAppTheme(appTheme.value);
  loadPage(0);
});
</script>

<template>
  <div class="space-y-5">
    <div class="grid gap-4 lg:grid-cols-[1fr_220px]">
      <Card class="border-amber-200/60 bg-[linear-gradient(120deg,rgba(255,248,236,0.98),rgba(248,236,209,0.9))]">
        <CardHeader>
          <p class="text-xs uppercase tracking-[0.32em] text-amber-700/80">Direct API Reader</p>
          <CardTitle class="text-4xl sm:text-5xl">轻小说首页</CardTitle>
          <CardDescription class="text-base leading-7">直接读取上游移动端 API，浏览最新更新的轻小说。</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader class="pb-3">
          <CardDescription>总作品数</CardDescription>
          <CardTitle class="text-5xl">{{ total }}</CardTitle>
        </CardHeader>
      </Card>
    </div>

    <Card>
      <CardContent class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-sm font-semibold">全局主题</p>
          <p class="text-sm text-muted-foreground">主页和阅读页共用同一套黑夜模式。</p>
        </div>
        <div class="flex gap-3">
          <Button :variant="appTheme === 'light' ? 'default' : 'outline'" @click="updateTheme('light')">
            <Sun class="mr-1 size-4" />
            日间
          </Button>
          <Button :variant="appTheme === 'night' ? 'default' : 'outline'" @click="updateTheme('night')">
            <Moon class="mr-1 size-4" />
            黑夜
          </Button>
          <Button variant="ghost" @click="toggleTheme">切换</Button>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader class="pb-4">
        <div class="flex flex-col gap-3 sm:flex-row">
          <div class="relative flex-1">
            <Search class="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              v-model="keyword"
              class="pl-10"
              placeholder="搜索书名、作者或 path_word"
              @keydown.enter.prevent="runSearch()"
            />
          </div>
          <div class="flex gap-3 sm:w-auto">
            <Button class="flex-1 sm:flex-none" :disabled="searchLoading" @click="runSearch()">
              {{ searchLoading ? '搜索中...' : '搜索' }}
            </Button>
            <Button v-if="isSearching" class="flex-1 sm:flex-none" variant="outline" @click="clearSearch">清空</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent class="space-y-3">
        <Alert v-if="isSearching" variant="info">
          已切换为上游搜索接口。当前第 {{ searchPage }} / {{ searchPageCount }} 页，共 {{ searchTotal }} 条结果。
        </Alert>
        <Alert v-else>
          最近浏览和继续阅读已经移动到独立的“历史记录”页面。
          <router-link class="ml-2 font-semibold text-primary hover:underline" :to="{ name: 'history' }">前往查看</router-link>
        </Alert>
      </CardContent>
    </Card>

    <Alert v-if="error" variant="error">{{ error }}</Alert>
    <Alert v-if="searchError" variant="error">{{ searchError }}</Alert>

    <Card>
      <CardHeader class="pb-4">
        <Pagination
          v-if="!isSearching"
          :page="browsePage"
          :page-count="browsePageCount"
          @update:page="(page) => loadPage((page - 1) * limit)"
        />
        <Pagination
          v-else
          :page="searchPage"
          :page-count="searchPageCount"
          @update:page="(page) => runSearch((page - 1) * searchLimit)"
        />
      </CardHeader>

      <CardContent>
        <div v-if="loading || searchLoading" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div v-for="n in 8" :key="n" class="overflow-hidden rounded-3xl border border-border/70 bg-background p-4">
            <div class="aspect-[328/422] animate-pulse rounded-2xl bg-secondary" />
            <div class="mt-4 h-5 animate-pulse rounded bg-secondary" />
            <div class="mt-2 h-4 w-2/3 animate-pulse rounded bg-secondary" />
          </div>
        </div>

        <div v-else-if="displayBooks.length" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <router-link
            v-for="book in displayBooks"
            :key="book.pathWord"
            :to="{ name: 'book', params: { pathWord: book.pathWord } }"
            class="group block"
          >
            <Card class="h-full overflow-hidden transition-transform duration-200 group-hover:-translate-y-1">
              <CardContent class="p-4">
                <img class="aspect-[328/422] w-full rounded-2xl object-cover" :src="book.cover" :alt="book.title" loading="lazy" />
                <div class="mt-4 space-y-3">
                  <h2 class="line-clamp-2 text-lg font-semibold leading-snug">{{ book.title }}</h2>
                  <p class="text-sm text-muted-foreground">{{ book.authors.join(' / ') || '未知作者' }}</p>
                  <div class="flex flex-wrap gap-2">
                    <Badge variant="soft">{{ formatStatus(book.status) }}</Badge>
                    <Badge variant="outline">热度 {{ book.popularity }}</Badge>
                  </div>
                  <p class="text-sm text-muted-foreground">{{ book.updatedAt ? `更新于 ${book.updatedAt}` : '来自搜索结果' }}</p>
                </div>
              </CardContent>
            </Card>
          </router-link>
        </div>

        <div v-else class="rounded-3xl border border-dashed border-border/70 px-6 py-14 text-center text-muted-foreground">
          没有找到匹配的作品，请换一个关键词试试。
        </div>
      </CardContent>
    </Card>
  </div>
</template>
