import { invoke } from '@tauri-apps/api/core';
import { revealItemInDir } from '@tauri-apps/plugin-opener';

// Типы данных
export interface FileNode {
  id: string;
  parent_id: string | null;
  name: string;
  path: string;
  relative_path: string;
  is_directory: boolean;
  size: number | null; // null означает, что размер еще не загружен
  token_count: number | null;
  selected: boolean;
  expanded: boolean;
}

export interface FileUpdate {
  id: string;
  size: number;
  token_count: number;
}

export interface ProgressEvent {
  current: number;
  total: number;
  stage: string; // "preparing", "processing", "writing", "completed"
}

export interface AppStats {
  files: number;
  size: number;
  tokens: number;
}

export interface GenerateResult {
  preview_content: string;
  is_truncated: boolean;
  stats: AppStats;
}

// Параметры для команд
export interface AppConfig {
  ignored_names: string[];
  binary_extensions: string[];
  token_limit?: number; // Опционально для обратной совместимости
  max_file_size?: number;
  output_template?: string;
  theme?: 'system' | 'light' | 'dark';
  output_filename?: string;
}

export type SettingType = 
  | { type: 'Text' }
  | { type: 'Number'; options: { min?: number; max?: number; suffix?: string } }
  | { type: 'Select'; options: { options: string[] } }
  | { type: 'Tags' }
  | { type: 'Textarea'; options: { rows: number } };

export interface SettingField {
  key: string;
  label: string;
  description?: string;
  component: SettingType;
}

export interface SettingSection {
  id: string;
  label: string;
  fields: SettingField[];
}

export interface OpenDirectoryParams {
  path?: string;
  config?: AppConfig;
}

export interface UpdateSelectionParams {
  id: string;
  selected: boolean;
}

export interface ToggleExpandedParams {
  id: string;
  expanded: boolean;
}

export interface ScanDirectoryParams {
  id: string;
  config?: AppConfig;
}

export interface GenerateMarkdownParams {
  outputPath?: string;
  config?: AppConfig;
}

export interface SearchNodesParams {
  query: string;
}

export interface ReadFileParams {
  id: string;
}

export interface GetParentDirectoryParams {
  path: string;
}

// API функции для вызова Rust команд
export const commands = {
  // Repository commands
  getCurrentDirectory: (): Promise<string> => {
    return invoke<string>('get_current_directory');
  },

  getParentDirectory: (params: GetParentDirectoryParams): Promise<string | null> => {
    return invoke<string | null>('get_parent_directory', { path: params.path });
  },

  openDirectory: (params: OpenDirectoryParams): Promise<FileNode[]> => {
    return invoke<FileNode[]>('open_directory', { path: params.path, config: params.config });
  },

  updateSelection: (params: UpdateSelectionParams): Promise<void> => {
    return invoke('update_selection', { id: params.id, selected: params.selected });
  },

  toggleExpanded: (params: ToggleExpandedParams): Promise<void> => {
    return invoke('toggle_expanded', { id: params.id, expanded: params.expanded });
  },

  getTree: (): Promise<FileNode[]> => {
    return invoke<FileNode[]>('get_tree');
  },

  getState: (): Promise<Record<string, FileNode>> => {
    return invoke<Record<string, FileNode>>('get_state');
  },

  scanDirectory: (params: ScanDirectoryParams): Promise<FileNode[]> => {
    return invoke<FileNode[]>('scan_directory', { id: params.id, config: params.config });
  },

  searchNodes: (params: SearchNodesParams): Promise<string[]> => {
    return invoke<string[]>('search_nodes', { query: params.query });
  },

  // Generator commands
  generateMarkdown: (params: GenerateMarkdownParams): Promise<GenerateResult> => {
    // Tauri автоматически конвертирует camelCase -> snake_case для Rust
    return invoke<GenerateResult>('generate_markdown', { 
      outputPath: params.outputPath, 
      config: params.config 
    });
  },

  getStats: (): Promise<AppStats> => {
    return invoke<AppStats>('get_stats');
  },

  // File operations
  readFile: (params: ReadFileParams): Promise<string> => {
    return invoke<string>('read_file', { id: params.id });
  },

  saveConfig: (): Promise<void> => {
    return invoke('save_config');
  },

  loadConfig: (): Promise<FileNode[]> => {
    return invoke<FileNode[]>('load_config');
  },

  // Clipboard command
  copyToClipboard: (): Promise<void> => {
    return invoke('copy_from_cache_to_clipboard');
  },

  // Selection commands
  selectAll: (): Promise<void> => {
    return invoke('select_all');
  },

  deselectAll: (): Promise<void> => {
    return invoke('deselect_all');
  },

  // File system operations
  revealInExplorer: async (path: string): Promise<void> => {
    try {
      await revealItemInDir(path);
    } catch (error) {
      console.error('Failed to reveal item:', error);
      throw error;
    }
  },

  // Settings commands
  getConfigSchema: (): Promise<SettingSection[]> => {
    return invoke('get_config_schema');
  },

  getDefaultConfig: (): Promise<AppConfig> => {
    return invoke('get_default_config');
  },
};

