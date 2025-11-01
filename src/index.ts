import chalk from "chalk";
import clipboardy from "clipboardy";
import { defineCommand } from "citty";
import { readFile, unlink } from "fs/promises";
import { existsSync, readFileSync } from "fs";
import { stat } from "fs/promises";
import * as path from "path";
import { generateMarkdown } from "./generator.js";
import { FileTreeUI } from "./ui.js";
import { startWebServer } from "./ui-web.js";
import { RepositoryTree } from "./repositoryTree.js";

export const main = defineCommand({
	meta: {
		name: "repo2txt",
		version: "1.0.0",
		description: `Console utility to select files and folders with checkboxes and generate markdown

Hotkeys:
  Navigation:
    ↑/↓          - Navigate through the list
    →            - Expand folder
    ←            - Collapse folder

  Selection:
    Space        - Select/deselect file or folder

  Actions:
    Enter        - Apply selection and generate Markdown
    F / p        - Preview selected file
    /            - Search files

  Exit:
    Esc / q      - Cancel and exit`,
	},
	args: {
		directory: {
			type: "string",
			alias: "d",
			description: "Target directory to scan",
			default: process.cwd(),
		},
		output: {
			type: "string",
			alias: "o",
			description: "Output file path",
			default: "output.md",
		},
		"ignore-gitignore": {
			type: "boolean",
			alias: "i",
			description: "Ignore .gitignore",
			default: false,
		},
		exclude: {
			type: "string",
			alias: "e",
			description: "Additional exclusion patterns (can be used multiple times)",
		},
		"skip-ui": {
			type: "boolean",
			alias: "s",
			description:
				"Skip file selection UI and generate markdown directly with default selected files",
			default: false,
		},
		clipboard: {
			type: "boolean",
			alias: "c",
			description: "Copy result to clipboard instead of saving to file",
			default: false,
		},
		preset: {
			type: "string",
			alias: "p",
			description: "Use preset from .repo2txtrc.json",
		},
		ui: {
			type: "boolean",
			alias: "u",
			description: "Launch web interface",
			default: false,
		},
		clean: {
			type: "boolean",
			description: "Delete .r2x config file before running (reset saved state)",
			default: false,
		},
	},
	async run({ args }) {
		const targetDir = path.resolve(args.directory || process.cwd());
		const outputPath = path.resolve(args.output || "output.md");
		const ignoreGitignore = args["ignore-gitignore"] || false;
		const excludePatterns = Array.isArray(args.exclude)
			? args.exclude
			: args.exclude
				? [args.exclude]
				: [];

		// Проверяем существование директории
		try {
			const stats = await stat(targetDir);
			if (!stats?.isDirectory()) {
				console.error(chalk.red(`Error: ${targetDir} is not a directory`));
				process.exit(1);
			}
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error(
				chalk.red(`Error: Directory ${targetDir} not found`),
				errorMessage,
			);
			process.exit(1);
		}

		// Загружаем конфигурацию из .repo2txtrc.json если есть
		let presetConfig: {
			exclude?: string[];
			include?: string[];
			ignoreGitignore?: boolean;
		} | null = null;

		if (args.preset) {
			const configPath = path.join(targetDir, ".repo2txtrc.json");
			try {
				if (existsSync(configPath)) {
				const configContent = readFileSync(configPath, "utf-8");
				const config = JSON.parse(configContent);
				if (config.presets?.[args.preset]) {
					presetConfig = config.presets[args.preset];
					} else {
						console.error(
							chalk.red(
								`Error: Preset "${args.preset}" not found in .repo2txtrc.json`,
							),
						);
						process.exit(1);
					}
				} else {
					console.error(chalk.red(`Error: File .repo2txtrc.json not found`));
					process.exit(1);
				}
			} catch (error: unknown) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				console.error(
					chalk.red(`Error reading .repo2txtrc.json: ${errorMessage}`),
				);
				process.exit(1);
			}
		}

		// Если preset имеет ignoreGitignore, используем его
		const effectiveIgnoreGitignore =
			ignoreGitignore || presetConfig?.ignoreGitignore || false;

		let gitignoreContent = "";
		if (!effectiveIgnoreGitignore) {
			try {
				gitignoreContent = await readFile(
					path.join(targetDir, ".gitignore"),
					"utf-8",
				);
			} catch {
				// .gitignore может отсутствовать
			}
		}

		// Read .r2x_ignore file if it exists
		try {
			const r2xIgnoreContent = await readFile(
				path.join(targetDir, ".r2x_ignore"),
				"utf-8",
			);
			if (r2xIgnoreContent) {
				gitignoreContent += (gitignoreContent ? "\n" : "") + r2xIgnoreContent;
			}
		} catch {
			// .r2x_ignore может отсутствовать
		}

		// Добавляем паттерны из пресета и дополнительные паттерны исключения
		const allExcludePatterns = [
			...(presetConfig?.exclude || []),
			...excludePatterns,
		];

		if (allExcludePatterns.length > 0) {
			gitignoreContent += "\n" + allExcludePatterns.join("\n");
		}

		// Delete .r2x config file if --clean flag is set
		if (args.clean) {
			const configPath = path.join(targetDir, ".r2x");
			if (existsSync(configPath)) {
				await unlink(configPath);
			}
		}

		// Создаем экземпляр RepositoryTree
		const repository = new RepositoryTree(targetDir, gitignoreContent);

		// Пытаемся загрузить сохраненное состояние
		const loaded = await repository.load();

		// Если не загружено, инициализируем новое дерево
		if (!loaded) {
			await repository.initialize();
		}

		// Launch web interface if requested
		if (args.ui) {
			await startWebServer(repository);
			// Server runs indefinitely, don't continue execution
			return;
		}

		// Если указан флаг skip-ui, пропускаем UI и используем файлы, выбранные по умолчанию
		if (args["skip-ui"]) {

			console.log(
				chalk.blue(
					"\n📝 Generating markdown file... (this may take some time)",
				),
			);

			const useClipboard = args.clipboard || false;
			const finalOutputPath = useClipboard ? null : outputPath;

			const markdownContent = await generateMarkdown(
				repository,
				finalOutputPath,
			);

			if (useClipboard) {
				await clipboardy.write(markdownContent);
				console.log(chalk.green(`\n✅ Done! Result copied to clipboard`));
			} else {
				console.log(
					chalk.green(`\n✅ Done! File saved: ${chalk.cyan(outputPath)}`),
				);
			}
			process.exit(0);
		}

		const ui = new FileTreeUI(repository);
		const result = await ui.show();

		// Если пользователь вышел из UI через Esc/q, result будет null
		if (!result) {
			console.log(chalk.yellow("\nOperation cancelled by user."));
			process.exit(0);
		}

		// Обновляем состояние репозитория из результата UI
		if (result) {
			repository.nodes = result.nodes;
			repository.uiState = result.uiState;
		}

		// Сохраняем состояние
		await repository.save();

		console.log(
			chalk.blue("\n📝 Generating markdown file... (this may take some time)"),
		);

		const useClipboard = args.clipboard || false;
		const finalOutputPath = useClipboard ? null : outputPath;

		const markdownContent = await generateMarkdown(
			repository,
			finalOutputPath,
		);

		if (useClipboard) {
			await clipboardy.write(markdownContent);
			console.log(chalk.green(`\n✅ Done! Result copied to clipboard`));
		} else {
			console.log(
				chalk.green(`\n✅ Done! File saved: ${chalk.cyan(outputPath)}`),
			);
		}
		process.exit(0);
	},
});

// Public API exports
export type { FileNode } from "./types.js";
export { FileTreeUI, type UITreeNode } from "./ui.js";
export { RepositoryTree } from "./repositoryTree.js";
export {
	generateMarkdown,
	getLanguageByExtension,
	prepareMarkdownData,
	writeMarkdown,
	type MarkdownData,
} from "./generator.js";
