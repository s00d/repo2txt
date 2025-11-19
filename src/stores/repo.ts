import { defineStore } from 'pinia';
import { open } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';
import { LazyStore } from '@tauri-apps/plugin-store';
import { commands, type FileNode, type AppStats, type GenerateResult, type FileUpdate, type AppConfig } from '../api/commands';

// Re-export типы для обратной совместимости
export type { FileNode, AppStats, GenerateResult, AppConfig };

// Инициализация стора (settings.json создастся в AppData)
const settingsStore = new LazyStore('settings.json');

export interface FlattenedNode extends FileNode {
  depth: number;
}

// Интерфейс для виртуального скроллера (упрощенный, без текстовых линий)
export interface FileRow extends FileNode {
  depth: number;
  // isLast и parentLines удалены - используем CSS indent guides
}

export const useRepoStore = defineStore('repo', {
  state: () => ({
    nodes: [] as FileNode[],
    rootPath: '',
    stats: { files: 0, size: 0, tokens: 0 } as AppStats,
    isLoading: false,
    isAnalyzing: false, // Флаг, что идет фоновый анализ
    selectedFilePath: null as string | null,
    loadingNodes: new Set<string>(), // Узлы, которые сейчас загружаются
    searchQuery: '', // Поисковый запрос
    searchResults: [] as string[], // ID найденных узлов
    focusedNodeId: null as string | null, // ID сфокусированного узла для клавиатурной навигации
    config: {
      ignored_names: [],
      ignored_folders: [],
      binary_extensions: [],
      token_limit: 128000,
      max_file_size: 1024 * 1024,
      output_template: "## {{path}}\n\n```{{language}}\n{{content}}\n```\n\n---\n\n",
      theme: 'system',
      output_filename: 'output.md',
    } as AppConfig,
  }),

  getters: {
    // Плоский список видимых узлов для виртуализации (старый, для совместимости)
    visibleNodes(): FlattenedNode[] {
      return this.visibleRows;
    },

    // ЭТО ГЛАВНАЯ МАГИЯ - правильное построение дерева с parentLines
    visibleRows(state): FileRow[] {
      const rows: FileRow[] = [];

      // Если есть поиск, показываем только результаты поиска
      if (state.searchQuery.trim()) {
        const resultsSet = new Set(state.searchResults);
        return state.nodes
          .filter(n => resultsSet.has(n.id))
          .map(n => ({ 
            ...n, 
            depth: 0
          }));
      }

      // Создаем Map для быстрого доступа к детям
      const childrenMap = new Map<string, FileNode[]>();

      // Группируем узлы по родителям
      for (const node of state.nodes) {
        // parent_id может быть null или пустой строкой - оба случая означают корневой узел
        const pid = (node.parent_id === null || node.parent_id === '') ? null : node.parent_id;
        const key = pid ?? 'root';
        if (!childrenMap.has(key)) childrenMap.set(key, []);
        const children = childrenMap.get(key);
        if (children) {
          children.push(node);
        }
      }
      
      console.log('Building tree from', state.nodes.length, 'nodes');
      const rootNodes = childrenMap.get('root') || [];
      console.log('Root nodes:', rootNodes.length);
      if (rootNodes.length > 0) {
        console.log('Sample root nodes:', rootNodes.slice(0, 5).map(n => ({ 
          name: n.name, 
          id: n.id, 
          parent_id: n.parent_id,
          is_dir: n.is_directory 
        })));
      } else {
        console.warn('No root nodes found! All nodes:', state.nodes.map(n => ({ 
          name: n.name, 
          parent_id: n.parent_id 
        })));
      }

      // Функция сортировки: Папки сверху, потом файлы по алфавиту
      const sortNodes = (a: FileNode, b: FileNode) => {
        if (a.is_directory !== b.is_directory) {
          return a.is_directory ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      };

      // Рекурсивный обход (DFS) для построения плоского списка
      const traverse = (parentId: string | null, depth: number) => {
        const key = parentId || 'root';
        const children = childrenMap.get(key) || [];
        children.sort(sortNodes);

        children.forEach((node) => {
          // Добавляем узел в плоский список (только с depth, без parentLines)
          rows.push({
            ...node,
            depth
          });

          // Если это папка и она раскрыта — идем вглубь
          if (node.is_directory && node.expanded) {
            traverse(node.id, depth + 1);
          }
        });
      };

      traverse(null, 0);
      console.log('Built visible rows:', rows.length);
      return rows;
    },
  },

  actions: {
    async loadSettings() {
      try {
        const defaultConfig = await commands.getDefaultConfig();
        const savedConfig = await settingsStore.get<AppConfig>('app_config');
        if (savedConfig) {
          // Убеждаемся, что все новые поля есть (для обратной совместимости)
          if (savedConfig.token_limit === undefined) {
            savedConfig.token_limit = defaultConfig.token_limit;
          }
          if (savedConfig.max_file_size === undefined) {
            savedConfig.max_file_size = defaultConfig.max_file_size;
          }
          if (!savedConfig.output_template) {
            savedConfig.output_template = defaultConfig.output_template;
          }
          if (!savedConfig.theme) {
            savedConfig.theme = defaultConfig.theme;
          }
          if (!savedConfig.output_filename) {
            savedConfig.output_filename = defaultConfig.output_filename;
          }
          // Обратная совместимость: если ignored_folders нет, используем дефолтные значения
          if (!savedConfig.ignored_folders || savedConfig.ignored_folders.length === 0) {
            savedConfig.ignored_folders = [...defaultConfig.ignored_folders];
          }
          this.config = savedConfig;
          // Применяем тему
          this.applyTheme();
        } else {
          // Если файла нет, сохраняем дефолт
          await this.saveSettings(defaultConfig);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
        // Fallback to default
        try {
          const defaultConfig = await commands.getDefaultConfig();
          this.config = defaultConfig;
        } catch (e) {
          console.error('Failed to get default config:', e);
          // Последний fallback - минимальный конфиг
          this.config = {
            ignored_names: [],
            ignored_folders: [],
            binary_extensions: [],
            token_limit: 128000,
            max_file_size: 1024 * 1024,
            output_template: "## {{path}}\n\n```{{language}}\n{{content}}\n```\n\n---\n\n",
            theme: 'system',
            output_filename: 'output.md',
          };
        }
        this.applyTheme();
      }
    },

    async saveSettings(newConfig: AppConfig) {
      try {
        this.config = newConfig;
        await settingsStore.set('app_config', newConfig);
        await settingsStore.save(); // Принудительная запись на диск
        
        // Применяем тему
        this.applyTheme();
        
        // Если папка открыта, перезагружаем её с новыми фильтрами
        if (this.rootPath) {
          await this.openDirectory(this.rootPath);
        }
      } catch (error) {
        console.error('Failed to save settings:', error);
      }
    },

    applyTheme() {
      const theme = this.config.theme || 'system';
      const html = document.documentElement;
      
      let isDark = false;
      
      if (theme === 'dark') {
        isDark = true;
      } else if (theme === 'light') {
        isDark = false;
      } else {
        // system
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      
      if (isDark) {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
      
      console.log(`Theme applied: ${theme} (isDark: ${isDark})`);
    },

    async openDirectory(customPath?: string) {
      let path: string;
      
      if (customPath) {
        path = customPath;
      } else {
        const selected = await open({
          directory: true,
          multiple: false,
        });

        if (!selected || typeof selected !== 'string') {
          return;
        }
        
        path = selected;
      }

      this.isLoading = true;
      this.isAnalyzing = true; // Начинаем анализ
      try {
        // ВАЖНО: Передаем текущий конфиг в команду открытия!
        const nodes = await commands.openDirectory({ 
          path, 
          config: this.config // Передаем настройки фильтрации
        });
        console.log('Received nodes from Rust:', nodes.length);
        this.nodes = nodes;
        this.rootPath = path;
        
        // Сброс статистики
        this.stats = { files: 0, size: 0, tokens: 0 };
        console.log('Updated store with', this.nodes.length, 'nodes');
      } catch (error) {
        console.error('Error opening directory:', error);
        throw error;
      } finally {
        this.isLoading = false; // Скелет загружен, убираем главный лоадер
      }
    },

    async setupListeners() {
      // Слушаем обновления файлов пачками
      await listen<FileUpdate[]>('files-updated', (event) => {
        const updates = event.payload;
        
        // Создаем Map для быстрого поиска обновлений
        const updateMap = new Map(updates.map(u => [u.id, u]));
        
        // Проходим по нодам и обновляем (Vue реактивность сработает эффективно)
        for (const node of this.nodes) {
          const update = updateMap.get(node.id);
          if (update) {
            node.size = update.size;
            node.token_count = update.token_count;
          }
        }
        
        // Пересчитываем общую статистику
        this.recalculateStats();
      });

      await listen('analysis-completed', () => {
        this.isAnalyzing = false;
        this.recalculateStats();
      });
    },

    recalculateStats() {
      // Простая сумма по выбранным файлам
      let files = 0, size = 0, tokens = 0;
      for (const node of this.nodes) {
        if (node.selected && !node.is_directory && node.size !== null) {
          files++;
          size += node.size;
          tokens += node.token_count || 0;
        }
      }
      this.stats = { files, size, tokens };
    },

    async loadCurrentDirectory() {
      try {
        const currentDir = await commands.getCurrentDirectory();
        await this.openDirectory(currentDir);
      } catch (error) {
        console.error('Failed to load current directory:', error);
      }
    },

    async navigateToParent() {
      if (!this.rootPath) {
        return;
      }
      try {
        const parentPath = await commands.getParentDirectory({ path: this.rootPath });
        if (parentPath) {
          await this.openDirectory(parentPath);
        }
      } catch (error) {
        console.error('Failed to navigate to parent:', error);
      }
    },

    async toggleSelection(nodeId: string) {
      // Оптимистичное обновление UI
      const node = this.nodes.find(n => n.id === nodeId);
      if (!node) return;

      const newSelected = !node.selected;
      node.selected = newSelected;

      // Если это папка, рекурсивно обновляем всех детей в UI
      if (node.is_directory) {
        const queue = [nodeId];
        const affectedIds = new Set<string>();

        while (queue.length > 0) {
          const currentParentId = queue.pop();
          if (!currentParentId) break;

          this.nodes.forEach(n => {
            if (n.parent_id === currentParentId) {
              n.selected = newSelected;
              affectedIds.add(n.id);
              if (n.is_directory) {
                queue.push(n.id);
              }
            }
          });
        }
      }

      // Отправка в Rust
      await commands.updateSelection({ id: nodeId, selected: newSelected });

      // Получение пересчитанной статистики
      this.recalculateStats();
    },

    async toggleExpanded(nodeId: string) {
      const node = this.nodes.find(n => n.id === nodeId);
      if (node && node.is_directory) {
        const wasExpanded = node.expanded;
        node.expanded = !node.expanded;
        await commands.toggleExpanded({ id: nodeId, expanded: node.expanded });
        
        // Если раскрываем и детей еще нет, сканируем директорию
        if (node.expanded && !wasExpanded) {
          // Проверяем, есть ли уже дети
          const existingChildren = this.nodes.filter(n => n.parent_id === nodeId);
          if (existingChildren.length === 0) {
            // Добавляем узел в загрузку
            this.loadingNodes.add(nodeId);
            try {
              const children = await commands.scanDirectory({ id: nodeId, config: this.config });
              // Добавляем только новых детей (проверка на дубликаты)
              const existingIds = new Set(this.nodes.map(n => n.id));
              const newChildren = children.filter(child => !existingIds.has(child.id));
              this.nodes.push(...newChildren);
            } finally {
              // Убираем узел из загрузки
              this.loadingNodes.delete(nodeId);
            }
          }
        }
      }
    },

    async generateMarkdown(outputPath?: string): Promise<GenerateResult> {
      const result = await commands.generateMarkdown({
        outputPath,
        config: this.config, // Передаем текущий конфиг
      });
      this.stats = result.stats;
      return result;
    },

    async searchNodes(query: string) {
      this.searchQuery = query;
      if (query.trim()) {
        try {
          this.searchResults = await commands.searchNodes({ query });
        } catch (error) {
          console.error('Search failed:', error);
          this.searchResults = [];
        }
      } else {
        this.searchResults = [];
      }
    },

    collapseAll() {
      // Сворачиваем все папки
      for (const node of this.nodes) {
        if (node.is_directory && node.expanded) {
          node.expanded = false;
          // Обновляем состояние в Rust (опционально, для синхронизации)
          commands.toggleExpanded({ id: node.id, expanded: false }).catch(err => {
            console.error('Failed to collapse node:', err);
          });
        }
      }
    },

    async selectAll() {
      // Выбираем все файлы (не папки)
      for (const node of this.nodes) {
        if (!node.is_directory && !node.selected) {
          node.selected = true;
        }
      }
      await commands.selectAll();
      this.recalculateStats();
    },

    async deselectAll() {
      // Снимаем выбор со всех файлов
      for (const node of this.nodes) {
        if (node.selected) {
          node.selected = false;
        }
      }
      await commands.deselectAll();
      this.recalculateStats();
    },
  },
});

