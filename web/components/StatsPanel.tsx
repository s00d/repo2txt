import React, { useState, useEffect } from "react";
import { getStats } from "../api";

export function StatsPanel() {
	const [stats, setStats] = useState<{
		files: number;
		size: number;
		tokens: number;
	} | null>(null);

	useEffect(() => {
		const updateStats = () => {
			getStats()
				.then(setStats)
				.catch((error) => {
					console.error("Failed to load stats:", error);
				});
		};

		updateStats();
		const interval = setInterval(updateStats, 2000);

		return () => clearInterval(interval);
	}, []);

	if (!stats) {
		return (
			<div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex gap-6 text-sm">
				<div className="flex flex-col">
					<span className="text-gray-600 text-xs mb-0.5">Loading...</span>
				</div>
			</div>
		);
	}

	return (
		<div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex gap-6 text-sm">
			<div className="flex flex-col">
				<span className="text-gray-600 text-xs mb-0.5">Files</span>
				<span className="font-semibold text-gray-900">{stats.files}</span>
			</div>
			<div className="flex flex-col">
				<span className="text-gray-600 text-xs mb-0.5">Size</span>
				<span className="font-semibold text-gray-900">{formatFileSize(stats.size)}</span>
			</div>
			<div className="flex flex-col">
				<span className="text-gray-600 text-xs mb-0.5">Tokens</span>
				<span className="font-semibold text-gray-900">{formatTokenCount(stats.tokens)}</span>
			</div>
		</div>
	);
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
	if (bytes < 1024 * 1024 * 1024)
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatTokenCount(tokens: number): string {
	if (tokens < 1000) return `${tokens}`;
	if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}k`;
	return `${(tokens / 1000000).toFixed(2)}M`;
}

