<script setup>
import { ArrowRight, BookOpen, Images } from 'lucide-vue-next';
import Button from '../components/ui/button/Button.vue';
</script>

<template>
  <section class="landing-shell grid min-h-[calc(100vh-9rem)] gap-4 lg:grid-cols-2">
    <router-link
      :to="{ name: 'novel-home' }"
      class="landing-door landing-door-novel group relative flex min-h-[24rem] overflow-hidden rounded-[2rem] border border-border/70 p-7 sm:min-h-[34rem] sm:p-10"
    >
      <div class="relative z-10 flex w-full flex-col justify-between">
        <div>
          <div class="inline-flex items-center gap-2 rounded-full border border-amber-900/15 bg-white/45 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-amber-900">
            <BookOpen class="size-3.5" />
            LIGHT NOVEL
          </div>
          <h1 class="mt-7 max-w-md text-4xl font-black leading-tight text-stone-900 sm:text-6xl">轻小说<br />阅读站</h1>
          <p class="mt-5 max-w-md text-sm leading-7 text-stone-700 sm:text-base">搜索轻小说、查看作品详情与卷目录，并继续上次保存的阅读进度。</p>
        </div>

        <Button size="lg" class="w-fit bg-stone-900 text-stone-50 hover:bg-stone-800">
          进入小说区
          <ArrowRight class="ml-2 size-4 transition group-hover:translate-x-1" />
        </Button>
      </div>
      <span class="landing-mark" aria-hidden="true">文</span>
    </router-link>

    <router-link
      :to="{ name: 'manga-home' }"
      class="landing-door landing-door-manga group relative flex min-h-[24rem] overflow-hidden rounded-[2rem] border border-stone-700 p-7 sm:min-h-[34rem] sm:p-10"
    >
      <div class="relative z-10 flex w-full flex-col justify-between">
        <div>
          <div class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-amber-200">
            <Images class="size-3.5" />
            MANGA
          </div>
          <h2 class="mt-7 max-w-md text-4xl font-black leading-tight text-white sm:text-6xl">漫画<br />阅读站</h2>
          <p class="mt-5 max-w-md text-sm leading-7 text-stone-300 sm:text-base">浏览漫画与章节目录，在桌面或手机上使用连续长图模式沉浸阅读。</p>
        </div>

        <Button size="lg" class="w-fit bg-amber-500 text-stone-950 hover:bg-amber-400">
          进入漫画区
          <ArrowRight class="ml-2 size-4 transition group-hover:translate-x-1" />
        </Button>
      </div>
      <span class="landing-mark" aria-hidden="true">画</span>
    </router-link>
  </section>
</template>
