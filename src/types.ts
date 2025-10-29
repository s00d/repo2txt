// Data model - contains only file system information
export interface FileNode {
	name: string;
	path: string;
	isDirectory: boolean;
	children: FileNode[];
	// File metadata (only for files)
	size?: number; // size in bytes
	mtime?: Date; // modification date
}

// UI state for file tree node
export interface UIState {
	selected: boolean;
	expanded: boolean;
}
