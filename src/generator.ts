import chalk from "chalk";
import { createWriteStream } from "fs";
import { readFile, stat } from "fs/promises";
import * as path from "path";
import { encode } from "gpt-tokenizer";
import { UIStateController } from "./uiStateController.js";
import {
	getSelectedFiles,
	getTreeStructure,
	scanAllDirectories,
} from "./fileTree.js";
import type { FileNode, UIState } from "./types.js";

export function getLanguageByExtension(filePath: string): string {
	const fileName = path.basename(filePath);

	// Check by full filename for files without extensions
	const specialFiles: Record<string, string> = {
		Dockerfile: "dockerfile",
		Makefile: "makefile",
		LICENSE: "text",
		README: "markdown",
		CHANGELOG: "markdown",
		".gitignore": "gitignore",
		".gitattributes": "gitattributes",
		".env": "dotenv",
		".env.example": "dotenv",
		"docker-compose.yml": "yaml",
		"docker-compose.yaml": "yaml",
	};

	if (specialFiles[fileName]) {
		return specialFiles[fileName];
	}

	const ext = path.extname(filePath).toLowerCase();
	const languageMap: Record<string, string> = {
		".ts": "typescript",
		".js": "javascript",
		".tsx": "tsx",
		".jsx": "jsx",
		".json": "json",
		".md": "markdown",
		".yml": "yaml",
		".yaml": "yaml",
		".xml": "xml",
		".html": "html",
		".css": "css",
		".scss": "scss",
		".sass": "sass",
		".less": "less",
		".py": "python",
		".java": "java",
		".cpp": "cpp",
		".c": "c",
		".h": "c",
		".hpp": "cpp",
		".rs": "rust",
		".go": "go",
		".php": "php",
		".rb": "ruby",
		".sh": "bash",
		".bash": "bash",
		".zsh": "bash",
		".sql": "sql",
		".vue": "vue",
		".svelte": "svelte",
		".toml": "toml",
		".ini": "ini",
		".conf": "conf",
		".config": "conf",
	};

	return languageMap[ext] || "text";
}

/**
 * Recursively updates UI state for all nodes (including newly scanned)
 */
function updateUIStateForAllNodes(
	nodes: FileNode[],
	uiState: Map<string, UIState>,
	gitignoreContent: string,
): void {
	// Use UIStateController to update state
	const controller = new UIStateController(gitignoreContent);
	// Fill controller with existing state
	for (const [path, state] of uiState.entries()) {
		controller.getState().set(path, state);
	}
	controller.updateStateForAllNodes(nodes);
	// Copy updated state back
	for (const [path, state] of controller.getState().entries()) {
		uiState.set(path, state);
	}
}

/**
 * Interface for Markdown generation data
 */
export interface MarkdownData {
	selectedFiles: string[];
	treeStructure: string;
}

/**
 * Interface for generation statistics
 */
export interface GenerationStats {
	files: number;
	size: number;
	tokens: number;
}

/**
 * Prepares data for Markdown generation
 * Scans all directories and returns lists of selected files and tree structure
 */
export async function prepareMarkdownData(
	nodes: FileNode[],
	rootPath: string,
	uiState: Map<string, UIState>,
	gitignoreContent?: string,
): Promise<MarkdownData> {
	// Scan all directories to generate full structure
	await scanAllDirectories(rootPath, nodes, gitignoreContent);

	// Update UI state for all newly scanned nodes
	updateUIStateForAllNodes(nodes, uiState, gitignoreContent || "");

	const selectedFiles = getSelectedFiles(nodes, uiState);
	const treeStructure = getTreeStructure(nodes, uiState);

	return {
		selectedFiles,
		treeStructure,
	};
}

/**
 * Formats file size in human-readable form
 */
function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
	if (bytes < 1024 * 1024 * 1024)
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Formats token count
 */
function formatTokenCount(tokens: number): string {
	if (tokens < 1000) return `${tokens}`;
	if (tokens < 1000000) return `~${(tokens / 1000).toFixed(1)}k`;
	return `~${(tokens / 1000000).toFixed(2)}M`;
}

/**
 * Writes Markdown data to stream or returns string
 * Returns generation statistics
 */
export async function writeMarkdown(
	data: MarkdownData,
	rootPath: string,
	outputPath: string | null,
): Promise<{ content: string; stats: GenerationStats }> {
	const { selectedFiles, treeStructure } = data;

	let content = "";

	const writeToContent = (data: string): void => {
		content += data;
	};

	// If outputPath is specified, write to file, otherwise only to string
	const stream = outputPath
		? createWriteStream(outputPath, { encoding: "utf-8" })
		: null;

	// Set error handler once
	let streamError: Error | null = null;
	if (stream) {
		stream.on("error", (error) => {
			streamError = error;
		});
	}

	const writeToStream = async (data: string): Promise<void> => {
		writeToContent(data);
		if (stream) {
			if (streamError) {
				throw streamError;
			}
			return new Promise((resolve, reject) => {
				// Check error before write
				if (streamError) {
					reject(streamError);
					return;
				}

				const canContinue = stream.write(data);
				if (canContinue) {
					resolve();
				} else {
					stream.once("drain", () => {
						if (streamError) {
							reject(streamError);
						} else {
							resolve();
						}
					});
				}
			});
		}
	};

	// Header and structure
	await writeToStream("# Collected Files\n\n");
	await writeToStream("## File Structure\n\n");
	await writeToStream("```\n");
	await writeToStream(treeStructure);
	await writeToStream("\n```\n\n");
	await writeToStream("---\n\n");

	// Initialize statistics
	let fileCount = 0;
	let totalSize = 0;
	let totalTokens = 0;

	// Write files streamingly and collect statistics
	const totalFiles = selectedFiles.length;
	for (let i = 0; i < selectedFiles.length; i++) {
		const filePath = selectedFiles[i];
		const fullPath = path.join(rootPath, filePath);

		// Output information about current file being processed
		const progressMessage =
			chalk.blue(`📝 Processing [${i + 1}/${totalFiles}]: `) +
			chalk.cyan(filePath);
		// Output on same line with overwrite (without ANSI codes for length calculation)
		const plainMessage = `📝 Processing [${i + 1}/${totalFiles}]: ${filePath}`;
		const padding = Math.max(0, 100 - plainMessage.length);
		process.stdout.write(`\r${progressMessage}${" ".repeat(padding)}`);

		try {
			const fileContent = await readFile(fullPath, "utf-8");
			const language = getLanguageByExtension(filePath);
			const codeBlockStart = language ? `\`\`\`${language}` : "```";

			// Calculate statistics
			fileCount++;
			const fileStats = await stat(fullPath);
			totalSize +=
				typeof fileStats.size === "bigint"
					? Number(fileStats.size)
					: fileStats.size;
			totalTokens += encode(fileContent).length;

			await writeToStream(`## ${filePath}\n\n`);
			await writeToStream(codeBlockStart + "\n");
			await writeToStream(fileContent);
			await writeToStream("\n```\n\n");
			await writeToStream("---\n\n");
		} catch {
			await writeToStream(`## ${filePath}\n\n`);
			await writeToStream("*Error reading file*\n\n");
			await writeToStream("---\n\n");
		}
	}

	// Clear progress line
	process.stdout.write("\r" + " ".repeat(80) + "\r");

	const stats: GenerationStats = {
		files: fileCount,
		size: totalSize,
		tokens: totalTokens,
	};

	if (stream) {
		return new Promise<{ content: string; stats: GenerationStats }>(
			(resolve, reject) => {
				if (streamError) {
					reject(streamError);
					return;
				}

				stream.end(() => {
					if (streamError) {
						reject(streamError);
					} else {
						resolve({ content, stats });
					}
				});
			},
		);
	}

	return { content, stats };
}

/**
 * Generates Markdown file from selected files
 * Wrapper over prepareMarkdownData and writeMarkdown for backward compatibility
 */
export async function generateMarkdown(
	nodes: FileNode[],
	rootPath: string,
	outputPath: string | null,
	uiState: Map<string, UIState>,
	gitignoreContent?: string,
): Promise<string> {
	const data = await prepareMarkdownData(
		nodes,
		rootPath,
		uiState,
		gitignoreContent,
	);
	const result = await writeMarkdown(data, rootPath, outputPath);

	// Output statistics to console
	const sizeStr = formatFileSize(result.stats.size);
	const tokenStr = formatTokenCount(result.stats.tokens);
	console.log(chalk.cyan("\n📊 Statistics:"));
	console.log(chalk.white(`   Files: ${chalk.green(result.stats.files)}`));
	console.log(chalk.white(`   Size: ${chalk.yellow(sizeStr)}`));
	console.log(chalk.white(`   Tokens: ${chalk.magenta(tokenStr)}`));

	return result.content;
}
