import React, { useState, useEffect } from "react";
import type { FileNode } from "../../src/types";
import { scanDirectory, updateState } from "../api";

interface FileTreeProps {
	nodes: FileNode[];
	setNodes: (nodes: FileNode[]) => void;
	onFileSelect: (path: string | null) => void;
}

export function FileTree({ nodes, setNodes, onFileSelect }: FileTreeProps) {
	const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
	const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

	// Load initial state
	useEffect(() => {
		fetch("/api/state")
			.then((res) => res.json())
			.then((data: { state: Record<string, { selected: boolean; expanded: boolean }> }) => {
				const expanded = new Set<string>();
				const selected = new Set<string>();
				for (const [path, state] of Object.entries(data.state)) {
					if (state.expanded) expanded.add(path);
					if (state.selected) selected.add(path);
				}
				setExpandedPaths(expanded);
				setSelectedPaths(selected);
			})
			.catch((error) => {
				console.error("Failed to load state:", error);
			});
	}, []);

	const handleToggleExpand = async (node: FileNode) => {
		const isExpanded = expandedPaths.has(node.path);
		const newExpanded = new Set(expandedPaths);
		const isParentSelected = selectedPaths.has(node.path);

		if (!isExpanded) {
			// Expand
			newExpanded.add(node.path);
			if (node.children.length === 0 && node.isDirectory) {
				// Need to scan directory
				try {
					const result = await scanDirectory(node.path);
					// Update node children
					const updateNode = (n: FileNode): FileNode => {
						if (n.path === node.path) {
							return { ...n, children: result.children };
						}
						return { ...n, children: n.children.map(updateNode) };
					};
					const updatedNodes = nodes.map(updateNode);
					setNodes(updatedNodes);
					
					// If parent is selected, select all children
					if (isParentSelected) {
						const newSelected = new Set(selectedPaths);
						for (const child of result.children) {
							newSelected.add(child.path);
							await updateState(child.path, true, undefined);
						}
						setSelectedPaths(newSelected);
					}
				} catch (error) {
					console.error("Failed to scan directory:", error);
				}
			} else if (isParentSelected && node.children.length > 0) {
				// Already scanned, select all children if parent is selected
				const newSelected = new Set(selectedPaths);
				for (const child of node.children) {
					if (!newSelected.has(child.path)) {
						newSelected.add(child.path);
						await updateState(child.path, true, undefined);
					}
				}
				setSelectedPaths(newSelected);
			}
		} else {
			// Collapse
			newExpanded.delete(node.path);
		}

		setExpandedPaths(newExpanded);
		await updateState(node.path, undefined, !isExpanded);
	};

	const toggleChildrenRecursive = async (
		node: FileNode,
		select: boolean,
		newSelected: Set<string>,
	) => {
		// Toggle current node
		if (select) {
			newSelected.add(node.path);
		} else {
			newSelected.delete(node.path);
		}
		await updateState(node.path, select, undefined);

		// Recursively toggle all children
		if (node.isDirectory) {
			// If children are not loaded, scan them first
			if (node.children.length === 0 && !expandedPaths.has(node.path)) {
				try {
					const result = await scanDirectory(node.path);
					// Update node children
					const updateNode = (n: FileNode): FileNode => {
						if (n.path === node.path) {
							return { ...n, children: result.children };
						}
						return { ...n, children: n.children.map(updateNode) };
					};
					const updatedNodes = nodes.map(updateNode);
					setNodes(updatedNodes);
					
					// Process scanned children
					for (const child of result.children) {
						await toggleChildrenRecursive(child, select, newSelected);
					}
				} catch (error) {
					console.error("Failed to scan directory:", error);
				}
			} else {
				// Process existing children
				for (const child of node.children) {
					await toggleChildrenRecursive(child, select, newSelected);
				}
			}
		}
	};

	const handleToggleSelect = async (node: FileNode) => {
		const isSelected = selectedPaths.has(node.path);
		const newSelected = new Set(selectedPaths);
		const shouldSelect = !isSelected;

		// Toggle this node and all its children recursively
		await toggleChildrenRecursive(node, shouldSelect, newSelected);

		setSelectedPaths(newSelected);
	};

	const renderNode = (node: FileNode, depth: number = 0) => {
		const isExpanded = expandedPaths.has(node.path);
		const isSelected = selectedPaths.has(node.path);
		const hasChildren = node.isDirectory && node.children.length > 0;

		return (
			<div key={node.path}>
				<div
					className={`flex items-center px-2 py-1 cursor-pointer select-none hover:bg-gray-100 ${isSelected ? "bg-blue-50" : ""}`}
					style={{ paddingLeft: `${depth * 16 + 8}px` }}
				>
					<input
						type="checkbox"
						className="mr-2 cursor-pointer"
						checked={isSelected}
						onChange={() => handleToggleSelect(node)}
						onClick={(e) => e.stopPropagation()}
					/>
					<span
						className={`mr-1 text-sm ${node.isDirectory ? "cursor-pointer" : ""}`}
						onClick={() => {
							if (node.isDirectory) {
								handleToggleExpand(node);
							}
						}}
					>
						{node.isDirectory ? (isExpanded ? "▼" : "▶") : "●"}
					</span>
					<span
						className="flex-1"
						onClick={() => {
							if (node.isDirectory) {
								handleToggleExpand(node);
							} else {
								onFileSelect(node.path);
							}
						}}
					>
						{node.name}
					</span>
				</div>
				{node.isDirectory && isExpanded && hasChildren && (
					<div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
				)}
			</div>
		);
	};

	return <div className="p-2">{nodes.map((node) => renderNode(node))}</div>;
}

