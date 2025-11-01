import { EventEmitter } from "events";
import { readdir, stat } from "fs/promises";
import { readFile, writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import ignore from "ignore";
import * as path from "path";
import type { FileNode, UIState } from "./types.js";

/**
 * Interface for saved config file format - вложенная структура
 */
interface ConfigNode {
	name: string;
	path: string;
	isDirectory: boolean;
	selected: boolean;
	expanded: boolean;
	children?: ConfigNode[];
}

interface R2XConfig {
	version: string;
	nodes: ConfigNode[];
}

/**
 * Global cache for stat results
 */
const statCache = new Map<string, { size?: number | bigint; mtime?: Date; isDirectory: boolean }>();

/**
 * System directories and files that should always be excluded
 */
const SYSTEM_EXCLUDES = new Set([
	".git",
	".svn",
	".hg",
	".DS_Store",
	"Thumbs.db",
	"node_modules",
	"dist",
	"build",
	".next",
	".cache",
	".vite",
	".turbo",
	"coverage",
	".nyc_output",
	".idea",
	".vscode",
	".vs",
	".r2x",
	".r2x_ignore",
]);

/**
 * Binary file extensions that should always be excluded
 */
const BINARY_EXTENSIONS = new Set([
	".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg", ".webp", ".ico", ".tiff", ".tif",
	".psd", ".ai", ".eps", ".raw", ".cr2", ".nef", ".orf", ".sr2", ".heic", ".heif", ".avif",
	".mp4", ".avi", ".mov", ".wmv", ".flv", ".webm", ".mkv", ".m4v", ".3gp", ".mpg", ".mpeg",
	".vob", ".ogv", ".mts", ".m2ts",
	".mp3", ".wav", ".flac", ".aac", ".ogg", ".wma", ".m4a", ".opus", ".amr", ".aiff",
	".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz", ".cab", ".deb", ".rpm", ".dmg",
	".iso", ".apk", ".exe", ".msi",
	".ttf", ".otf", ".woff", ".woff2", ".eot",
	".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods", ".odp",
]);

const PRIVATE_FILE_PATTERNS = [
	/^\.env$/, /^\.env\./, /\.secret$/, /\.key$/, /\.pem$/, /\.p12$/, /\.pfx$/,
	/\.crt$/, /\.cer$/, /\.der$/, /\.jks$/, /\.keystore$/, /\.private$/, /\.credentials$/,
	/id_rsa$/, /id_dsa$/, /id_ecdsa$/, /id_ed25519$/, /config\.local/, /secrets/,
];

/**
 * Преобразует FileNode в ConfigNode для сохранения
 */
function fileNodeToConfigNode(node: FileNode, uiState: Map<string, UIState>): ConfigNode {
	const state = uiState.get(node.path) || { selected: false, expanded: false };
	const configNode: ConfigNode = {
		name: node.name,
		path: node.path,
		isDirectory: node.isDirectory,
		selected: state.selected,
		expanded: state.expanded,
	};

	if (node.isDirectory && node.children.length > 0) {
		configNode.children = node.children.map((child) =>
			fileNodeToConfigNode(child, uiState),
		);
	}

	return configNode;
}

/**
 * Преобразует ConfigNode в FileNode и заполняет uiState
 */
function configNodeToFileNode(configNode: ConfigNode, uiState: Map<string, UIState>): FileNode {
	uiState.set(configNode.path, {
		selected: configNode.selected,
		expanded: configNode.expanded ?? false,
	});

	const node: FileNode = {
		name: configNode.name,
		path: configNode.path,
		isDirectory: configNode.isDirectory,
		children: configNode.children
			? configNode.children.map((child) => configNodeToFileNode(child, uiState))
			: [],
	};

	return node;
}

/**
 * Основной класс для работы с репозиторием
 * Хранит структуру файлов и состояние UI
 * Использует события для уведомления об изменениях
 */
export class RepositoryTree extends EventEmitter {
	public nodes: FileNode[] = [];
	public uiState: Map<string, UIState> = new Map();
	private pendingState: Map<string, UIState> = new Map(); // State for paths not yet scanned
	public readonly rootPath: string;
	public readonly gitignoreContent: string;
	private readonly ig: ReturnType<typeof ignore>;

	constructor(rootPath: string, gitignoreContent: string = "") {
		super();
		this.rootPath = rootPath;
		this.gitignoreContent = gitignoreContent;
		this.ig = ignore();
		if (gitignoreContent) {
			this.ig.add(gitignoreContent);
		}
	}

	/**
	 * Проверяет, выбран ли узел
	 */
	isSelected(path: string): boolean {
		const state = this.uiState.get(path);
		return state?.selected ?? false;
	}

	/**
	 * Проверяет, раскрыт ли узел
	 */
	isExpanded(path: string): boolean {
		const state = this.uiState.get(path);
		return state?.expanded ?? false;
	}

	/**
	 * Получает состояние узла
	 */
	getNodeState(path: string): UIState | undefined {
		return this.uiState.get(path);
	}

	/**
	 * Получает все состояние
	 */
	getState(): Map<string, UIState> {
		const mergedState = new Map<string, UIState>(this.uiState);
		for (const [path, state] of this.pendingState.entries()) {
			if (!mergedState.has(path)) {
				mergedState.set(path, state);
			}
		}
		return mergedState;
	}

	/**
	 * Переключает выбор узла
	 */
	toggleSelection(node: FileNode): void {
		const state = this.uiState.get(node.path) || {
			selected: false,
			expanded: false,
		};

		state.selected = !state.selected;
		this.uiState.set(node.path, state);
		this.emit("state-changed", node.path);

		if (node.isDirectory) {
			this.toggleChildrenSelection(node, state.selected);
		}
	}

	/**
	 * Переключает выбор дочерних узлов
	 */
	private toggleChildrenSelection(node: FileNode, selected: boolean): void {
		const state = this.uiState.get(node.path) || {
			selected: false,
			expanded: false,
		};
		state.selected = selected;
		this.uiState.set(node.path, state);

		if (node.isDirectory) {
			for (const child of node.children) {
				this.toggleChildrenSelection(child, selected);
			}
		}
	}

	/**
	 * Устанавливает состояние раскрытия узла
	 */
	setExpanded(node: FileNode, expanded: boolean): void {
		const state = this.uiState.get(node.path) || {
			selected: false,
			expanded: false,
		};
		state.expanded = expanded;
		this.uiState.set(node.path, state);
		this.emit("state-changed", node.path);
	}

	/**
	 * Приватный метод: синхронизирует состояние для дочерних узлов после сканирования
	 * Вызывается автоматически при сканировании, не должен вызываться извне
	 */
	private syncStateForChildren(children: FileNode[]): void {
		for (const child of children) {
			const normalizedPath = child.path.replace(/^\.\//, "");
			const isIgnored =
				this.ig.ignores(normalizedPath) || this.ig.ignores(normalizedPath + "/");

			const pendingState = this.pendingState.get(child.path);

			if (pendingState) {
				this.uiState.set(child.path, {
					selected: pendingState.selected,
					expanded: pendingState.expanded,
				});
				this.pendingState.delete(child.path);
			} else {
				const selected = !isIgnored;
				const existingState = this.uiState.get(child.path);
				this.uiState.set(child.path, {
					selected,
					expanded: existingState?.expanded ?? false,
				});
			}

			if (child.isDirectory && child.children.length > 0) {
				this.syncStateForChildren(child.children);
			}
		}
		this.emit("nodes-scanned");
	}

	/**
	 * Загружает сохраненное состояние из .r2x файла
	 */
	async load(): Promise<boolean> {
		const configPath = path.join(this.rootPath, ".r2x");
		if (!existsSync(configPath)) {
			return false;
		}

		try {
			const content = await readFile(configPath, "utf-8");
			const config: R2XConfig = JSON.parse(content);

			if (!config.nodes || !Array.isArray(config.nodes)) {
				return false;
			}

			// Проверяем, что это актуальный формат конфига (с isDirectory)
			const hasOldFormat = config.nodes.some(node => node.isDirectory === undefined);
			if (hasOldFormat) {
				// Старый конфиг - удаляем его и возвращаем false
				await unlink(configPath);
				return false;
			}

			this.nodes = [];
			this.uiState = new Map();

			for (const configNode of config.nodes) {
				if (typeof configNode.isDirectory !== "boolean") {
					// Некорректный формат - пропускаем этот узел
					continue;
				}
				this.nodes.push(configNodeToFileNode(configNode, this.uiState));
			}

			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Сохраняет текущее состояние в .r2x файл
	 */
	async save(): Promise<void> {
		const configPath = path.join(this.rootPath, ".r2x");

		try {
			const configNodes = this.nodes.map((node) => fileNodeToConfigNode(node, this.uiState));

			const config: R2XConfig = {
				version: "1.0",
				nodes: configNodes,
			};

			await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error(`Warning: Failed to save .r2x config: ${errorMessage}`);
		}
	}

	/**
	 * Инициализирует дерево файлов, если оно еще не загружено
	 */
	async initialize(): Promise<void> {
		if (this.nodes.length > 0) {
			return; // Уже инициализировано
		}

		this.nodes = await this.scan(this.rootPath, ".", false);

		// Инициализируем состояние UI на основе .gitignore
		const traverse = (fileNodes: FileNode[]): void => {
			for (const node of fileNodes) {
				const normalizedPath = node.path.replace(/^\.\//, "");
				const isIgnored =
					this.ig.ignores(normalizedPath) || this.ig.ignores(normalizedPath + "/");
				const selected = !isIgnored;

				this.uiState.set(node.path, {
					selected,
					expanded: false,
				});

				if (node.isDirectory) {
					traverse(node.children);
				}
			}
		};

		traverse(this.nodes);
	}

	/**
	 * Сканирует директорию и возвращает список узлов
	 */
	private async scan(
		dirPath: string,
		relativePath: string,
		recursive: boolean = false,
	): Promise<FileNode[]> {
		const nodes: FileNode[] = [];

		try {
			const entries = await readdir(dirPath);

			for (const entry of entries) {
				if (SYSTEM_EXCLUDES.has(entry)) {
					continue;
				}

				const fullPath = path.join(dirPath, entry);
				const relPath = path.join(relativePath, entry);

				const normalizedRelPath = relPath.replace(/^\.\//, "");
				if (
					this.ig.ignores(normalizedRelPath) ||
					this.ig.ignores(normalizedRelPath + "/")
				) {
					continue;
				}

				const cachedStat = statCache.get(fullPath);
				let stats: Awaited<ReturnType<typeof stat>>;

				if (cachedStat) {
					const cachedSize = cachedStat.size;
					stats = {
						isDirectory: () => cachedStat.isDirectory,
						size: typeof cachedSize === "bigint" ? cachedSize : (cachedSize ?? 0),
						mtime: cachedStat.mtime ?? new Date(),
					} as Awaited<ReturnType<typeof stat>>;
				} else {
					stats = await stat(fullPath);
					statCache.set(fullPath, {
						isDirectory: stats.isDirectory(),
						size: stats.size,
						mtime: stats.mtime,
					});
				}

				if (stats.isDirectory()) {
					const node: FileNode = {
						name: entry,
						path: relPath,
						isDirectory: true,
						children: recursive ? await this.scan(fullPath, relPath, true) : [],
					};
					nodes.push(node);
				} else {
				if (this.isBinaryFile(entry) || this.isPrivateFile(entry)) {
					continue;
				}

					const node: FileNode = {
						name: entry,
						path: relPath,
						isDirectory: false,
						children: [],
						size:
							typeof stats.size === "bigint" ? Number(stats.size) : stats.size,
						mtime: stats.mtime,
					};
					nodes.push(node);
				}
			}
		} catch (error: unknown) {
			if (error instanceof Error && "code" in error) {
				const nodeError = error as NodeJS.ErrnoException;
				if (nodeError.code !== "EACCES" && nodeError.code !== "EPERM") {
					console.error(
						`\nError reading directory ${dirPath}: ${error.message}`,
					);
				}
			}
		}

		return nodes.sort(this.sortNodes);
	}

	/**
	 * Сканирует указанную директорию
	 */
	async scanDirectory(node: FileNode): Promise<void> {
		if (!node.isDirectory || node.children.length > 0) {
			return;
		}

		const fullPath = path.join(this.rootPath, node.path);
		node.children = await this.scan(fullPath, node.path, false);
		node.children.sort(this.sortNodes);

		// Синхронизируем состояние для новых детей
		this.syncStateForChildren(node.children);
	}

	/**
	 * Рекурсивно сканирует все директории
	 */
	async scanAllDirectories(): Promise<void> {
		for (const node of this.nodes) {
			if (node.isDirectory) {
				if (node.children.length === 0) {
					await this.scanDirectory(node);
				}
				await this.scanAllDirectoriesRecursive(node.children);
			}
		}
	}

	/**
	 * Рекурсивно сканирует все выбранные директории и их содержимое
	 * Сканирует даже если папка свернута
	 */
	async scanSelectedDirectories(): Promise<void> {
		const scanNode = async (node: FileNode): Promise<void> => {
			if (!node.isDirectory) {
				return;
			}

			const state = this.uiState.get(node.path);
			if (!state?.selected) {
				return;
			}

			// Сканируем папку, если она еще не отсканирована
			if (node.children.length === 0) {
				await this.scanDirectory(node);
			}

			// Рекурсивно сканируем всех детей
			for (const child of node.children) {
				await scanNode(child);
			}
		};

		for (const node of this.nodes) {
			await scanNode(node);
		}
	}

	private async scanAllDirectoriesRecursive(nodes: FileNode[]): Promise<void> {
		for (const node of nodes) {
			if (node.isDirectory) {
				if (node.children.length === 0) {
					await this.scanDirectory(node);
				}
				await this.scanAllDirectoriesRecursive(node.children);
			}
		}
	}

	/**
	 * Возвращает список выбранных файлов
	 */
	getSelectedFiles(): string[] {
		const files: string[] = [];

		const traverse = (nodes: FileNode[]) => {
			for (const node of nodes) {
				const state = this.uiState.get(node.path);
				if (state?.selected) {
					if (!node.isDirectory) {
						files.push(node.path);
					} else {
						traverse(node.children);
					}
				}
			}
		};

		traverse(this.nodes);
		return files;
	}

	/**
	 * Возвращает текстовое представление дерева
	 */
	getTreeStructure(): string {
		const lines: string[] = [];

		const hasSelectedDescendants = (node: FileNode): boolean => {
			if (!node.isDirectory) {
				return false;
			}
			return node.children.some((child) => {
				const childState = this.uiState.get(child.path);
				return (childState?.selected ?? false) || hasSelectedDescendants(child);
			});
		};

		const traverse = (nodes: FileNode[], prefix: string = "") => {
			const visibleNodes = nodes.filter((node) => {
				const state = this.uiState.get(node.path);
				const isSelected = state?.selected ?? false;
				return isSelected || (node.isDirectory && hasSelectedDescendants(node));
			});

			for (let i = 0; i < visibleNodes.length; i++) {
				const node = visibleNodes[i];
				const isLastItem = i === visibleNodes.length - 1;
				const currentPrefix = isLastItem ? "└── " : "├── ";
				const nextPrefix = isLastItem ? "    " : "│   ";

				const state = this.uiState.get(node.path);
				const marker = (state?.selected ?? false) ? "[✓]" : "[ ]";
				const icon = node.isDirectory ? "▶ " : "";
				lines.push(prefix + currentPrefix + marker + " " + icon + node.name);

				if (node.isDirectory && node.children.length > 0) {
					traverse(node.children, prefix + nextPrefix);
				}
			}
		};

		traverse(this.nodes);
		return lines.join("\n");
	}

	/**
	 * Находит узел по пути
	 */
	findNodeByPath(targetPath: string): FileNode | null {
		const find = (nodes: FileNode[]): FileNode | null => {
			for (const node of nodes) {
				if (node.path === targetPath) {
					return node;
				}
				if (node.isDirectory && node.children.length > 0) {
					const found = find(node.children);
					if (found) return found;
				}
			}
			return null;
		};

		return find(this.nodes);
	}

	/**
	 * Приватные вспомогательные методы
	 */
	private isBinaryFile(filename: string): boolean {
		return BINARY_EXTENSIONS.has(path.extname(filename).toLowerCase());
	}

	private isPrivateFile(filename: string): boolean {
		return PRIVATE_FILE_PATTERNS.some((pattern) => pattern.test(filename.toLowerCase()));
	}

	private sortNodes(a: FileNode, b: FileNode): number {
		if (a.isDirectory && !b.isDirectory) return -1;
		if (!a.isDirectory && b.isDirectory) return 1;
		return a.name.localeCompare(b.name);
	}
}

