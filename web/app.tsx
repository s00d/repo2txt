import React, { useState, useEffect } from "react";
import { FileTree } from "./components/FileTree";
import { FilePreview } from "./components/FilePreview";
import { StatsPanel } from "./components/StatsPanel";
import { Toolbar } from "./components/Toolbar";
import type { FileNode } from "../src/types";

export function App() {
	const [nodes, setNodes] = useState<FileNode[]>([]);
	const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
	const [rootPath, setRootPath] = useState<string>("");

	useEffect(() => {
		// Load initial tree
		fetch("/api/tree")
			.then((res) => res.json())
			.then((data: { nodes: FileNode[]; rootPath: string }) => {
				setNodes(data.nodes);
				setRootPath(data.rootPath);
			})
			.catch((error) => {
				console.error("Failed to load tree:", error);
			});
	}, []);

	return (
		<div className="flex flex-col h-screen">
			<Toolbar />
			<div className="flex flex-1 overflow-hidden">
				<div className="w-3/5 border-r border-gray-200 overflow-y-auto bg-white">
					<FileTree
						nodes={nodes}
						setNodes={setNodes}
						onFileSelect={setSelectedFilePath}
					/>
				</div>
				<div className="w-2/5 overflow-y-auto bg-gray-50">
					<FilePreview filePath={selectedFilePath} rootPath={rootPath} />
				</div>
			</div>
			<StatsPanel />
		</div>
	);
}

