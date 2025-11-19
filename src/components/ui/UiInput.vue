<template>
  <div class="relative group">
    <div v-if="$slots.prefix" class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500 group-focus-within:text-blue-500 transition-colors">
      <slot name="prefix" />
    </div>
    <input
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      class="block w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-lg placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
      :class="[
        $slots.prefix ? 'pl-10' : 'pl-3',
        $slots.suffix ? 'pr-10' : 'pr-3',
        size === 'sm' ? 'py-1.5 text-xs' : 'py-2.5 text-sm'
      ]"
      v-bind="$attrs"
    />
    <div v-if="$slots.suffix" class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 dark:text-slate-500">
      <slot name="suffix" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string | number;
  size?: 'sm' | 'md';
}>();

defineEmits(['update:modelValue']);
</script>

