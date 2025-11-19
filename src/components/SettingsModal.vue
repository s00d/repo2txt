<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm transition-opacity"
    @click="handleCancel"
  >
    <!-- Main Container -->
    <div
      class="w-[850px] h-[600px] bg-white dark:bg-slate-950 rounded-xl shadow-2xl flex overflow-hidden ring-1 ring-slate-900/5"
      @click.stop
    >
      
      <!-- LEFT SIDEBAR (Navigation) -->
      <aside class="w-56 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col">
        <div class="p-6 pb-4">
          <h2 class="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <SettingsIcon :size="20" class="text-blue-600" />
            Settings
          </h2>
        </div>
        
        <nav class="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTabId = tab.id"
            class="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200"
            :class="activeTabId === tab.id 
              ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'"
          >
            <component :is="tab.icon" :size="18" class="opacity-80" />
            {{ tab.label }}
          </button>
        </nav>

        <div class="p-4 border-t border-slate-200 dark:border-slate-800">
          <div class="text-[10px] text-slate-400 text-center">
            repo2txt v1.0
          </div>
        </div>
      </aside>

      <!-- RIGHT CONTENT (Scrollable) -->
      <main class="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-950">
        
        <!-- Header -->
        <header class="h-16 border-b border-slate-100 dark:border-slate-800 flex items-center px-8 shrink-0">
          <div>
            <h3 class="text-lg font-bold text-slate-900 dark:text-white">
              {{ activeTab?.label }}
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ activeTab?.description }}
            </p>
          </div>
        </header>

        <!-- Scrollable Body -->
        <div class="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div v-if="loadingSchema" class="flex items-center justify-center h-full">
            <Loader2 :size="32" class="animate-spin text-blue-500" />
          </div>

          <div v-else-if="activeSection" class="space-y-8 animate-fade-in">
            <!-- Специальный UI для выбора темы (если мы в разделе General) -->
            <div v-if="activeTabId === 'general'" class="space-y-6">
              <section class="space-y-3">
                <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Interface Theme
                </label>
                <div class="grid grid-cols-3 gap-3">
                  <button 
                    v-for="theme in (['light', 'dark', 'system'] as const)" 
                    :key="theme"
                    @click="previewTheme(theme)"
                    class="group relative flex items-center justify-center py-3 rounded-xl border transition-all duration-200"
                    :class="localConfig.theme === theme 
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-400 ring-1 ring-blue-500' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-700'"
                  >
                    <span class="capitalize text-sm font-medium">{{ theme }}</span>
                    <div v-if="localConfig.theme === theme" class="absolute top-1 right-1.5">
                      <div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                    </div>
                  </button>
                </div>
              </section>
              <div class="h-px bg-slate-100 dark:bg-slate-800"></div>
            </div>

            <!-- Генерация полей из схемы -->
            <div v-for="field in activeSection.fields" :key="field.key">
              <!-- Пропускаем тему, так как она отрисована выше кастомно -->
              <DynamicField 
                v-if="field.key !== 'theme'" 
                :field="field" 
                v-model="localConfig[field.key]" 
              />
            </div>
          </div>
        </div>

        <!-- Footer (Fixed) -->
        <footer class="h-20 border-t border-slate-100 dark:border-slate-800 px-8 flex items-center justify-between bg-white dark:bg-slate-950 shrink-0 z-10">
          <button 
            @click="handleReset"
            class="text-sm text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-lg transition-colors font-medium flex items-center gap-2"
          >
            <RotateCcw :size="14" />
            Reset Defaults
          </button>

          <div class="flex gap-3">
            <button 
              @click="handleCancel"
              class="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button 
              @click="save"
              class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-lg shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-2"
            >
              <Save :size="16" />
              Save Changes
            </button>
          </div>
        </footer>

      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRepoStore } from '../stores/repo';
import { commands, type SettingSection } from '../api/commands';
import DynamicField from './settings/DynamicField.vue';
import { 
  Settings as SettingsIcon, 
  Filter, 
  Zap, 
  Sliders, 
  Loader2, 
  RotateCcw,
  Save
} from 'lucide-vue-next';

const props = defineProps<{ isOpen: boolean }>();
const emit = defineEmits<{ close: [] }>();
const store = useRepoStore();

const schema = ref<SettingSection[]>([]);
const loadingSchema = ref(true);
const activeTabId = ref('general');
const localConfig = ref<Record<string, any>>({});

// Определение табов и иконок
const tabs = [
  { id: 'general', label: 'General', icon: Sliders, description: 'Appearance and global limits' },
  { id: 'generation', label: 'Generation', icon: Zap, description: 'Markdown output format and size limits' },
  { id: 'filters', label: 'Filters', icon: Filter, description: 'Ignored files and folders' },
];

const activeTab = computed(() => tabs.find(t => t.id === activeTabId.value));
const activeSection = computed(() => schema.value.find(s => s.id === activeTabId.value));

onMounted(async () => {
  try {
    schema.value = await commands.getConfigSchema();
    loadingSchema.value = false;
  } catch (e) {
    console.error("Failed to load schema", e);
    loadingSchema.value = false;
  }
});

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    localConfig.value = JSON.parse(JSON.stringify(store.config));
  }
});

// Отслеживаем изменения темы для предпросмотра
watch(() => localConfig.value.theme, (newTheme) => {
  if (props.isOpen && newTheme) {
    previewTheme(newTheme as 'light' | 'dark' | 'system');
  }
}, { immediate: false });

// Предпросмотр темы
const previewTheme = (theme: 'light' | 'dark' | 'system') => {
  localConfig.value.theme = theme;
  
  const html = document.documentElement;
  let isDark = false;
  if (theme === 'dark') isDark = true;
  else if (theme === 'light') isDark = false;
  else isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (isDark) html.classList.add('dark');
  else html.classList.remove('dark');
};

const handleReset = async () => {
  if (confirm('Reset all settings to defaults?')) {
    try {
      const defaults = await commands.getDefaultConfig();
      localConfig.value = defaults;
      previewTheme(defaults.theme as any);
    } catch (e) {
      console.error(e);
    }
  }
};

const handleCancel = () => {
  // Возвращаем тему как было в сторе
  store.applyTheme();
  emit('close');
};

const save = async () => {
  await store.saveSettings(localConfig.value as any);
  emit('close');
};
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
