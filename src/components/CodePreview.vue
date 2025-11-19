<template>
  <div class="flex h-full w-full bg-white dark:bg-slate-900 custom-scrollbar text-sm relative overflow-hidden">
    <!-- Номера строк -->
    <div class="sticky left-0 z-10 flex flex-col items-end bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 py-4 pr-3 pl-2 select-none h-full overflow-hidden w-12 flex-shrink-0">
      <span 
        v-for="n in Math.min(lineCount, 2000)" 
        :key="n"
        class="font-mono text-[11px] leading-5 text-slate-400 dark:text-slate-500 text-right w-full"
      >
        {{ n }}
      </span>
      <span v-if="lineCount > 2000" class="text-slate-400 dark:text-slate-500 text-[10px] mt-1">...</span>
    </div>

    <!-- Код -->
    <div class="flex-1 py-4 px-4 min-w-0 overflow-auto h-full">
      <!-- 
         text-slate-800 dark:text-slate-200: базовый цвет текста, если highlight не сработал
         !bg-transparent: чтобы фон highlight.js не перекрывал наш фон
      -->
      <pre><code 
        class="font-mono text-[12px] leading-5 !bg-transparent !p-0 block w-full text-slate-800 dark:text-slate-200"
        :class="`language-${language || detectedLanguage}`"
        v-html="highlightedCode"
      ></code></pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import hljs from 'highlight.js/lib/common';

const props = defineProps<{
  content: string;
  language?: string;
  filePath?: string;
}>();

const lineCount = computed(() => {
  if (!props.content) return 0;
  return props.content.split('\n').length;
});

const detectedLanguage = computed(() => {
  if (props.language) return props.language;
  if (!props.filePath) return 'text';
  
  const ext = props.filePath.split('.').pop()?.toLowerCase();
  // Маппинг расширений
  const langMap: Record<string, string> = {
    'ts': 'typescript', 'tsx': 'tsx',
    'js': 'javascript', 'jsx': 'jsx',
    'rs': 'rust', 'py': 'python',
    'go': 'go', 'java': 'java',
    'cpp': 'cpp', 'c': 'c', 'h': 'c', 'hpp': 'cpp',
    'vue': 'xml', 'html': 'xml', 'xml': 'xml', // Vue лучше подсвечивать как HTML/XML если нет парсера
    'css': 'css', 'scss': 'scss', 'less': 'less',
    'json': 'json', 'yaml': 'yaml', 'yml': 'yaml', 'toml': 'toml',
    'md': 'markdown',
    'sh': 'bash', 'bash': 'bash', 'zsh': 'bash',
    'sql': 'sql',
    'php': 'php',
    'rb': 'ruby',
  };
  
  // Для vue файлов попробуем xml, так как common набор hljs может не иметь vue
  if (ext === 'vue') return 'xml';
  
  return langMap[ext || ''] || ext || 'text';
});

// Автоматическая подсветка
const highlightedCode = computed(() => {
  if (!props.content) return '';
  
  // Ограничиваем подсветку для гигантских файлов
  if (props.content.length > 50000) {
    return escapeHtml(props.content);
  }

  try {
    const lang = props.language || detectedLanguage.value;
    
    if (hljs.getLanguage(lang)) {
      return hljs.highlight(props.content, { language: lang }).value;
    }
    return hljs.highlightAuto(props.content).value;
  } catch (e) {
    return escapeHtml(props.content);
  }
});

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
</script>

<style scoped>
/* Стили для скроллбара внутри кода */
.custom-scrollbar::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border: 4px solid transparent;
  background-clip: content-box;
  border-radius: 10px;
}

.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
}

/* Темная тема для скролла */
:global(.dark) .custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #334155;
}
:global(.dark) .custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background-color: #475569;
}
</style>
