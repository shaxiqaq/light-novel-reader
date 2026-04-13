<script setup>
import { cn } from '../../../lib/utils';

defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] },
  class: { type: String, default: '' }
});

defineEmits(['update:modelValue']);
</script>

<template>
  <select
    :value="modelValue"
    :class="cn('flex h-11 w-full rounded-2xl border border-input bg-background px-4 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60', $props.class)"
    @change="$emit('update:modelValue', $event.target.value)"
  >
    <option
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      class="bg-background text-foreground"
    >
      {{ option.label }}
    </option>
  </select>
</template>
