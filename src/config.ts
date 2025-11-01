import { readFile, writeFile } from "fs/promises";
import * as path from "path";
import type { UIState } from "./types.js";

/**
 * Interface for saved config file format
 */
interface R2XConfig {
	version: string;
	state: Array<{
		path: string;
		selected: boolean;
		expanded: boolean;
	}>;
}

/**
 * Loads UI state from .r2x config file
 * @param targetDir Target directory where .r2x file should be located
 * @returns Map of UI state or null if file doesn't exist or error occurs
 */
export async function loadConfig(
	targetDir: string,
): Promise<Map<string, UIState> | null> {
	const configPath = path.join(targetDir, ".r2x");

	try {
		const content = await readFile(configPath, "utf-8");
		const config: R2XConfig = JSON.parse(content);

		if (!config.state || !Array.isArray(config.state)) {
			return null;
		}

		const uiState = new Map<string, UIState>();
		for (const item of config.state) {
			if (item.path && typeof item.selected === "boolean") {
				uiState.set(item.path, {
					selected: item.selected,
					expanded: item.expanded ?? false,
				});
			}
		}

		return uiState;
	} catch (error) {
		// File doesn't exist or invalid format - return null silently
		// Config loading is optional, so we don't throw errors
		return null;
	}
}

/**
 * Saves UI state to .r2x config file
 * @param targetDir Target directory where .r2x file should be saved
 * @param uiState Map of UI state to save
 */
export async function saveConfig(
	targetDir: string,
	uiState: Map<string, UIState>,
): Promise<void> {
	const configPath = path.join(targetDir, ".r2x");

	try {
		const stateArray: Array<{
			path: string;
			selected: boolean;
			expanded: boolean;
		}> = [];

		for (const [path, state] of uiState.entries()) {
			stateArray.push({
				path,
				selected: state.selected,
				expanded: state.expanded,
			});
		}

		const config: R2XConfig = {
			version: "1.0",
			state: stateArray,
		};

		await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
	} catch (error) {
		// Log error but don't fail the application
		// Config saving is optional
		const errorMessage =
			error instanceof Error ? error.message : String(error);
		console.error(`Warning: Failed to save .r2x config: ${errorMessage}`);
	}
}

