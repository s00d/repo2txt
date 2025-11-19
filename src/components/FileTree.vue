<template>
  <div 
    class="h-full flex flex-col bg-white dark:bg-slate-900"
    tabindex="0"
    @keydown="handleKeyDown"
    ref="treeContainer"
  >
    <!-- Лоадер -->
    <div v-if="store.isLoading" class="flex items-center justify-center h-full">
      <div class="flex flex-col items-center">
        <Loader2 :size="24" class="animate-spin text-blue-600 mb-2" />
        <p class="text-gray-500 dark:text-gray-400 text-xs">Scanning...</p>
      </div>
    </div>

    <!-- Пустое состояние -->
    <div v-else-if="visibleRows.length === 0" class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
      <div class="text-center">
        <p>{{ store.searchQuery ? 'No results found' : 'No files found' }}</p>
        <p class="text-xs mt-2">Total nodes: {{ store.nodes.length }}</p>
        <p class="text-xs">Visible rows: {{ visibleRows.length }}</p>
      </div>
    </div>

    <!-- ВИРТУАЛЬНЫЙ СПИСОК -->
    <div v-else ref="scrollElement" class="flex-1 h-full w-full custom-scrollbar overflow-auto">
      <div :style="{ height: `${totalHeight}px`, position: 'relative' }">
        <div
          :style="{
            transform: `translateY(${startOffset}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }"
        >
          <template v-for="row in visibleItems" :key="row.id">
            <FileRow
              :row="row"
              :focused="store.focusedNodeId === row.id"
              :search-query="store.searchQuery"
              @select="handleSelect"
              @expand="handleExpand"
              @file-click="handleFileClick"
            />
            <!-- Показываем сообщение для пустых папок -->
            <div
              v-if="row.is_directory && row.expanded && getChildrenCount(row.id) === 0"
              class="text-gray-400 dark:text-gray-500 text-xs italic px-4 py-2"
              :style="{ paddingLeft: `${(row.depth + 1) * 20 + 12}px` }"
            >
              No files
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRepoStore, type FileRow as FileRowType } from '../stores/repo';
import FileRow from './FileRow.vue';
import { Loader2 } from 'lucide-vue-next';

const store = useRepoStore();
const scrollElement = ref<HTMLElement | null>(null);
const treeContainer = ref<HTMLElement | null>(null);

const ITEM_HEIGHT = 28;
const OVERSCAN = 5; // Количество элементов для рендера вне видимой области

const visibleRows = computed(() => store.visibleRows);
const scrollTop = ref(0);
const containerHeight = ref(800);

const visibleRange = computed(() => {
  const start = Math.max(0, Math.floor(scrollTop.value / ITEM_HEIGHT) - OVERSCAN);
  const end = Math.min(
    visibleRows.value.length,
    Math.ceil((scrollTop.value + containerHeight.value) / ITEM_HEIGHT) + OVERSCAN
  );
  return { start, end };
});

const visibleItems = computed(() => {
  return visibleRows.value.slice(visibleRange.value.start, visibleRange.value.end);
});

const totalHeight = computed(() => visibleRows.value.length * ITEM_HEIGHT);
const startOffset = computed(() => visibleRange.value.start * ITEM_HEIGHT);

const handleScroll = () => {
  if (scrollElement.value) {
    scrollTop.value = scrollElement.value.scrollTop;
  }
};

const handleResize = () => {
  if (scrollElement.value) {
    containerHeight.value = scrollElement.value.clientHeight;
  }
};

// Клавиатурная навигация
const handleKeyDown = (event: KeyboardEvent) => {
  // Игнорируем, если фокус на input или textarea
  const target = event.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    return;
  }

  const rows = visibleRows.value;
  if (rows.length === 0) return;

  const currentFocusedIndex = store.focusedNodeId 
    ? rows.findIndex(r => r.id === store.focusedNodeId)
    : -1;

  let newIndex = currentFocusedIndex;

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      newIndex = currentFocusedIndex < 0 ? 0 : Math.min(currentFocusedIndex + 1, rows.length - 1);
      break;
    case 'ArrowUp':
      event.preventDefault();
      newIndex = currentFocusedIndex <= 0 ? 0 : currentFocusedIndex - 1;
      break;
    case 'ArrowRight':
      event.preventDefault();
      if (currentFocusedIndex >= 0) {
        const node = rows[currentFocusedIndex];
        if (node.is_directory && !node.expanded) {
          handleExpand(node);
        }
      }
      return;
    case 'ArrowLeft':
      event.preventDefault();
      if (currentFocusedIndex >= 0) {
        const node = rows[currentFocusedIndex];
        if (node.is_directory && node.expanded) {
          handleExpand(node);
        }
      }
      return;
    case 'Enter':
      event.preventDefault();
      if (currentFocusedIndex >= 0) {
        const node = rows[currentFocusedIndex];
        if (node.is_directory) {
          handleExpand(node);
        } else {
          handleFileClick(node);
        }
      }
      return;
    case ' ':
      event.preventDefault();
      if (currentFocusedIndex >= 0) {
        const node = rows[currentFocusedIndex];
        handleSelect(node);
      }
      return;
    default:
      return;
  }

  if (newIndex >= 0 && newIndex < rows.length) {
    store.focusedNodeId = rows[newIndex].id;
    scrollToIndex(newIndex);
  }
};

const scrollToIndex = (index: number) => {
  if (!scrollElement.value) return;
  
  const targetScrollTop = index * ITEM_HEIGHT;
  const containerHeight = scrollElement.value.clientHeight;
  const currentScrollTop = scrollElement.value.scrollTop;

  // Если элемент вне видимой области, скроллим к нему
  if (targetScrollTop < currentScrollTop || targetScrollTop > currentScrollTop + containerHeight - ITEM_HEIGHT) {
    scrollElement.value.scrollTop = Math.max(0, targetScrollTop - containerHeight / 2 + ITEM_HEIGHT);
  }
};

onMounted(() => {
  if (scrollElement.value) {
    scrollElement.value.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    handleResize();
  }
  
  // Устанавливаем фокус на контейнер для клавиатурной навигации
  if (treeContainer.value) {
    treeContainer.value.focus();
  }
});

onUnmounted(() => {
  if (scrollElement.value) {
    scrollElement.value.removeEventListener('scroll', handleScroll);
    window.removeEventListener('resize', handleResize);
  }
});

watch(visibleRows, () => {
  // При изменении списка узлов не сбрасываем скролл (лучше UX)
  // Можно добавить опцию для сброса при необходимости
});

// Сбрасываем фокус при изменении директории
watch(() => store.rootPath, () => {
  store.focusedNodeId = null;
});

const handleSelect = (node: FileRowType) => {
  store.toggleSelection(node.id);
};

const handleExpand = (node: FileRowType) => {
  store.toggleExpanded(node.id);
};

const handleFileClick = (node: FileRowType) => {
  store.selectedFilePath = node.id;
};

const getChildrenCount = (nodeId: string): number => {
  return store.nodes.filter(n => n.parent_id === nodeId).length;
};
</script>

<style scoped>
/* Стили для скроллбара, чтобы он выглядел нативно, но компактно */
/* Стили скроллбара наследуются из глобальных стилей */
</style>
