import { EventEmitter } from "events";
import ignore from "ignore";
import type { FileNode, UIState } from "./types.js";

/**
 * Controller for managing file tree UI state
 * Responsible for initialization, modification and synchronization of state
 */
export class UIStateController extends EventEmitter {
	private uiState: Map<string, UIState> = new Map();
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
	 */
	public getState(): Map<string, UIState> {
		return this.uiState;
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
			const selected = !isIgnored;

			// Save expanded state if it was already set
			const existingState = this.uiState.get(child.path);
			this.setState(child.path, {
				selected,
				expanded: existingState?.expanded ?? false,
			});

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
				// If state is not set for this node yet, set it
				if (!this.uiState.has(node.path)) {
					const normalizedPath = node.path.replace(/^\.\//, "");
					const isIgnored =
						ig.ignores(normalizedPath) || ig.ignores(normalizedPath + "/");
					const selected = !isIgnored;

					this.setState(node.path, {
						selected,
						expanded: false,
					});
				}

				if (node.isDirectory && node.children.length > 0) {
					traverse(node.children);
				}
			}
		};

		traverse(nodes);
	}
}
