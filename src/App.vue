<script setup>
import {
  darkTheme,
  NConfigProvider,
  NGlobalStyle,
  NLayout,
  NLayoutContent,
  NLayoutHeader,
  NMessageProvider,
  NSpace
} from 'naive-ui';
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

const isReaderRoute = computed(() => route.name === 'reader');
</script>

<template>
  <n-config-provider :theme="isReaderRoute ? darkTheme : null">
    <n-message-provider>
      <n-global-style />
      <n-layout class="app-shell" position="absolute">
        <n-layout-header bordered class="topbar">
          <div class="topbar-inner">
            <router-link class="brand" to="/">轻小说阅读站</router-link>
            <n-space align="center" :size="20">
              <router-link class="nav-link" to="/">首页</router-link>
              <router-link class="nav-link" to="/history">历史记录</router-link>
            </n-space>
          </div>
        </n-layout-header>
        <n-layout-content embedded>
          <main class="page-shell">
            <router-view />
          </main>
        </n-layout-content>
      </n-layout>
    </n-message-provider>
  </n-config-provider>
</template>
