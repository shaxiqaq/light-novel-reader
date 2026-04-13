<script setup>
import { Moon, Sun } from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import Button from './components/ui/button/Button.vue';
import { applyAppTheme, loadAppTheme, saveAppTheme } from './utils/theme';

const route = useRoute();
const isReaderRoute = computed(() => route.name === 'reader');
const appTheme = ref('light');

function toggleTheme() {
  appTheme.value = appTheme.value === 'night' ? 'light' : 'night';
}

onMounted(() => {
  appTheme.value = loadAppTheme();
  applyAppTheme(appTheme.value);
});

watch(appTheme, (value) => {
  applyAppTheme(value);
  saveAppTheme(value);
});
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <header
      v-if="!isReaderRoute"
      class="sticky top-0 z-30 border-b border-border/60 bg-card/85 backdrop-blur-xl"
    >
      <div class="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <router-link to="/" class="text-2xl font-bold tracking-tight text-foreground">轻小说阅读站</router-link>

        <div class="flex items-center gap-3">
          <Button variant="outline" size="sm" @click="toggleTheme">
            <Sun v-if="appTheme === 'night'" class="mr-1 size-4" />
            <Moon v-else class="mr-1 size-4" />
            {{ appTheme === 'night' ? '日间模式' : '黑夜模式' }}
          </Button>

          <nav class="flex items-center gap-5 text-sm font-medium text-muted-foreground">
            <router-link to="/" class="transition hover:text-foreground">首页</router-link>
            <router-link to="/history" class="transition hover:text-foreground">历史记录</router-link>
          </nav>
        </div>
      </div>
    </header>

    <main
      class="mx-auto w-full max-w-6xl px-4 pb-10 pt-6 sm:px-6"
      :class="isReaderRoute ? 'max-w-5xl pt-3 sm:pt-5' : ''"
    >
      <router-view />
    </main>
  </div>
</template>
