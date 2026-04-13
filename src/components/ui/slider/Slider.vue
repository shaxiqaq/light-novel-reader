<script setup>
import { cn } from '../../../lib/utils';

defineProps({
  modelValue: { type: Number, default: 0 },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  step: { type: Number, default: 1 },
  class: { type: String, default: '' }
});

defineEmits(['update:modelValue']);
</script>

<template>
  <input
    type="range"
    :value="modelValue"
    :min="min"
    :max="max"
    :step="step"
    :class="cn('h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary', $props.class)"
    @input="$emit('update:modelValue', Number($event.target.value))"
  />
</template>
