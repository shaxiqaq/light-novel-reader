<script setup>
import { cva } from 'class-variance-authority';
import { computed } from 'vue';
import { cn } from '../../../lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors', {
  variants: {
    variant: {
      default: 'border-transparent bg-primary text-primary-foreground',
      soft: 'border-transparent bg-primary/10 text-primary',
      outline: 'border-border text-foreground'
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

const classes = computed(() => cn(badgeVariants({ variant: props.variant }), props.class));
</script>

<template>
  <span :class="classes"><slot /></span>
</template>
