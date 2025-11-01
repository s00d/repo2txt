import blessed from "blessed";
import { EventEmitter } from "events";
import { readFile } from "fs/promises";
import * as path from "path";
import { encode } from "gpt-tokenizer";
import { scanDirectoryNode } from "./fileTree.js";
import type { FileNode, UIState } from "./types.js";
import { UIStateController } from "./uiStateController.js";

export interface UITreeNode {
	node: FileNode;
	line: string; // Ready string for rendering
}

export class FileTreeUI extends EventEmitter {
	private screen: blessed.Widgets.Screen;
	private list: ReturnType<typeof blessed.list>;
	private infoPanel: ReturnType<typeof blessed.box>;
	private searchBox?: ReturnType<typeof blessed.textbox>;
	private nodes: FileNode[];
	private flatList: UITreeNode[] = [];
	private rootPath: string;
	private gitignoreContent: string;
	private stateController: UIStateController;
	private searchQuery: string = "";
	private isSearchMode: boolean = false;
	private tokenCache: Map<string, number> = new Map();

	constructor(
		nodes: FileNode[],
		rootPath: string,
		gitignoreContent: string = "",
		savedState?: Map<string, UIState>,
	) {
		super();
		this.nodes = nodes;
		this.rootPath = rootPath;
		this.gitignoreContent = gitignoreContent;

		// Создаем контроллер состояния
		this.stateController = new UIStateController(gitignoreContent);
		this.stateController.initialize(nodes);

		// Load saved state if provided
		if (savedState) {
			this.stateController.loadState(savedState, nodes);
			// Recursively expand directories that were expanded in saved state
			void this.expandSavedDirectories(nodes, savedState);
		}

		// Подписываемся на изменения состояния
		this.stateController.on("state-changed", () => {
			this.buildFlatList();
			this.refreshUI(this.getSelectedIndex());
		});

		this.screen = blessed.screen({
			smartCSR: true,
			title: "File Selector",
		});

		// Дерево файлов (слева, 60% ширины)
		this.list = blessed.list({
			top: 0,
			left: 0,
			width: "60%",
			height: "100%",
			keys: true,
			vi: true,
			mouse: true,
			scrollable: true,
			alwaysScroll: false,
			tags: true,
			style: {
				selected: {
					bg: "cyan",
					fg: "black",
					bold: true,
					underline: true,
				},
				item: {
					fg: "white",
				},
				scrollbar: {
					bg: "gray",
				},
				border: {
					fg: "green",
				},
			},
			padding: {
				left: 1,
				right: 1,
				top: 0,
				bottom: 0,
			},
			border: {
				type: "line",
			},
			items: [],
		});

		// Обработка клика мыши
		this.list.on("element click", (_el, _mouse) => {
			const currentIndex = this.getSelectedIndex();
			this.toggleSelection(currentIndex);
		});

		// Информационная панель (справа, 40% ширины)
		this.infoPanel = blessed.box({
			top: 0,
			left: "60%",
			width: "40%",
			height: "100%",
			content: "Select a file to view information",
			tags: true,
			scrollable: true,
			alwaysScroll: true,
			style: {
				fg: "white",
				border: {
					fg: "green",
				},
			},
			border: {
				type: "line",
			},
		});

		// Поле поиска (скрыто по умолчанию)
		this.searchBox = blessed.textbox({
			top: "95%",
			left: 0,
			width: "100%",
			height: "5%",
			content: "",
			hidden: true,
			keys: true,
			inputOnFocus: true,
			style: {
				fg: "white",
				bg: "blue",
				border: {
					fg: "yellow",
				},
			},
			border: {
				type: "line",
			},
		});

		this.searchBox.setLabel(" {bold}Search:{/bold} ");

		this.buildFlatList();
		this.refreshUI(this.getSelectedIndex());
		this.setupKeyHandlers();

		// Отслеживаем изменение выбранного элемента
		this.list.on("select item", () => {
			void this.updateInfoPanel(this.getSelectedIndex());
		});

		this.screen.append(this.list);
		this.screen.append(this.infoPanel);
		this.screen.append(this.searchBox);
		this.list.focus();

		// Quit on Escape, q, or Control-C.
		this.screen.key(["escape", "q", "C-c"], () => {
			if (this.isSearchMode) {
				this.exitSearchMode();
			} else {
				this.screen.destroy();
				this.emit("selection-complete", null);
			}
		});

		this.screen.render();
	}

	/**
	 * Static method to create UI state without creating UI components
	 */
	public static createUIState(
		nodes: FileNode[],
		gitignoreContent: string,
	): Map<string, UIState> {
		return UIStateController.createUIState(nodes, gitignoreContent);
	}

	/**
	 * Gets UI state for external use
	 */
	public getUIState(): Map<string, UIState> {
		return this.stateController.getState();
	}

	private buildFlatList(): void {
		this.flatList = [];
		this.flattenNodes(this.nodes, "", true);
	}

	private formatFileSize(bytes?: number): string {
		if (!bytes) return "";
		const units = ["B", "KB", "MB", "GB", "TB"];
		let size = bytes;
		let unitIndex = 0;
		while (size >= 1024 && unitIndex < units.length - 1) {
			size /= 1024;
			unitIndex++;
		}
		return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
	}

	private formatDate(date?: Date): string {
		if (!date) return "";
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return "today";
		if (diffDays === 1) return "yesterday";
		if (diffDays < 7) return `${diffDays} days ago`;
		if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
		if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
		return `${Math.floor(diffDays / 365)} years ago`;
	}

	/**
	 * Formats token count for display
	 */
	private formatTokenCount(tokens: number): string {
		if (tokens === 0) {
			return "";
		}

		if (tokens < 1000) {
			return `, ~${tokens} tokens`;
		}

		if (tokens < 1_000_000) {
			const kTokens = (tokens / 1000).toFixed(1);
			return `, ~${kTokens}k tokens`;
		}

		const mTokens = (tokens / 1_000_000).toFixed(2);
		return `, ~${mTokens}M tokens`;
	}

	/**
	 * Simple fuzzy search - checks if path contains query substring
	 */
	private matchesSearch(node: FileNode, query: string): boolean {
		if (!query) return true;
		const lowerQuery = query.toLowerCase();
		const lowerPath = node.path.toLowerCase();
		const lowerName = node.name.toLowerCase();

		// Проверяем имя и путь
		return lowerName.includes(lowerQuery) || lowerPath.includes(lowerQuery);
	}

	private flattenNodes(
		nodes: FileNode[],
		prefix: string,
		_isLastParent: boolean,
	): void {
		// Фильтруем по поисковому запросу
		const filteredNodes = this.searchQuery
			? nodes.filter((node) => {
					// Если узел соответствует поиску или содержит соответствующий дочерний элемент
					if (this.matchesSearch(node, this.searchQuery)) {
						return true;
					}
					// Для папок проверяем детей
					if (node.isDirectory) {
						const hasMatchingChild = node.children.some((child) =>
							this.matchesSearch(child, this.searchQuery),
						);
						if (hasMatchingChild) {
							return true;
						}
					}
					return false;
				})
			: nodes;

		for (let i = 0; i < filteredNodes.length; i++) {
			const node = filteredNodes[i];
			const isLast = i === filteredNodes.length - 1;

			const treePrefix = isLast ? "└── " : "├── ";

			const isSelected = this.stateController.isSelected(node.path);
			const marker = isSelected
				? "{green-fg}[✓]{/green-fg}"
				: "{gray-fg}[ ]{/gray-fg}";

			let iconAndName: string;
			if (node.isDirectory) {
				const isExpanded = this.stateController.isExpanded(node.path);
				const icon = isExpanded ? "▼" : "▶";
				iconAndName = `{cyan-fg} ${icon} {bold}${node.name}{/bold}{/cyan-fg}`;
			} else {
				iconAndName = `{yellow-fg}{bold}${node.name}{/bold}{/yellow-fg}`;
				const size = this.formatFileSize(node.size);
				const date = this.formatDate(node.mtime);
				const metadata = [size, date].filter(Boolean).join(" • ");
				if (metadata) {
					iconAndName += ` {gray-fg}(${metadata}){/gray-fg}`;
				}
			}

			const line = ` ${prefix}${treePrefix}${marker}${iconAndName}`;
			this.flatList.push({ node, line });

			// Показываем детей, если папка раскрыта или идет поиск
			const isExpanded = this.stateController.isExpanded(node.path);
			if (
				node.isDirectory &&
				(isExpanded || this.searchQuery) &&
				node.children.length > 0
			) {
				const childPrefix = prefix + (isLast ? "    " : "│   ");
				this.flattenNodes(node.children, childPrefix, isLast);
			}
		}
	}

	private getSelectedIndex(): number {
		return (this.list as unknown as { selected: number }).selected ?? 0;
	}

	/**
	 * Unified method for UI update
	 */
	private refreshUI(newIndex: number): void {
		const items = this.flatList.map((item) => item.line);
		this.list.setItems(items);

		const indexToSelect = Math.max(0, Math.min(newIndex, items.length - 1));
		if (items.length > 0) {
			this.list.select(indexToSelect);
			this.list.scrollTo(indexToSelect);
		}

		this.updateInfoPanel(indexToSelect);
		this.screen.render();
	}

	private async updateInfoPanel(index: number): Promise<void> {
		const item = this.flatList[index];
		if (!item) {
			this.infoPanel.setContent("No information");
			return;
		}

		const node = item.node;
		let content = `{bold}{cyan-fg}Name:{/cyan-fg}{/bold} ${node.name}\n`;
		content += `\n`;
		content += `{bold}{cyan-fg}Path:{/cyan-fg}{/bold} ${node.path}\n`;
		content += `\n`;

		if (node.isDirectory) {
			content += `{bold}{cyan-fg}Type:{/cyan-fg}{/bold} Directory\n`;
			content += `\n`;
			content += `{bold}{cyan-fg}Items:{/cyan-fg}{/bold} ${node.children.length}\n`;
			content += `\n`;
		} else {
			content += `{bold}{cyan-fg}Type:{/cyan-fg}{/bold} File\n`;
			content += `\n`;
			content += `{bold}{cyan-fg}Size:{/cyan-fg}{/bold} ${this.formatFileSize(node.size)}\n`;
			content += `\n`;

			// Подсчитываем токены для этого файла
			const filePath = node.path;
			let tokenCount: number | null = null;

			if (this.tokenCache.has(filePath)) {
				tokenCount = this.tokenCache.get(filePath) || 0;
			} else {
				// Асинхронно подсчитываем токены
				try {
					const fullPath = path.join(this.rootPath, filePath);
					const content = await readFile(fullPath, "utf-8");
					tokenCount = encode(content).length;
					this.tokenCache.set(filePath, tokenCount);
				} catch {
					tokenCount = 0;
					this.tokenCache.set(filePath, 0);
				}
			}

			if (tokenCount !== null && tokenCount > 0) {
				const tokenStr = this.formatTokenCount(tokenCount).replace(", ", "");
				content += `{bold}{cyan-fg}Tokens:{/cyan-fg}{/bold} ${tokenStr}\n`;
				content += `\n`;
			}

			if (node.mtime) {
				const dateStr = node.mtime.toLocaleDateString("en-US");
				content += `{bold}{cyan-fg}Modified:{/cyan-fg}{/bold} ${this.formatDate(node.mtime)} (${dateStr})\n`;
				content += `\n`;
			}

			// Preview file (first 20 lines) with separator
			if (node.size && node.size < 100000) {
				try {
					const fullPath = path.join(this.rootPath, node.path);
					const fileContent = await readFile(fullPath, "utf-8");
					const lines = fileContent.split("\n").slice(0, 20);
					content += `{gray-fg}─{/gray-fg}\n`; // Separator
					content += `{bold}{cyan-fg}Preview:{/cyan-fg}{/bold}\n`;
					const previewLines = lines.map((line) => `${line}\n`).join("");
					content += `{gray-fg}${previewLines}${lines.length === 20 ? "... (showing first 20 lines)\n" : ""}{/gray-fg}`;
				} catch {
					content += `{gray-fg}─{/gray-fg}\n`;
					content += `{bold}{cyan-fg}Preview:{/cyan-fg}{/bold} Failed to read file\n`;
				}
			}
		}

		this.infoPanel.setContent(content);
		this.screen.render();
	}

	private enterSearchMode(): void {
		this.isSearchMode = true;
		this.searchBox?.show();
		this.searchBox?.focus();
		this.screen.render();
	}

	private exitSearchMode(): void {
		this.isSearchMode = false;
		this.searchQuery = "";
		this.searchBox?.setValue("");
		this.searchBox?.hide();
		this.list.focus();
		this.buildFlatList();
		this.refreshUI(this.getSelectedIndex());
		this.screen.render();
	}

	private setupKeyHandlers(): void {
		this.list.key("space", () => {
			if (!this.isSearchMode) {
				this.toggleSelection(this.getSelectedIndex());
			}
		});

		this.list.key(["right", "l"], async () => {
			if (!this.isSearchMode) {
				await this.expandNode(this.getSelectedIndex());
			}
		});

		this.list.key(["left", "h"], () => {
			if (!this.isSearchMode) {
				this.collapseNode(this.getSelectedIndex());
			}
		});

		// Предпросмотр файла (F или p)
		this.list.key(["f", "p"], async () => {
			if (!this.isSearchMode) {
				await this.previewFile(this.getSelectedIndex());
			}
		});

		// Поиск
		this.list.key("/", () => {
			if (!this.isSearchMode) {
				this.enterSearchMode();
			}
		});

		this.screen.key(["enter"], () => {
			if (this.isSearchMode) {
				// В режиме поиска - переходим к выбранному файлу
				this.exitSearchMode();
			} else {
				// Обычный режим - применяем выбор
				this.applySelection();
			}
		});

		// Обработка поиска
		if (this.searchBox) {
			this.searchBox.on("submit", () => {
				this.exitSearchMode();
			});

			this.searchBox.on("cancel", () => {
				this.exitSearchMode();
			});

			this.searchBox.on("input", () => {
				const query = this.searchBox?.getValue() || "";
				this.searchQuery = query;
				this.buildFlatList();
				this.refreshUI(0); // Сбрасываем на первый элемент при поиске
			});
		}
	}

	private toggleSelection(index: number): void {
		if (index < 0 || index >= this.flatList.length) {
			return;
		}

		const item = this.flatList[index];
		if (!item) {
			return;
		}

		const targetNode = item.node;
		this.stateController.toggleSelection(targetNode);

		// Очищаем кэш токенов при изменении выбора
		if (!targetNode.isDirectory) {
			this.tokenCache.delete(targetNode.path);
		} else {
			// Для папок очищаем все дочерние файлы из кэша
			const clearCacheForNode = (node: FileNode): void => {
				if (!node.isDirectory) {
					this.tokenCache.delete(node.path);
				} else {
					for (const child of node.children) {
						clearCacheForNode(child);
					}
				}
			};
			clearCacheForNode(targetNode);
		}

		// Находим новый индекс после перерисовки
		this.buildFlatList();
		const newIndex = this.flatList.findIndex(
			(flatItem) => flatItem.node === targetNode,
		);

		this.refreshUI(newIndex >= 0 ? newIndex : index);
	}

	private async toggleNodeExpansion(
		index: number,
		expand: boolean,
	): Promise<void> {
		const item = this.flatList[index];
		if (!item) return;

		const node = item.node;
		if (
			!node.isDirectory ||
			this.stateController.isExpanded(node.path) === expand
		) {
			return;
		}

		if (expand && node.children.length === 0) {
			// Сканируем директорию
			await scanDirectoryNode(this.rootPath, node, this.gitignoreContent);
			// После сканирования нужно обновить состояние для новых детей
			this.stateController.syncUIStateForChildren(node.children);
		}

		this.stateController.setExpanded(node, expand);
		this.buildFlatList();
		this.refreshUI(index);
	}

	private async expandNode(index: number): Promise<void> {
		await this.toggleNodeExpansion(index, true);
	}

	private collapseNode(index: number): void {
		void this.toggleNodeExpansion(index, false);
	}

	/**
	 * Recursively expands directories that were expanded in saved state
	 */
	private async expandSavedDirectories(
		nodes: FileNode[],
		savedState: Map<string, UIState>,
	): Promise<void> {
		for (const node of nodes) {
			const savedNodeState = savedState.get(node.path);
			if (node.isDirectory && savedNodeState?.expanded) {
				// Expand this directory if it was expanded in saved state
				this.stateController.setExpanded(node, true);

				// Scan directory if not already scanned
				if (node.children.length === 0) {
					await scanDirectoryNode(this.rootPath, node, this.gitignoreContent);
					this.stateController.syncUIStateForChildren(node.children);
				}

				// Recursively expand children
				if (node.children.length > 0) {
					await this.expandSavedDirectories(node.children, savedState);
				}
			}
		}
		this.buildFlatList();
		this.refreshUI(this.getSelectedIndex());
	}

	private async previewFile(index: number): Promise<void> {
		const item = this.flatList[index];
		if (!item || item.node.isDirectory) {
			return;
		}

		try {
			const fullPath = path.join(this.rootPath, item.node.path);
			const content = await readFile(fullPath, "utf-8");

			const previewBox = blessed.box({
				top: "10%",
				left: "10%",
				width: "80%",
				height: "80%",
				content: content,
				tags: true,
				scrollable: true,
				alwaysScroll: true,
				keys: true,
				style: {
					fg: "white",
					border: {
						fg: "yellow",
					},
				},
				border: {
					type: "line",
				},
			});

			previewBox.setLabel(` {bold}${item.node.path}{/bold} `);

			previewBox.key(["escape"], () => {
				this.screen.remove(previewBox);
				this.list.focus();
				this.screen.render();
			});

			this.screen.append(previewBox);
			previewBox.focus();
			this.screen.render();
		} catch {
			// Ошибка чтения - игнорируем
		}
	}

	private applySelection(): void {
		this.screen.destroy();
		// Возвращаем nodes и uiState (статистика будет подсчитана во время генерации)
		this.emit("selection-complete", {
			nodes: this.nodes,
			uiState: this.stateController.getState(),
		});
	}

	public show(): Promise<{
		nodes: FileNode[];
		uiState: Map<string, UIState>;
	} | null> {
		return new Promise((resolve) => {
			this.once(
				"selection-complete",
				(data: { nodes: FileNode[]; uiState: Map<string, UIState> } | null) => {
					resolve(data);
				},
			);
		});
	}
}
