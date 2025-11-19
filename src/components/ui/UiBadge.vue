<template>
  <span 
    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border"
    :class="variants[variant]"
  >
    <slot />
  </span>
</template>

<script setup lang="ts">
const variants = {
  default: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  warning: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  success: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
  error: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
};

withDefaults(defineProps<{
  variant?: keyof typeof variants;
}>(), { variant: 'default' });
</script>

