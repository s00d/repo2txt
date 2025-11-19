<template>
  <div class="relative z-50">
    <div class="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 shadow-sm gap-4">
      
      <!-- ЛЕВАЯ ЧАСТЬ: Навигация (Path Bar) -->
      <div class="flex items-center gap-2 w-1/3 min-w-[250px]">
        <!-- Кнопка "Вверх" -->
        <UiButton 
          variant="secondary" 
          size="icon" 
          @click="handleNavigateUp" 
          :disabled="!store.rootPath || isNavigating"
          title="Go to parent directory"
          class="shrink-0 h-[38px] w-[38px]"
        >
          <ArrowUp :size="18" />
        </UiButton>

        <!-- Адресная строка (Grouped Input) -->
        <div class="flex flex-1 items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden transition-all hover:border-blue-400 dark:hover:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 h-[38px]">
          
          <!-- Основная кнопка выбора папки -->
          <button 
            class="flex-1 flex items-center gap-2 px-3 h-full text-left overflow-hidden hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors outline-none"
            @click="handleOpenDirectory"
            title="Change folder..."
          >
            <FolderOpen :size="16" class="text-yellow-500 shrink-0" />
            
            <span 
              class="truncate text-xs font-mono text-slate-700 dark:text-slate-200 leading-normal" 
              :class="!store.rootPath ? 'opacity-50 italic' : ''"
            >
              {{ store.rootPath || 'Select Project Folder...' }}
            </span>
          </button>

          <!-- Разделитель -->
          <div v-if="store.rootPath" class="w-px h-4 bg-slate-200 dark:bg-slate-600 shrink-0"></div>

          <!-- Кнопка открытия в проводнике -->
          <button
             v-if="store.rootPath"
             class="px-2.5 h-full flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0 outline-none focus:bg-slate-100 dark:focus:bg-slate-700"
             @click.stop="openCurrentFolder"
             title="Reveal in File Explorer / Finder"
          >
             <FolderSymlink :size="15" />
          </button>
        </div>
      </div>

      <!-- ЦЕНТР: Поиск -->
      <div class="flex-1 max-w-xl relative group">
        <input
          type="text"
          class="block w-full pl-3 pr-10 py-2 border border-slate-200 dark:border-slate-700 rounded-lg leading-5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm h-[38px] shadow-sm"
          v-model="searchQuery"
          @input="handleSearch"
          placeholder="Search files..."
        />
        <!-- Иконка поиска или кнопка очистки справа -->
        <div class="absolute inset-y-0 right-0 pr-3 flex items-center">
          <button 
            v-if="searchQuery"
            @click="clearSearch"
            class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer transition-colors"
          >
            <X :size="14" />
          </button>
          <div 
            v-else
            class="pointer-events-none"
          >
            <Search :size="16" class="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          </div>
        </div>
      </div>

      <!-- ПРАВАЯ ЧАСТЬ: Действия -->
      <div class="flex items-center gap-2">
        
        <!-- Меню действий -->
        <div class="relative group z-50">
             <UiButton variant="secondary" size="icon" class="h-[38px] w-[38px]">
                <MoreHorizontal :size="18" />
             </UiButton>
             <div class="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 py-1 hidden group-hover:block overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                <button @click="store.selectAll()" class="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <CheckSquare :size="16" /> Select All Files
                </button>
                <button @click="store.deselectAll()" class="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <Square :size="16" /> Deselect All
                </button>
                <div class="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                <button @click="store.collapseAll()" class="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <Minimize2 :size="16" /> Collapse All
                </button>
                 <button @click="handleRefresh" class="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <RefreshCw :size="16" /> Refresh
                </button>
             </div>
        </div>

        <!-- Кнопка Настроек -->
        <UiButton 
            variant="secondary" 
            size="icon" 
            @click="isSettingsModalOpen = true" 
            title="Settings"
            class="h-[38px] w-[38px]"
        >
            <Settings :size="18" />
        </UiButton>

        <div class="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>

        <!-- Generate -->
        <UiButton 
            variant="primary" 
            @click="handleGenerate" 
            :disabled="isGenerating || !store.rootPath"
            class="shadow-md shadow-blue-500/10 min-w-[110px] h-[38px]"
        >
             <Loader2 v-if="isGenerating" :size="16" class="animate-spin" />
             <Download v-else :size="16" />
             
             <span v-if="isGenerating && progress" class="text-xs font-bold">
               {{ Math.round((progress.current / progress.total) * 100) }}%
             </span>
             <span v-else class="font-semibold">Export</span>
        </UiButton>
      </div>
    </div>
    
    <!-- Модалки -->
    <SettingsModal :is-open="isSettingsModalOpen" @close="isSettingsModalOpen = false" />
    
    <!-- МОДАЛКА РЕЗУЛЬТАТА -->
    <Modal
      :is-open="modalOpen"
      @close="modalOpen = false"
      :title="modalContent?.success ? 'Generation Complete' : 'Error'"
    >
      <!-- ВАЖНО: h-[80vh] задает фиксированную высоту контейнеру модалки -->
      <div class="flex flex-col h-[80vh] w-full overflow-hidden">
        
        <!-- Статус (Header) -->
        <div class="px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 shrink-0">
          <div v-if="modalContent?.success" class="flex items-start gap-3">
            <div class="mt-0.5 w-full">
              <p class="text-sm text-slate-600 dark:text-slate-300 font-medium mb-2">{{ modalContent.message }}</p>
              <div v-if="modalContent.path" class="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded border border-slate-200 dark:border-slate-700">
                 <FileText :size="14" class="text-slate-400" />
                 <p class="text-xs text-slate-600 dark:text-slate-300 font-mono break-all">
                    {{ modalContent.path }}
                 </p>
              </div>
            </div>
          </div>
          <div v-else class="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-100 dark:border-red-800">
            {{ modalContent?.message || 'Unknown error occurred' }}
          </div>
        </div>

        <!-- Предпросмотр (Body) -->
        <div v-if="modalContent?.success && modalContent?.content" class="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50 dark:bg-slate-950">
          
          <!-- Тулбар превью -->
          <div class="flex items-center justify-between px-6 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0">
            <span class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
              Preview
              <span v-if="modalContent.isTruncated" class="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-500 text-[10px]">First 50KB</span>
            </span>
            <button
              class="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-md transition-colors border border-slate-200 dark:border-slate-600 shadow-sm"
              @click="handleCopyToClipboard"
            >
              <Copy :size="14" />
              Copy Full Content
            </button>
          </div>

          <!-- Текстовая область -->
          <!-- ВАЖНО: flex-1 и overflow-hidden для правильного скролла внутри CodePreview -->
          <div class="flex-1 relative w-full overflow-hidden">
             <CodePreview 
                class="absolute inset-0 w-full h-full"
                :content="modalContent.content" 
                language="markdown"
             />
          </div>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { listen } from '@tauri-apps/api/event';
import { useRepoStore } from '../stores/repo';
import { commands, type ProgressEvent } from '../api/commands';
import Modal from './Modal.vue';
import SettingsModal from './SettingsModal.vue';
import CodePreview from './CodePreview.vue';
import UiButton from './ui/UiButton.vue';
import { 
  ArrowUp, FolderOpen, Search, X, Settings, Download, 
  Loader2, MoreHorizontal, CheckSquare, Square, Minimize2, RefreshCw, FolderSymlink, Copy, FileText
} from 'lucide-vue-next';

const store = useRepoStore();
const searchQuery = ref('');
const isNavigating = ref(false);
const isSettingsModalOpen = ref(false);

const isGenerating = ref(false);
const progress = ref<ProgressEvent | null>(null);
const modalOpen = ref(false);
const modalContent = ref<{
  success: boolean;
  message: string;
  path?: string;
  content?: string;
  isTruncated?: boolean;
} | null>(null);

let unlistenProgress: (() => void) | null = null;
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

onMounted(async () => {
  unlistenProgress = await listen<ProgressEvent>('generation-progress', (event) => {
    progress.value = event.payload;
  });
});

onUnmounted(() => {
  if (unlistenProgress) unlistenProgress();
  if (searchTimeout) clearTimeout(searchTimeout);
});

const handleOpenDirectory = async () => {
  await store.openDirectory();
};

const handleNavigateUp = async () => {
  isNavigating.value = true;
  try {
    await store.navigateToParent();
  } finally {
    isNavigating.value = false;
  }
};

const handleSearch = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(() => {
    store.searchNodes(searchQuery.value);
  }, 300);
};

const clearSearch = () => {
  searchQuery.value = '';
  store.searchNodes('');
};

const handleRefresh = async () => {
  if (store.rootPath) {
    await store.openDirectory(store.rootPath);
  }
};

const handleGenerate = async () => {
  isGenerating.value = true;
  progress.value = null;
  modalOpen.value = false;

  try {
    const outputPath = store.config.output_filename || 'output.md';
    const result = await store.generateMarkdown(outputPath);

    modalContent.value = {
      success: true,
      message: `Markdown successfully saved!`,
      path: outputPath,
      content: result.preview_content,
      isTruncated: result.is_truncated,
    };
    modalOpen.value = true;
  } catch (error) {
    console.error("Generation error:", error);
    const msg = typeof error === 'string' 
      ? error 
      : (error instanceof Error ? error.message : 'Unknown error');
    
    modalContent.value = {
      success: false,
      message: msg,
    };
    modalOpen.value = true;
  } finally {
    isGenerating.value = false;
    progress.value = null;
  }
};

const handleCopyToClipboard = async () => {
  try {
    await commands.copyToClipboard();
    alert('Full content copied to clipboard!');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    alert('Failed to copy: ' + errorMessage);
  }
};

const openCurrentFolder = async () => {
  if (store.rootPath) {
    try {
      await commands.revealInExplorer(store.rootPath);
    } catch (e) {
      console.error('Failed to reveal folder:', e);
    }
  }
};
</script>

<style scoped>
.animate-in {
  animation: fadeIn 0.15s ease-out;
}

.fade-in {
  animation: fadeIn 0.15s ease-out;
}

.slide-in-from-top-2 {
  animation: slideInFromTop 0.15s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideInFromTop {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
