<template>
  <div class="flex gap-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="px-1 py-3 text-sm font-medium border-b-2 transition-colors focus:outline-none -mb-px"
      :class="modelValue === tab.id 
        ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400' 
        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'"
      @click="$emit('update:modelValue', tab.id)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string;
  tabs: { id: string; label: string }[];
}>();

defineEmits(['update:modelValue']);
</script>

