<script setup>
import { cn } from '../../../lib/utils';

defineProps({
  class: { type: String, default: '' }
});
</script>

<template>
  <div :class="cn('rounded-3xl border border-border/70 bg-card text-card-foreground shadow-sm', $props.class)">
    <slot />
  </div>
</template>
