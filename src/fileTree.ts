import { readdir, stat } from "fs/promises";
import ignore from "ignore";
import * as path from "path";
import type { FileNode, UIState } from "./types.js";

/**
 * Interface for cached stat data
 */
interface StatCache {
	size?: number | bigint;
	mtime?: Date;
	isDirectory: boolean;
}

/**
 * Global cache for stat results
 */
const statCache = new Map<string, StatCache>();

/**
 * Class for scanning file tree with .gitignore logic encapsulation
 */
class FileTreeScanner {
	private readonly ig: ReturnType<typeof ignore>;

	constructor(_rootPath: string, gitignorePatterns?: string) {
		this.ig = ignore();
		if (gitignorePatterns) {
			this.ig.add(gitignorePatterns);
		}
	}

	/**
	 * Scans directory and returns list of nodes
	 * @param dirPath - full path to directory
	 * @param relativePath - relative path for .gitignore check
	 * @param recursive - if false, scans only current level
	 */
	public async scan(
		dirPath: string,
		relativePath: string,
		recursive: boolean = false,
	): Promise<FileNode[]> {
		const nodes: FileNode[] = [];

		try {
			const entries = await readdir(dirPath);

			for (const entry of entries) {
				const fullPath = path.join(dirPath, entry);
				const relPath = path.join(relativePath, entry);

				// Check stat cache
				const cachedStat = statCache.get(fullPath);
				let stats: Awaited<ReturnType<typeof stat>>;

				if (cachedStat) {
					// Use cached data but create object with required interface
					const cachedSize = cachedStat.size;
					stats = {
						isDirectory: () => cachedStat.isDirectory,
						size:
							typeof cachedSize === "bigint" ? cachedSize : (cachedSize ?? 0),
						mtime: cachedStat.mtime ?? new Date(),
					} as Awaited<ReturnType<typeof stat>>;
				} else {
					// Call stat and cache result
					stats = await stat(fullPath);
					statCache.set(fullPath, {
						isDirectory: stats.isDirectory(),
						size: stats.size, // Save as is (may be bigint)
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
			// Ignore only access errors, report others
			if (error instanceof Error && "code" in error) {
				const nodeError = error as NodeJS.ErrnoException;
				if (nodeError.code !== "EACCES" && nodeError.code !== "EPERM") {
					console.error(
						`\nError reading directory ${dirPath}: ${error.message}`,
					);
				}
			} else {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				console.error(`\nError reading directory ${dirPath}: ${errorMessage}`);
			}
		}

		// Sort: directories first, then files, within group - by name
		return nodes.sort(sortNodes);
	}
}

/**
 * Node sorting function: directories before files, within group - by name
 */
export function sortNodes(a: FileNode, b: FileNode): number {
	if (a.isDirectory && !b.isDirectory) return -1;
	if (!a.isDirectory && b.isDirectory) return 1;
	return a.name.localeCompare(b.name);
}

export async function buildFileTree(
	rootPath: string,
	gitignorePatterns?: string,
): Promise<FileNode[]> {
	const scanner = new FileTreeScanner(rootPath, gitignorePatterns);
	// Scan only first level
	return await scanner.scan(rootPath, ".", false);
}

/**
 * Completes scanning of directory (fills children)
 */
export async function scanDirectoryNode(
	rootPath: string,
	node: FileNode,
	gitignorePatterns?: string,
): Promise<void> {
	if (!node.isDirectory || node.children.length > 0) {
		return; // Already scanned or not a directory
	}

	const scanner = new FileTreeScanner(rootPath, gitignorePatterns);
	const fullPath = path.join(rootPath, node.path);

	node.children = await scanner.scan(fullPath, node.path, false);

	// Use common sorting function
	node.children.sort(sortNodes);
}

export function getSelectedFiles(
	nodes: FileNode[],
	uiState: Map<string, UIState>,
): string[] {
	const files: string[] = [];

	function traverse(nodes: FileNode[]) {
		for (const node of nodes) {
			const state = uiState.get(node.path);
			if (state?.selected) {
				if (!node.isDirectory) {
					files.push(node.path);
				} else {
					traverse(node.children);
				}
			}
		}
	}

	traverse(nodes);
	return files;
}

/**
 * Recursively scans all directories in tree to generate full structure
 */
export async function scanAllDirectories(
	rootPath: string,
	nodes: FileNode[],
	gitignorePatterns?: string,
): Promise<void> {
	for (const node of nodes) {
		if (node.isDirectory) {
			// Если папка не сканирована, сканируем её
			if (node.children.length === 0) {
				await scanDirectoryNode(rootPath, node, gitignorePatterns);
			}
			// Рекурсивно сканируем дочерние папки
			await scanAllDirectories(rootPath, node.children, gitignorePatterns);
		}
	}
}

export function getTreeStructure(
	nodes: FileNode[],
	uiState: Map<string, UIState>,
): string {
	const lines: string[] = [];

	// Helper function that checks if directory contains selected elements
	function hasSelectedDescendants(node: FileNode): boolean {
		if (!node.isDirectory) {
			return false;
		}
		// Use .some() for efficiency - stops at first found
		return node.children.some((child) => {
			const childState = uiState.get(child.path);
			return (childState?.selected ?? false) || hasSelectedDescendants(child);
		});
	}

	function traverse(nodes: FileNode[], prefix: string = "") {
		// 1. Filter nodes FIRST. Show node if it's selected or is a directory with selected descendants.
		const visibleNodes = nodes.filter((node) => {
			const state = uiState.get(node.path);
			const isSelected = state?.selected ?? false;
			return isSelected || (node.isDirectory && hasSelectedDescendants(node));
		});

		// 2. Iterate over already FILTERED list.
		for (let i = 0; i < visibleNodes.length; i++) {
			const node = visibleNodes[i];
			const isLastItem = i === visibleNodes.length - 1; // Now isLastItem is always correct
			const currentPrefix = isLastItem ? "└── " : "├── ";
			const nextPrefix = isLastItem ? "    " : "│   ";

			const state = uiState.get(node.path);
			const marker = (state?.selected ?? false) ? "☑" : "☐";
			const icon = node.isDirectory ? "📁" : "📄";
			lines.push(
				prefix + currentPrefix + marker + " " + icon + " " + node.name,
			);

			// 3. Recursive call for child elements
			if (node.isDirectory && node.children.length > 0) {
				traverse(node.children, prefix + nextPrefix); // Recursion will also filter at its level
			}
		}
	}

	traverse(nodes);
	return lines.join("\n");
}
