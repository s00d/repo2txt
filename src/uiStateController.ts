import { EventEmitter } from "events";
import ignore from "ignore";
import type { FileNode, UIState } from "./types.js";

/**
 * Controller for managing file tree UI state
 * Responsible for initialization, modification and synchronization of state
 */
export class UIStateController extends EventEmitter {
	private uiState: Map<string, UIState> = new Map();
	private pendingState: Map<string, UIState> = new Map(); // State for paths not yet scanned
	private gitignoreContent: string;

	constructor(gitignoreContent: string = "") {
		super();
		this.gitignoreContent = gitignoreContent;
	}

	/**
	 * Initializes UI state based on .gitignore
	 */
	public initialize(nodes: FileNode[]): void {
		this.uiState = this.createUIStateFromGitignore(
			nodes,
			this.gitignoreContent,
		);
		this.emit("state-changed");
	}

	/**
	 * Creates UI state based on .gitignore
	 */
	private createUIStateFromGitignore(
		nodes: FileNode[],
		gitignoreContent: string,
	): Map<string, UIState> {
		const uiState = new Map<string, UIState>();
		const ig = ignore();
		if (gitignoreContent) {
			ig.add(gitignoreContent);
		}

		const traverse = (fileNodes: FileNode[]): void => {
			for (const node of fileNodes) {
				const normalizedPath = node.path.replace(/^\.\//, "");
				const isIgnored =
					ig.ignores(normalizedPath) || ig.ignores(normalizedPath + "/");
				// Files not in .gitignore are selected by default
				const selected = !isIgnored;

				uiState.set(node.path, {
					selected,
					expanded: false,
				});

				if (node.isDirectory) {
					traverse(node.children);
				}
			}
		};

		traverse(nodes);
		return uiState;
	}

	/**
	 * Static method to create UI state without creating controller
	 */
	public static createUIState(
		nodes: FileNode[],
		gitignoreContent: string,
	): Map<string, UIState> {
		const controller = new UIStateController(gitignoreContent);
		controller.initialize(nodes);
		return controller.getState();
	}

	/**
	 * Gets node state by path
	 */
	public getNodeState(path: string): UIState | undefined {
		return this.uiState.get(path);
	}

	/**
	 * Gets all state (for external use)
	 * Includes both current state and pending state (for nodes not yet scanned)
	 */
	public getState(): Map<string, UIState> {
		// Merge current state with pending state
		const mergedState = new Map<string, UIState>(this.uiState);
		for (const [path, state] of this.pendingState.entries()) {
			// Add pending state if not already in current state
			if (!mergedState.has(path)) {
				mergedState.set(path, state);
			}
		}
		return mergedState;
	}

	/**
	 * Sets state for node
	 */
	private setState(path: string, state: UIState): void {
		this.uiState.set(path, state);
		this.emit("state-changed", path);
	}

	/**
	 * Toggles node selection
	 */
	public toggleSelection(node: FileNode): void {
		const state = this.uiState.get(node.path) || {
			selected: false,
			expanded: false,
		};

		state.selected = !state.selected;
		this.setState(node.path, state);

		if (node.isDirectory) {
			this.toggleChildrenSelection(node, state.selected);
		}
	}

	/**
	 * Toggles selection of child nodes
	 */
	public toggleChildrenSelection(node: FileNode, selected: boolean): void {
		const state = this.uiState.get(node.path) || {
			selected: false,
			expanded: false,
		};
		state.selected = selected;
		this.setState(node.path, state);

		if (node.isDirectory) {
			for (const child of node.children) {
				this.toggleChildrenSelection(child, selected);
			}
		}
	}

	/**
	 * Sets expanded state for node
	 */
	public setExpanded(node: FileNode, expanded: boolean): void {
		const state = this.uiState.get(node.path) || {
			selected: false,
			expanded: false,
		};
		state.expanded = expanded;
		this.setState(node.path, state);
	}

	/**
	 * Checks if node is selected
	 */
	public isSelected(path: string): boolean {
		const state = this.uiState.get(path);
		return state?.selected ?? false;
	}

	/**
	 * Checks if node is expanded
	 */
	public isExpanded(path: string): boolean {
		const state = this.uiState.get(path);
		return state?.expanded ?? false;
	}

	/**
	 * Synchronizes UI state for child nodes after scanning
	 */
	public syncUIStateForChildren(children: FileNode[]): void {
		const ig = ignore();
		if (this.gitignoreContent) {
			ig.add(this.gitignoreContent);
		}

		for (const child of children) {
			const normalizedPath = child.path.replace(/^\.\//, "");
			const isIgnored =
				ig.ignores(normalizedPath) || ig.ignores(normalizedPath + "/");
			
			// Check if there's pending state for this path
			const pendingState = this.pendingState.get(child.path);
			
			if (pendingState) {
				// Apply saved state for this path
				this.setState(child.path, {
					selected: pendingState.selected,
					expanded: pendingState.expanded,
				});
				// Remove from pending
				this.pendingState.delete(child.path);
			} else {
				// Use default selection based on gitignore
				const selected = !isIgnored;
				// Save expanded state if it was already set
				const existingState = this.uiState.get(child.path);
				this.setState(child.path, {
					selected,
					expanded: existingState?.expanded ?? false,
				});
			}

			if (child.isDirectory && child.children.length > 0) {
				this.syncUIStateForChildren(child.children);
			}
		}
	}

	/**
	 * Updates state for all nodes (including newly scanned)
	 */
	public updateStateForAllNodes(nodes: FileNode[]): void {
		const ig = ignore();
		if (this.gitignoreContent) {
			ig.add(this.gitignoreContent);
		}

		const traverse = (fileNodes: FileNode[]): void => {
			for (const node of fileNodes) {
				// If state is not set for this node yet, check for pending state first
				if (!this.uiState.has(node.path)) {
					const pendingState = this.pendingState.get(node.path);
					
					if (pendingState) {
						// Apply saved state
						this.setState(node.path, {
							selected: pendingState.selected,
							expanded: pendingState.expanded,
						});
						// Remove from pending
						this.pendingState.delete(node.path);
					} else {
						// Use default based on gitignore
						const normalizedPath = node.path.replace(/^\.\//, "");
						const isIgnored =
							ig.ignores(normalizedPath) || ig.ignores(normalizedPath + "/");
						const selected = !isIgnored;

						this.setState(node.path, {
							selected,
							expanded: false,
						});
					}
				}

				if (node.isDirectory && node.children.length > 0) {
					traverse(node.children);
				}
			}
		};

		traverse(nodes);
	}

	/**
	 * Loads saved state from config file, merging with existing state
	 * Applies state for paths that exist in current file tree,
	 * and saves state for paths not yet scanned to apply later
	 * @param savedState Map of saved UI state from config file
	 * @param nodes Current file tree nodes to check which paths exist
	 */
	public loadState(
		savedState: Map<string, UIState>,
		nodes: FileNode[],
	): void {
		// Build set of existing paths from file tree
		const existingPaths = new Set<string>();
		const traverse = (fileNodes: FileNode[]): void => {
			for (const node of fileNodes) {
				existingPaths.add(node.path);
				if (node.isDirectory && node.children.length > 0) {
					traverse(node.children);
				}
			}
		};
		traverse(nodes);

		// Merge saved state for paths that exist in current tree
		for (const [path, savedStateValue] of savedState.entries()) {
			if (existingPaths.has(path) && this.uiState.has(path)) {
				// Update existing state with saved values
				const currentState = this.uiState.get(path);
				if (currentState) {
					currentState.selected = savedStateValue.selected;
					currentState.expanded = savedStateValue.expanded;
					this.setState(path, currentState);
				}
			} else if (!existingPaths.has(path)) {
				// Save state for paths not yet scanned - will be applied when scanned
				this.pendingState.set(path, savedStateValue);
			}
		}

		this.emit("state-changed");
	}
}
