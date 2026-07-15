<script setup>
import { ArrowRight, Search, Sparkles } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { fetchComics, searchComics } from '../api/manga';
import Alert from '../components/ui/alert/Alert.vue';
import Badge from '../components/ui/badge/Badge.vue';
import Button from '../components/ui/button/Button.vue';
import Card from '../components/ui/card/Card.vue';
import CardContent from '../components/ui/card/CardContent.vue';
import Input from '../components/ui/input/Input.vue';
import Pagination from '../components/ui/pagination/Pagination.vue';

const FEATURED_PATH = 'wzmkncwndlrbbdbbd';
const comics = ref([]);
const total = ref(0);
const offset = ref(0);
const limit = ref(20);
const keyword = ref('');
const loading = ref(false);
const error = ref('');

const page = computed(() => Math.floor(offset.value / limit.value) + 1);
const pageCount = computed(() => Math.max(Math.ceil(total.value / limit.value), 1));
const isSearching = computed(() => keyword.value.trim().length > 0);

async function loadPage(nextOffset = 0) {
  loading.value = true;
  error.value = '';

  try {
    const query = keyword.value.trim();
    const data = query
      ? await searchComics({ keyword: query, offset: nextOffset, limit: limit.value })
      : await fetchComics({ offset: nextOffset, limit: limit.value });
    comics.value = data.list;
    total.value = data.total;
    offset.value = data.offset;
    limit.value = data.limit;
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载漫画失败';
    comics.value = [];
  } finally {
    loading.value = false;
  }
}

function clearSearch() {
  keyword.value = '';
  loadPage(0);
}

onMounted(() => loadPage(0));
</script>

<template>
  <div class="space-y-5">
    <section class="manga-hero overflow-hidden rounded-[2rem] border border-border/70">
      <div class="relative z-10 max-w-3xl px-6 py-10 sm:px-10 sm:py-14">
        <div class="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/20 px-3 py-1 text-xs tracking-[0.24em] text-amber-100">
          <Sparkles class="size-3.5" />
          MANGA SHELF
        </div>
        <h1 class="text-4xl font-black leading-tight text-white sm:text-6xl">漫画馆</h1>
        <p class="mt-4 max-w-2xl text-base leading-8 text-stone-200">从目录选择章节，以连续长图模式阅读。桌面端与手机端共用同一套沉浸式界面。</p>
        <router-link :to="{ name: 'comic', params: { pathWord: FEATURED_PATH } }" class="mt-7 inline-block">
          <Button size="lg" class="bg-amber-500 text-stone-950 hover:bg-amber-400">
            查看示例漫画
            <ArrowRight class="ml-2 size-4" />
          </Button>
        </router-link>
      </div>
    </section>

    <Card>
      <CardContent class="flex flex-col gap-3 p-4 sm:flex-row sm:p-5">
        <div class="relative flex-1">
          <Search class="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="keyword" class="pl-10" placeholder="搜索漫画名称" @keydown.enter.prevent="loadPage(0)" />
        </div>
        <Button :disabled="loading" @click="loadPage(0)">{{ loading ? '搜索中…' : '搜索' }}</Button>
        <Button v-if="isSearching" variant="outline" @click="clearSearch">清空</Button>
      </CardContent>
    </Card>

    <Alert v-if="error" variant="error">{{ error }}</Alert>

    <Card>
      <CardContent class="space-y-5 p-4 sm:p-6">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-xs uppercase tracking-[0.28em] text-primary">{{ isSearching ? 'Search result' : 'Latest update' }}</p>
            <h2 class="mt-1 text-2xl font-bold">{{ isSearching ? `“${keyword.trim()}”的搜索结果` : '最近更新' }}</h2>
          </div>
          <Pagination :page="page" :page-count="pageCount" @update:page="(value) => loadPage((value - 1) * limit)" />
        </div>

        <div v-if="loading" class="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
          <div v-for="n in 10" :key="n" class="space-y-3">
            <div class="aspect-[3/4] animate-pulse rounded-2xl bg-secondary" />
            <div class="h-4 animate-pulse rounded bg-secondary" />
          </div>
        </div>

        <div v-else-if="comics.length" class="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
          <router-link
            v-for="comic in comics"
            :key="comic.pathWord"
            :to="{ name: 'comic', params: { pathWord: comic.pathWord } }"
            class="group min-w-0"
          >
            <article class="h-full overflow-hidden rounded-2xl border border-border/70 bg-background transition duration-200 group-hover:-translate-y-1 group-hover:border-primary/50">
              <div class="overflow-hidden bg-secondary">
                <img :src="comic.cover" :alt="comic.title" class="aspect-[3/4] w-full object-cover transition duration-300 group-hover:scale-[1.03]" loading="lazy" />
              </div>
              <div class="space-y-2 p-3">
                <h3 class="line-clamp-2 font-semibold leading-snug">{{ comic.title }}</h3>
                <p class="truncate text-xs text-muted-foreground">{{ comic.authors.join(' / ') || '未知作者' }}</p>
                <div class="flex flex-wrap gap-1.5">
                  <Badge v-if="comic.status" variant="soft">{{ comic.status }}</Badge>
                  <Badge v-if="comic.region" variant="outline">{{ comic.region }}</Badge>
                </div>
              </div>
            </article>
          </router-link>
        </div>

        <div v-else class="rounded-3xl border border-dashed border-border/70 px-6 py-16 text-center text-muted-foreground">没有找到漫画。</div>
      </CardContent>
    </Card>
  </div>
</template>
