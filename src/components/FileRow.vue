<template>
  <div
    class="group flex items-center h-[26px] cursor-pointer select-none transition-colors relative pr-2"
    :class="[
      row.selected 
        ? 'bg-blue-100 dark:bg-blue-900' 
        : 'hover:bg-slate-100 dark:hover:bg-slate-800',
      { 'text-blue-700 dark:text-blue-100': row.selected },
      { 'ring-1 ring-inset ring-blue-300 dark:ring-blue-500': focused }
    ]"
    @click="handleClick"
  >
    <!-- Indent Guides (Vertical Lines) -->
    <div 
      v-for="i in row.depth" 
      :key="i"
      class="absolute h-full w-px bg-slate-200 dark:bg-slate-800 z-0"
      :style="{ left: `${(i - 1) * 20 + 11}px` }"
    ></div>

    <!-- Container with indentation -->
    <div 
      class="flex items-center flex-1 min-w-0 h-full relative z-10"
      :style="{ paddingLeft: `${row.depth * 20}px` }"
    >
      <!-- Toggle Arrow -->
      <div 
        class="w-[22px] h-full flex items-center justify-center shrink-0 hover:text-slate-900 dark:hover:text-slate-100 text-slate-400 transition-colors"
        @click.stop="handleExpand"
      >
        <Loader2 
          v-if="isLoading" 
          :size="12" 
          class="animate-spin" 
        />
        <ChevronRight 
          v-else-if="row.is_directory"
          class="transition-transform duration-200"
          :class="{ 'rotate-90': row.expanded }"
          :size="14"
        />
      </div>

      <!-- Checkbox -->
      <div class="flex items-center justify-center w-[20px] h-full mr-1.5 shrink-0" @click.stop>
        <input
          type="checkbox"
          class="w-3.5 h-3.5 rounded-[3px] border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer transition-all bg-white dark:bg-slate-700 checked:bg-blue-600 dark:checked:bg-blue-500"
          :checked="row.selected"
          @change="handleSelect"
        />
      </div>

      <!-- File/Folder Icon -->
      <div class="mr-2 shrink-0 flex items-center justify-center">
        <template v-if="row.is_directory">
          <FolderOpen 
            v-if="row.expanded" 
            class="text-yellow-400" 
            :size="16" 
            :fill="'currentColor'" 
            :fill-opacity="0.2" 
          />
          <Folder 
            v-else 
            class="text-yellow-400" 
            :size="16" 
            :fill="'currentColor'" 
            :fill-opacity="0.2" 
          />
        </template>
        <template v-else>
          <component 
            :is="getFileIcon(row.name)" 
            :class="getFileIconColor(row.name)" 
            :size="16" 
          />
        </template>
      </div>

      <!-- File Name with search highlight -->
      <span 
        class="truncate text-[13px] leading-none pt-0.5 flex-1"
        :class="row.selected ? 'font-medium' : 'text-slate-700 dark:text-slate-300'"
        :title="row.name"
        v-html="highlightedName"
      ></span>

      <!-- Action Buttons (Hover) -->
      <div class="flex items-center gap-1 pr-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ml-2">
        <!-- Set Root -->
        <button
          v-if="row.is_directory"
          class="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          @click.stop="handleSetAsRoot"
          title="Set as root directory"
        >
          <ArrowDownToLine :size="14" />
        </button>

        <!-- Reveal -->
        <button
          class="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
          @click.stop="handleReveal"
          title="Reveal in File Explorer / Finder"
        >
          <FolderSymlink :size="14" />
        </button>

        <!-- Copy Path -->
        <button
          class="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
          @click.stop="handleCopyPath"
          :title="copied ? 'Copied!' : 'Copy path'"
        >
          <Check v-if="copied" :size="14" class="text-green-600 dark:text-green-400" />
          <Copy v-else :size="14" />
        </button>
      </div>
      
      <!-- Size / Loader -->
      <div v-if="!row.is_directory" class="ml-auto pl-2 text-[10px] text-slate-400 shrink-0 min-w-[40px] text-right font-mono group-hover:hidden">
        <template v-if="isLoading">
          <Loader2 :size="10" class="animate-spin inline" />
        </template>
        <template v-else-if="row.size !== null">
          {{ formatSize(row.size) }}
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useRepoStore, type FileRow } from '../stores/repo';
import { commands } from '../api/commands';
import { 
  ChevronRight, Folder, FolderOpen, Loader2, 
  File, FileCode, FileJson, FileType, FileImage, FileText,
  Copy, Check, ArrowDownToLine, FolderSymlink
} from 'lucide-vue-next';

const props = defineProps<{
  row: FileRow;
  focused?: boolean;
  searchQuery?: string;
}>();

const emit = defineEmits<{
  select: [node: FileRow];
  expand: [node: FileRow];
  'file-click': [node: FileRow];
}>();

const store = useRepoStore();
const copied = ref(false);

const handleSetAsRoot = () => {
  store.openDirectory(props.row.path);
};

const handleReveal = async () => {
  try {
    await commands.revealInExplorer(props.row.path);
  } catch (error) {
    console.error('Failed to reveal:', error);
  }
};

const highlightedName = computed(() => {
  if (!props.searchQuery || !props.searchQuery.trim()) {
    return escapeHtml(props.row.name);
  }
  
  const query = props.searchQuery.trim().toLowerCase();
  const name = props.row.name;
  const lowerName = name.toLowerCase();
  
  const index = lowerName.indexOf(query);
  if (index === -1) {
    return escapeHtml(name);
  }
  
  const before = escapeHtml(name.substring(0, index));
  const match = escapeHtml(name.substring(index, index + query.length));
  const after = escapeHtml(name.substring(index + query.length));
  
  return `${before}<mark class="bg-yellow-200 dark:bg-yellow-900/50 text-yellow-900 dark:text-yellow-200 font-semibold rounded-sm px-0.5">${match}</mark>${after}`;
});

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

const isLoading = computed(() => store.loadingNodes.has(props.row.id));

const handleClick = () => {
  if (props.row.is_directory) {
    handleExpand();
  } else {
    emit('file-click', props.row);
  }
};

const handleExpand = () => {
  if (props.row.is_directory) {
    emit('expand', props.row);
  }
};

const handleSelect = () => {
  emit('select', props.row);
};

const handleCopyPath = async () => {
  try {
    await writeText(props.row.path);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (error) {
    console.error('Failed to copy path:', error);
  }
};

function formatSize(bytes: number): string {
  if (bytes === 0) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts': case 'tsx': case 'js': case 'jsx': case 'vue': case 'py': case 'rs': case 'go': case 'c': case 'cpp': case 'h': case 'hpp':
      return FileCode;
    case 'json': case 'yml': case 'yaml': case 'toml': case 'xml':
      return FileJson;
    case 'css': case 'scss': case 'less':
      return FileType;
    case 'png': case 'jpg': case 'jpeg': case 'svg': case 'gif': case 'webp':
      return FileImage;
    case 'md': case 'txt':
      return FileText;
    default:
      return File;
  }
}

function getFileIconColor(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts': case 'tsx': return 'text-blue-500';
    case 'js': case 'jsx': return 'text-yellow-500';
    case 'rs': return 'text-orange-600 dark:text-orange-500';
    case 'json': return 'text-yellow-600 dark:text-yellow-500';
    case 'css': case 'scss': case 'less': return 'text-sky-400';
    case 'html': return 'text-orange-500';
    case 'vue': return 'text-emerald-500';
    case 'md': return 'text-slate-500 dark:text-slate-400';
    case 'lock': case 'gitignore': return 'text-slate-400 dark:text-slate-500';
    case 'toml': return 'text-blue-400';
    case 'yaml': case 'yml': return 'text-purple-500';
    case 'py': return 'text-blue-400';
    case 'go': return 'text-cyan-500';
    case 'java': return 'text-orange-500';
    case 'c': case 'cpp': case 'h': case 'hpp': return 'text-blue-600 dark:text-blue-500';
    default: return 'text-slate-400 dark:text-slate-500';
  }
}
</script>
