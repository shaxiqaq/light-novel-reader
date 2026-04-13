<script setup>
import Button from '../button/Button.vue';

defineProps({
  page: { type: Number, required: true },
  pageCount: { type: Number, required: true }
});

const emit = defineEmits(['update:page']);
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <Button variant="outline" :disabled="page <= 1" @click="emit('update:page', page - 1)">上一页</Button>
    <span class="text-sm text-muted-foreground">第 {{ page }} / {{ pageCount }} 页</span>
    <Button variant="outline" :disabled="page >= pageCount" @click="emit('update:page', page + 1)">下一页</Button>
  </div>
</template>
