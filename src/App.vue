<template>
  <div class="flex flex-col h-screen bg-slate-50 dark:bg-slate-900">
    <Toolbar />
    <div class="flex flex-1 overflow-hidden bg-white dark:bg-slate-900">
      <div class="w-3/5 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <FileTree />
      </div>
      <div class="w-2/5 bg-white dark:bg-slate-900">
        <FilePreview />
      </div>
    </div>
    <StatsPanel />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { listen } from '@tauri-apps/api/event';
import { useRepoStore } from './stores/repo';
import Toolbar from './components/Toolbar.vue';
import FileTree from './components/FileTree.vue';
import FilePreview from './components/FilePreview.vue';
import StatsPanel from './components/StatsPanel.vue';

const store = useRepoStore();

let dragDropUnlisten: (() => void) | null = null;
let systemThemeListener: (() => void) | null = null;
let mediaQuery: MediaQueryList | null = null;

onMounted(async () => {
  // Включаем прослушку событий
  await store.setupListeners();
  // Загружаем настройки перед открытием папки
  await store.loadSettings();
  
  // Слушаем системные изменения темы
  systemThemeListener = () => {
    if (store.config.theme === 'system') {
      store.applyTheme();
    }
  };
  
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', systemThemeListener);
  
  // Автоматически загружаем текущую директорию при запуске
  await store.loadCurrentDirectory();
  
  // Слушаем событие перетаскивания файлов на окно
  try {
    dragDropUnlisten = await listen('tauri://drag-drop', async (event: any) => {
      const paths = event.payload.paths;
      if (paths && paths.length > 0) {
        // Берем первый путь
        const path = paths[0];
        // Проверяем, что это директория (Tauri передает путь как строку)
        await store.openDirectory(path);
      }
    });
  } catch (error) {
    console.warn('Drag and drop not available:', error);
  }
});

onUnmounted(() => {
  // Очистка слушателя системной темы
  if (mediaQuery && systemThemeListener) {
    mediaQuery.removeEventListener('change', systemThemeListener);
  }
  // Очистка слушателя drag-drop
  if (dragDropUnlisten) {
    dragDropUnlisten();
  }
});
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
}
</style>
