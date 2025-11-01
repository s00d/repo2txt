import React, { useState } from "react";
import { generateMarkdown } from "../api";
import { Modal } from "./Modal";

export function Toolbar() {
	const [outputPath, setOutputPath] = useState<string>("output.md");
	const [clipboard, setClipboard] = useState<boolean>(false);
	const [isGenerating, setIsGenerating] = useState<boolean>(false);
	const [modalOpen, setModalOpen] = useState<boolean>(false);
	const [modalContent, setModalContent] = useState<{
		success: boolean;
		message: string;
		path?: string;
		content?: string;
	} | null>(null);

	const handleGenerate = async () => {
		setIsGenerating(true);
		setModalOpen(false);

		try {
			const result = await generateMarkdown({
				outputPath: clipboard ? undefined : outputPath,
				clipboard,
			});
			setModalContent({
				success: result.success,
				message: result.message,
				path: result.path,
				content: result.content,
			});
			setModalOpen(true);
		} catch (error) {
			setModalContent({
				success: false,
				message:
					error instanceof Error ? error.message : "Failed to generate markdown",
			});
			setModalOpen(true);
		} finally {
			setIsGenerating(false);
		}
	};

	const handleShutdown = async () => {
		try {
			await fetch("/api/shutdown", { method: "POST" });
			// Server will close, show message
			alert("Server is shutting down. This window will close.");
			window.close();
		} catch (error) {
			console.error("Failed to shutdown server:", error);
		}
	};

	return (
		<>
			<div className="flex items-center gap-3 p-3 bg-white border-b border-gray-200">
				<button
					className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
					onClick={handleGenerate}
					disabled={isGenerating}
				>
					{isGenerating ? "Generating..." : "Generate Markdown"}
				</button>
				<input
					type="text"
					className="px-3 py-1.5 border border-gray-300 rounded text-sm disabled:bg-gray-100"
					value={outputPath}
					onChange={(e) => setOutputPath(e.target.value)}
					placeholder="Output file path"
					disabled={clipboard || isGenerating}
				/>
				<label className="flex items-center gap-2 text-sm cursor-pointer">
					<input
						type="checkbox"
						checked={clipboard}
						onChange={(e) => setClipboard(e.target.checked)}
						disabled={isGenerating}
						className="cursor-pointer"
					/>
					Copy to clipboard
				</label>
				<button
					className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm font-medium ml-auto"
					onClick={handleShutdown}
					title="Shutdown server"
				>
					Shutdown
				</button>
			</div>
			<Modal
				isOpen={modalOpen}
				onClose={() => setModalOpen(false)}
				title={modalContent?.success ? "Generated Markdown" : "Error"}
			>
				<div className="text-center">
					{modalContent?.success && modalContent?.content ? (
						<>
							<p className="text-green-600 mb-3">
								{modalContent.message}
							</p>
							{modalContent.path && (
								<p className="mb-3 text-sm text-gray-600">
									File: <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs">{modalContent.path}</code>
								</p>
							)}
							<div className="mb-3">
								<button
									className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
									onClick={async () => {
										if (modalContent?.content) {
											try {
												await navigator.clipboard.writeText(modalContent.content);
												alert("Content copied to clipboard!");
											} catch (error) {
												console.error("Failed to copy:", error);
												alert("Failed to copy to clipboard");
											}
										}
									}}
								>
									Copy to Clipboard
								</button>
							</div>
							<textarea
								readOnly
								value={modalContent.content}
								className="w-full min-h-[300px] max-h-[400px] bg-gray-50 p-3 rounded border border-gray-300 font-mono text-xs leading-relaxed resize-y overflow-auto"
							/>
						</>
					) : (
						<p className="text-red-600">
							{modalContent?.message || "Unknown error occurred"}
						</p>
					)}
				</div>
			</Modal>
		</>
	);
}

