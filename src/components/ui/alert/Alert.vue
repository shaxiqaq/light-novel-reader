<script setup>
import { cva } from 'class-variance-authority';
import { computed } from 'vue';
import { cn } from '../../../lib/utils';

const alertVariants = cva('w-full rounded-2xl border px-4 py-3 text-sm', {
  variants: {
    variant: {
      default: 'border-border/70 bg-card text-card-foreground',
      info: 'border-sky-200 bg-sky-50 text-sky-900',
      error: 'border-red-200 bg-red-50 text-red-900'
    }
  },
  defaultVariants: {
    variant: 'default'
  }
});

const props = defineProps({
  variant: { type: String, default: 'default' },
  class: { type: String, default: '' }
});

const classes = computed(() => cn(alertVariants({ variant: props.variant }), props.class));
</script>

<template>
  <div :class="classes"><slot /></div>
</template>
