<template>
  <button
    :class="[
      'flex items-center justify-center gap-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95',
      // Размеры
      size === 'sm' ? 'px-3 py-1.5 text-xs' : '',
      size === 'md' ? 'px-4 py-2 text-sm' : '',
      size === 'icon' ? 'p-2' : '',
      // Варианты
      variant === 'primary' 
        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm focus:ring-blue-500 dark:focus:ring-offset-slate-900' 
        : '',
      variant === 'secondary' 
        ? 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:ring-slate-400' 
        : '',
      variant === 'ghost' 
        ? 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200' 
        : '',
      variant === 'danger' 
        ? 'bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-200 border border-red-100 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-800' 
        : ''
    ]"
    :disabled="disabled"
    v-bind="$attrs"
  >
    <slot name="icon-left" />
    <slot />
    <slot name="icon-right" />
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'icon';
  disabled?: boolean;
}>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
});
</script>

