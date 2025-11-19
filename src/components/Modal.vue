<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm transition-opacity"
    @click="$emit('close')"
  >
      <!-- Контейнер модалки -->
    <div
      class="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-[90%] max-w-4xl max-h-[85vh] flex flex-col overflow-hidden transform transition-all"
      @click.stop
    >
      <!-- Шапка -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div>
          <h2 class="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <XCircle v-if="title.includes('Error')" :size="20" class="text-red-500" />
            <CheckCircle v-else :size="20" class="text-green-500" />
            {{ title }}
          </h2>
        </div>
        <button
          class="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-lg transition-colors"
          @click="$emit('close')"
        >
          <X :size="20" />
        </button>
      </div>

      <!-- Тело -->
      <div class="p-0 flex-1 overflow-hidden relative bg-slate-50/50 dark:bg-slate-800/50">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { X, XCircle, CheckCircle } from 'lucide-vue-next';

defineProps<{
  isOpen: boolean;
  title: string;
}>();

defineEmits<{
  close: [];
}>();
</script>
