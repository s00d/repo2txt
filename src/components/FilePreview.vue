<template>
  <div class="h-full flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700">
    <!-- 1. ПУСТОЕ СОСТОЯНИЕ -->
    <div v-if="!filePath" class="flex flex-col items-center justify-center h-full text-slate-300 dark:text-slate-600 select-none">
      <FileText :size="64" class="mb-4 opacity-20" :stroke-width="1" />
      <p class="text-sm font-medium dark:text-slate-400">Select a file to view content</p>
    </div>

    <!-- 2. ЗАГРУЗКА -->
    <div v-else-if="loading" class="flex flex-col items-center justify-center h-full">
      <Loader2 :size="32" class="animate-spin text-blue-500 mb-3" />
      <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">Reading file...</p>
    </div>

    <!-- 3. ОШИБКА -->
    <div v-else-if="error" class="flex items-center justify-center h-full p-8">
      <div class="w-full max-w-md bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-100 dark:border-red-800 text-center">
        <div class="mx-auto w-10 h-10 bg-red-100 dark:bg-red-900/50 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center mb-3">
          <AlertCircle :size="24" />
        </div>
        <h3 class="text-sm font-bold text-red-800 dark:text-red-300 mb-1">Unable to read file</h3>
        <p class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>
      </div>
    </div>

    <!-- 4. КОНТЕНТ (РЕДАКТОР) -->
    <div v-else class="h-full flex flex-col min-h-0">
      <!-- Шапка (Toolbar) -->
      <div class="flex items-center justify-between px-4 h-10 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 select-none shrink-0">
        <div class="flex items-center gap-3 min-w-0">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-xs font-bold text-slate-700 dark:text-slate-300 truncate font-mono" :title="filePath">{{ filePath }}</span>
          </div>
          <UiBadge v-if="truncated" variant="warning" class="text-[9px] uppercase tracking-wide">Truncated</UiBadge>
        </div>
        
        <div class="flex items-center gap-3 pl-2">
          <div class="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
            <span v-if="content">{{ lineCount }} lines</span>
            <span v-if="content" class="mx-1">·</span>
            <span>{{ formatFileSize(size) }}</span>
          </div>
          <div class="h-3 w-px bg-slate-300 dark:bg-slate-600"></div>
          <button 
            @click="copyContent" 
            class="p-1.5 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm hover:text-blue-600 rounded transition-all text-slate-500 dark:text-slate-400 focus:outline-none active:scale-95"
            :class="copied ? 'text-green-600 hover:text-green-700' : ''"
            :title="copied ? 'Copied!' : 'Copy content'"
          >
            <Check v-if="copied" :size="14" />
            <Copy v-else :size="14" />
          </button>
        </div>
      </div>

      <!-- Область кода -->
      <!-- ВАЖНО: flex-1 заставляет компонент занять всё оставшееся место -->
      <CodePreview 
        class="flex-1 min-h-0"
        :content="content" 
        :file-path="filePath"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { commands } from '../api/commands';
import { useRepoStore } from '../stores/repo';
import CodePreview from './CodePreview.vue';
import { FileText, Loader2, AlertCircle, Copy, Check } from 'lucide-vue-next';
import UiBadge from './ui/UiBadge.vue';

const store = useRepoStore();
const filePath = computed(() => store.selectedFilePath);
const content = ref('');
const size = ref(0);
const truncated = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);
const copied = ref(false);

const lineCount = computed(() => {
  if (!content.value) return 0;
  return content.value.split('\n').length;
});

watch(filePath, async (newPath) => {
  if (!newPath) { 
    content.value = ''; 
    return; 
  }
  loading.value = true; 
  error.value = null; 
  copied.value = false;
  // Не очищаем content сразу, чтобы избежать мигания, если загрузка быстрая
  // content.value = '';

  try {
    const fileContent = await commands.readFile({ id: newPath });
    
    // Проверяем, не сменился ли файл пока мы грузили
    if (store.selectedFilePath !== newPath) return;

    const node = store.nodes.find(n => n.id === newPath);
    content.value = fileContent;
    size.value = node?.size || 0;
    truncated.value = fileContent.includes('--- TRUNCATED');
  } catch (err) {
    console.error("Read file error:", err);
    if (typeof err === 'string') {
      error.value = err;
    } else if (err instanceof Error) {
      error.value = err.message;
    } else {
      error.value = JSON.stringify(err);
    }
    content.value = ''; // Очищаем контент при ошибке
  } finally {
    loading.value = false;
  }
});

async function copyContent() {
  if (!content.value) return;
  try {
    await writeText(content.value);
    copied.value = true;
    setTimeout(() => copied.value = false, 2000);
  } catch (e) {
    console.error(e);
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
</script>

