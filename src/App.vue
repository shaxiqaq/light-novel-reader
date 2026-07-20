<script setup>
import { Heart, LogIn, Moon, Sun, UserCircle } from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import Button from './components/ui/button/Button.vue';
import { authState, refreshSession } from './services/auth';
import { applyAppTheme, loadAppTheme, saveAppTheme } from './utils/theme';

const route = useRoute();
const isNovelReaderRoute = computed(() => route.name === 'reader');
const isComicReaderRoute = computed(() => route.name === 'comic-reader');
const isReaderRoute = computed(() => isNovelReaderRoute.value || isComicReaderRoute.value);
const activeSection = computed(() => route.meta.section || 'landing');
const brandTitle = computed(() => {
  if (activeSection.value === 'novel') return '轻小说阅读站';
  if (activeSection.value === 'manga') return '漫画阅读站';
  return '纸页阅读站';
});
const brandRoute = computed(() => {
  if (activeSection.value === 'novel') return { name: 'novel-home' };
  if (activeSection.value === 'manga') return { name: 'manga-home' };
  return { name: 'home' };
});
const appTheme = ref('light');

function toggleTheme() {
  appTheme.value = appTheme.value === 'night' ? 'light' : 'night';
}

onMounted(() => {
  appTheme.value = loadAppTheme();
  applyAppTheme(appTheme.value);
  refreshSession();
});

watch(appTheme, (value) => {
  applyAppTheme(value);
  saveAppTheme(value);
});

watch(
  () => route.name,
  () => {
    appTheme.value = loadAppTheme();
    applyAppTheme(appTheme.value);
  }
);
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <header
      v-if="!isReaderRoute"
      class="sticky top-0 z-30 border-b border-border/60 bg-card/85 backdrop-blur-xl"
    >
      <div class="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:flex-nowrap sm:px-6">
        <router-link :to="brandRoute" class="text-2xl font-bold tracking-tight text-foreground">{{ brandTitle }}</router-link>

        <div class="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
          <router-link :to="{ name: 'favorites' }">
            <Button variant="outline" size="sm">
              <Heart class="mr-1 size-4" />
              收藏
            </Button>
          </router-link>
          <router-link :to="{ name: 'account' }">
            <Button variant="outline" size="sm">
              <UserCircle v-if="authState.user" class="mr-1 size-4" />
              <LogIn v-else class="mr-1 size-4" />
              {{ authState.user?.name || (authState.loading ? '检查登录...' : '登录') }}
            </Button>
          </router-link>
          <Button variant="outline" size="sm" @click="toggleTheme">
            <Sun v-if="appTheme === 'night'" class="mr-1 size-4" />
            <Moon v-else class="mr-1 size-4" />
            {{ appTheme === 'night' ? '日间模式' : '黑夜模式' }}
          </Button>

          <nav v-if="activeSection === 'novel'" class="flex items-center gap-3 text-sm font-medium text-muted-foreground sm:gap-5">
            <router-link :to="{ name: 'novel-home' }" class="transition hover:text-foreground">小说首页</router-link>
            <router-link :to="{ name: 'history' }" class="transition hover:text-foreground">历史记录</router-link>
            <router-link :to="{ name: 'manga-home' }" class="transition hover:text-foreground">漫画入口</router-link>
          </nav>

          <nav v-else-if="activeSection === 'manga'" class="flex items-center gap-3 text-sm font-medium text-muted-foreground sm:gap-5">
            <router-link :to="{ name: 'manga-home' }" class="transition hover:text-foreground">漫画首页</router-link>
            <router-link :to="{ name: 'novel-home' }" class="transition hover:text-foreground">小说入口</router-link>
          </nav>

          <nav v-else class="flex items-center gap-3 text-sm font-medium text-muted-foreground sm:gap-5">
            <router-link :to="{ name: 'novel-home' }" class="transition hover:text-foreground">轻小说</router-link>
            <router-link :to="{ name: 'manga-home' }" class="transition hover:text-foreground">漫画</router-link>
          </nav>
        </div>
      </div>
    </header>

    <main
      class="mx-auto w-full"
      :class="
        isComicReaderRoute
          ? 'max-w-none px-0 pb-0 pt-0'
          : isNovelReaderRoute
            ? 'reader-main max-w-5xl px-3 pb-10 pt-3 sm:px-6 sm:pt-5'
            : 'max-w-6xl px-4 pb-10 pt-6 sm:px-6'
      "
    >
      <router-view />
    </main>
  </div>
</template>
