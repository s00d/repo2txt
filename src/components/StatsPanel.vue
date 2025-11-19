<template>
  <div class="h-7 bg-blue-600 text-white flex items-center px-3 text-[11px] select-none justify-between shadow-inner">
    <!-- Слева: Статистика -->
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-1.5" title="Selected Files">
        <File :size="14" class="opacity-70" />
        <span class="font-medium">{{ store.stats.files }}</span> files
      </div>
      
      <div class="flex items-center gap-1.5" title="Total Size">
        <Database :size="14" class="opacity-70" />
        <span class="font-medium">{{ formatFileSize(store.stats.size) }}</span>
      </div>

      <div class="flex items-center gap-1.5" title="Estimated Tokens">
        <Cpu :size="14" class="opacity-70" />
        <span class="font-medium">{{ formatTokenCount(store.stats.tokens) }}</span> tokens
      </div>
      
      <!-- Лимит токенов (Context Usage) -->
      <div class="flex flex-col w-32 ml-4">
        <div class="flex justify-between text-[10px] mb-0.5">
          <span>Context Usage</span>
          <span :class="isOverLimit ? 'text-red-300' : 'text-blue-200'">
            {{ Math.round(percentage) }}%
          </span>
        </div>
        <div class="h-1.5 bg-blue-800/30 rounded-full overflow-hidden">
          <div 
            class="h-full transition-all duration-500"
            :class="isOverLimit ? 'bg-red-400' : 'bg-blue-300'"
            :style="{ width: `${Math.min(percentage, 100)}%` }"
          ></div>
        </div>
      </div>
    </div>

    <!-- Справа: Статус / Путь -->
    <div class="flex items-center gap-3">
      <div v-if="store.isAnalyzing" class="flex items-center gap-2 animate-pulse text-blue-200">
        <div class="w-2 h-2 bg-blue-300 rounded-full"></div>
        <span>Indexing...</span>
      </div>
      <div class="flex items-center gap-1.5 opacity-80 max-w-[300px]">
        <Folder :size="14" class="shrink-0" />
        <span class="truncate">{{ store.rootPath || 'No Folder' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRepoStore } from '../stores/repo';
import { File, Database, Cpu, Folder } from 'lucide-vue-next';

const store = useRepoStore();

// Берем лимит из конфига
const tokenLimit = computed(() => store.config.token_limit || 128000);

const percentage = computed(() => {
  if (tokenLimit.value <= 0) return 0;
  return (store.stats.tokens / tokenLimit.value) * 100;
});

const isOverLimit = computed(() => store.stats.tokens > tokenLimit.value);

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTokenCount(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  return `${(tokens / 1000).toFixed(1)}k`;
}
</script>

