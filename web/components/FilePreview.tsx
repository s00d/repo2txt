import React, { useState, useEffect } from "react";
import { getFile } from "../api";

interface FilePreviewProps {
	filePath: string | null;
	rootPath: string;
}

export function FilePreview({ filePath, rootPath }: FilePreviewProps) {
	const [content, setContent] = useState<string>("");
	const [language, setLanguage] = useState<string>("text");
	const [size, setSize] = useState<number>(0);
	const [truncated, setTruncated] = useState<boolean>(false);
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!filePath) {
			setContent("");
			return;
		}

		setLoading(true);
		setError(null);
		getFile(filePath)
			.then((data) => {
				setContent(data.content);
				setLanguage(data.language);
				setSize(data.size);
				setTruncated(data.truncated);
				setLoading(false);
			})
			.catch((err) => {
				setError(err.message || "Failed to load file");
				setLoading(false);
			});
	}, [filePath]);

	if (!filePath) {
		return (
			<div className="p-4">
				<div className="text-gray-500 text-center">
					Select a file to view its contents
				</div>
			</div>
		);
	}

	if (loading) {
		return (
			<div className="p-4">
				<div className="text-gray-600">Loading...</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-4">
				<div className="text-red-600">Error: {error}</div>
			</div>
		);
	}

	return (
		<div className="p-4">
			<div className="mb-4 pb-2 border-b border-gray-200">
				<div className="text-sm text-gray-600 mb-1">{filePath}</div>
				<div className="text-xs text-gray-500">
					{formatFileSize(size)} • {language}
					{truncated && " • (truncated)"}
				</div>
			</div>
			<textarea
				readOnly
				value={content}
				className="w-full min-h-[400px] bg-white p-3 border border-gray-200 rounded font-mono text-sm leading-relaxed resize-y overflow-auto"
			/>
		</div>
	);
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

