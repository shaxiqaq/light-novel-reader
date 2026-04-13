<script setup>
import { cn } from '../../../lib/utils';

defineProps({
  modelValue: { type: [String, Number], default: '' },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
  class: { type: String, default: '' }
});

defineEmits(['update:modelValue']);
</script>

<template>
  <input
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :class="cn('flex h-11 w-full rounded-2xl border border-input bg-background px-4 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-50', $props.class)"
    @input="$emit('update:modelValue', $event.target.value)"
  />
</template>
