import type { FileNode, UIState } from "../src/types";

export interface TreeResponse {
	nodes: FileNode[];
	rootPath: string;
}

export interface ScanResponse {
	children: FileNode[];
}

export interface FileResponse {
	content: string;
	language: string;
	size: number;
	truncated: boolean;
}

export interface StateResponse {
	state: Record<string, UIState>;
}

export interface StatsResponse {
	files: number;
	size: number;
	tokens: number;
}

export interface GenerateResponse {
	success: boolean;
	message: string;
	path?: string;
	content?: string;
}

async function fetchAPI<T>(url: string, options?: RequestInit): Promise<T> {
	const response = await fetch(url, options);
	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: "Unknown error" }));
		throw new Error(error.error || `HTTP ${response.status}`);
	}
	return response.json();
}

export async function getTree(): Promise<TreeResponse> {
	return fetchAPI<TreeResponse>("/api/tree");
}

export async function scanDirectory(path: string): Promise<ScanResponse> {
	return fetchAPI<ScanResponse>("/api/scan", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ path }),
	});
}

export async function getFile(filePath: string): Promise<FileResponse> {
	const encodedPath = encodeURIComponent(filePath);
	return fetchAPI<FileResponse>(`/api/file?path=${encodedPath}`);
}

export async function getState(): Promise<StateResponse> {
	return fetchAPI<StateResponse>("/api/state");
}

export async function updateState(
	path: string,
	selected?: boolean,
	expanded?: boolean,
): Promise<StateResponse> {
	return fetchAPI<StateResponse>("/api/state", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ path, selected, expanded }),
	});
}

export async function getStats(): Promise<StatsResponse> {
	return fetchAPI<StatsResponse>("/api/stats");
}

export async function generateMarkdown(options: {
	outputPath?: string;
	clipboard?: boolean;
}): Promise<GenerateResponse> {
	return fetchAPI<GenerateResponse>("/api/generate", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(options),
	});
}

