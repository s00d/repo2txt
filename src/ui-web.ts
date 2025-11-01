import express from "express";
import * as path from "path";
import { fileURLToPath } from "url";
import { readFile, stat } from "fs/promises";
import { existsSync } from "fs";
import { spawn, type ChildProcess } from "child_process";
import { buildFileTree, scanDirectoryNode, getSelectedFiles } from "./fileTree.js";
import { generateMarkdown, getLanguageByExtension } from "./generator.js";
import { UIStateController } from "./uiStateController.js";
import { loadConfig, saveConfig } from "./config.js";
import type { FileNode } from "./types.js";
import { encode } from "gpt-tokenizer";
import clipboardy from "clipboardy";

/**
 * Helper function to find a node by path in the tree
 */
function findNodeByPath(
	nodes: FileNode[],
	targetPath: string,
): FileNode | null {
	for (const node of nodes) {
		if (node.path === targetPath) {
			return node;
		}
		if (node.isDirectory && node.children.length > 0) {
			const found = findNodeByPath(node.children, targetPath);
			if (found) return found;
		}
	}
	return null;
}

/**
 * Helper function to update node in tree
 */
function updateNodeInTree(
	nodes: FileNode[],
	targetPath: string,
	updater: (node: FileNode) => FileNode,
): FileNode[] {
	return nodes.map((node) => {
		if (node.path === targetPath) {
			return updater(node);
		}
		if (node.isDirectory) {
			return {
				...node,
				children: updateNodeInTree(node.children, targetPath, updater),
			};
		}
		return node;
	});
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function startWebServer(
	rootPath: string,
	gitignoreContent: string = "",
	port: number = 8765,
): Promise<void> {
	const app = express();
	let electronProcess: ChildProcess | null = null;
	// Check if production build exists - if so, use it
	// Otherwise, try to use Vite dev server (only if vite is available)
	const distWebPath = path.join(__dirname, "../dist/web");
	const hasProductionBuild = existsSync(distWebPath) && existsSync(path.join(distWebPath, "index.html"));
	const isProduction = process.env.NODE_ENV === "production" || hasProductionBuild;

	// Middleware
	app.use(express.json());

	// Read .r2x_ignore file if it exists and add to gitignoreContent
	try {
		const r2xIgnoreContent = await readFile(
			path.join(rootPath, ".r2x_ignore"),
			"utf-8",
		);
		if (r2xIgnoreContent) {
			gitignoreContent += (gitignoreContent ? "\n" : "") + r2xIgnoreContent;
		}
	} catch {
		// .r2x_ignore may not exist
	}

	// Initialize state
	let nodes: FileNode[] = [];
	const stateController = new UIStateController(gitignoreContent);
	const tokenCache = new Map<string, number>();

	// Load initial tree
	try {
		nodes = await buildFileTree(rootPath, gitignoreContent);
		stateController.initialize(nodes);

		// Load saved state
		const savedState = await loadConfig(rootPath);
		if (savedState) {
			stateController.loadState(savedState, nodes);
		}
	} catch (error) {
		console.error("Failed to initialize file tree:", error);
		process.exit(1);
	}

	// API Routes must be defined before static file serving

	// GET /api/tree - Get initial file tree
	app.get("/api/tree", (_req, res) => {
		try {
			res.json({ nodes, rootPath });
		} catch (error) {
			res.status(500).json({
				error:
					error instanceof Error ? error.message : String(error),
			});
		}
	});

	// POST /api/scan - Scan a directory
	app.post("/api/scan", async (req, res) => {
		try {
			const { path: dirPath } = req.body;
			const node = findNodeByPath(nodes, dirPath);
			if (!node || !node.isDirectory) {
				return res.status(404).json({ error: "Directory not found" });
			}

			if (node.children.length === 0) {
				await scanDirectoryNode(rootPath, node, gitignoreContent);
				stateController.syncUIStateForChildren(node.children);
			}

			res.json({ children: node.children });
		} catch (error) {
			res.status(500).json({
				error:
					error instanceof Error ? error.message : String(error),
			});
		}
	});

	// GET /api/state - Get UI state
	app.get("/api/state", (_req, res) => {
		try {
			const uiState = stateController.getState();
			const stateObj = Object.fromEntries(uiState);
			res.json({ state: stateObj });
		} catch (error) {
			res.status(500).json({
				error:
					error instanceof Error ? error.message : String(error),
			});
		}
	});

	// POST /api/state - Update UI state
	app.post("/api/state", async (req, res) => {
		try {
			const { path: nodePath, selected, expanded } = req.body;
			const node = findNodeByPath(nodes, nodePath);
			if (!node) {
				return res.status(404).json({ error: "Node not found" });
			}

			if (selected !== undefined) {
				const isCurrentlySelected = stateController.isSelected(nodePath);
				if (isCurrentlySelected !== selected) {
					stateController.toggleSelection(node);
				}
			}
			if (expanded !== undefined) {
				stateController.setExpanded(node, expanded);
			}

			const updatedState = Object.fromEntries(stateController.getState());
			res.json({ state: updatedState });
		} catch (error) {
			res.status(500).json({
				error:
					error instanceof Error ? error.message : String(error),
			});
		}
	});

	// GET /api/file?path=... - Get file content
	app.get("/api/file", async (req, res) => {
		try {
			const filePathParam = req.query.path;
			if (!filePathParam || typeof filePathParam !== "string") {
				return res.status(400).json({ error: "Path parameter is required" });
			}
			const decodedPath = decodeURIComponent(filePathParam);
			const filePath = path.join(rootPath, decodedPath);
			const stats = await stat(filePath);

			if (stats.size > 100000) {
				// Read only first 1000 lines for large files
				const content = await readFile(filePath, "utf-8");
				const lines = content.split("\n").slice(0, 1000).join("\n");
				const language = getLanguageByExtension(filePath);
				return res.json({
					content: lines,
					language,
					size: stats.size,
					truncated: true,
				});
			}

			const content = await readFile(filePath, "utf-8");
			const language = getLanguageByExtension(filePath);
			res.json({
				content,
				language,
				size: stats.size,
				truncated: false,
			});
		} catch (error) {
			res.status(500).json({
				error:
					error instanceof Error ? error.message : String(error),
			});
		}
	});

	// GET /api/stats - Get statistics
	app.get("/api/stats", async (_req, res) => {
		try {
			const selectedFiles = getSelectedFiles(
				nodes,
				stateController.getState(),
			);
			let totalSize = 0;
			let totalTokens = 0;

			for (const filePath of selectedFiles) {
				const fullPath = path.join(rootPath, filePath);
				const stats = await stat(fullPath);
				const size =
					typeof stats.size === "bigint"
						? Number(stats.size)
						: stats.size;
				totalSize += size;

				// Cache tokens
				if (!tokenCache.has(filePath)) {
					try {
						const content = await readFile(fullPath, "utf-8");
						const tokens = encode(content).length;
						tokenCache.set(filePath, tokens);
					} catch {
						// Skip if file cannot be read
						tokenCache.set(filePath, 0);
					}
				}
				totalTokens += tokenCache.get(filePath) ?? 0;
			}

			res.json({
				files: selectedFiles.length,
				size: totalSize,
				tokens: totalTokens,
			});
		} catch (error) {
			res.status(500).json({
				error:
					error instanceof Error ? error.message : String(error),
			});
		}
	});

	// POST /api/generate - Generate markdown
	app.post("/api/generate", async (req, res) => {
		try {
			const { outputPath, clipboard } = req.body;

			// Save config
			await saveConfig(rootPath, stateController.getState());

			// Generate markdown
			const content = await generateMarkdown(
				nodes,
				rootPath,
				clipboard ? null : (outputPath || "output.md"),
				stateController.getState(),
				gitignoreContent,
			);

			if (clipboard) {
				await clipboardy.write(content);
				res.json({ 
					success: true, 
					message: "Copied to clipboard",
					content: content,
				});
			} else {
				res.json({
					success: true,
					message: "Generated successfully",
					path: outputPath || "output.md",
					content: content,
				});
			}
		} catch (error) {
			res.status(500).json({
				success: false,
				error:
					error instanceof Error ? error.message : String(error),
			});
		}
	});

	// POST /api/shutdown - Shutdown server
	app.post("/api/shutdown", (_req, res) => {
		res.json({ success: true, message: "Server shutting down" });
		setTimeout(() => {
			if (electronProcess && !electronProcess.killed) {
				electronProcess.kill();
			}
			process.exit(0);
		}, 500);
	});

	// Setup Vite in development or serve static files in production
	// Must be after API routes to avoid conflicts
	if (!isProduction) {
		// Development: use Vite dev server (dynamic import to avoid requiring vite in production)
		try {
			const { createServer } = await import("vite");
			process.env.BUILD_WEB = "true";
			const vite = await createServer({
				server: { middlewareMode: true },
				root: path.join(__dirname, "../web"),
				appType: "spa",
				configFile: path.join(__dirname, "../vite.config.ts"),
			});
			app.use(vite.middlewares);
		} catch (error) {
			console.error(
				"Failed to start Vite dev server. Make sure vite is installed:",
				error instanceof Error ? error.message : String(error),
			);
			console.error(
				"In production, use built files. Run 'npm run build' to build web UI.",
			);
			// Fallback to static files if vite is not available
			const staticPath = existsSync(path.join(__dirname, "../dist/web"))
				? path.join(__dirname, "../dist/web")
				: path.join(__dirname, "../web");
			// Serve static files - let 404 fall through to catch-all route
			app.use(express.static(staticPath, { fallthrough: true }));
			// Catch-all route for SPA - must be last
			// This only fires if static middleware didn't find a file (404)
			const indexPath = path.resolve(staticPath, "index.html");
			// Log for debugging
			if (!existsSync(indexPath)) {
				console.error(`WARNING: index.html not found at: ${indexPath}`);
				console.error(`Static path: ${staticPath}`);
				console.error(`__dirname: ${__dirname}`);
			}
			app.use((req, res, next) => {
				// Only handle GET requests that aren't API routes
				if (req.method !== "GET" || req.path.startsWith("/api")) {
					return next();
				}
				// Check if index.html exists before sending
				if (existsSync(indexPath)) {
					// Only send if response hasn't been sent yet
					if (!res.headersSent) {
						// sendFile with root option is the correct way for SPA routing
						res.sendFile("index.html", { root: staticPath }, (err) => {
							if (err && !res.headersSent) {
								console.error(`Failed to send index.html from ${staticPath}:`, err);
								next(err);
							}
						});
					}
				} else {
					if (!res.headersSent) {
						res.status(404).send(`Not Found: index.html not found at ${indexPath}`);
					}
				}
			});
		}
	} else {
		// Production: serve static files
		const staticPath = path.join(__dirname, "../dist/web");
		if (!existsSync(staticPath)) {
			console.error(
				"Production build not found. Run 'pnpm build' first.",
			);
			process.exit(1);
		}
		// Serve static files - let 404 fall through to catch-all route
		app.use(express.static(staticPath, { fallthrough: true }));
		// Catch-all route for SPA - must be last
		// This only fires if static middleware didn't find a file (404)
		const indexPath = path.resolve(staticPath, "index.html");
		// Log for debugging
		if (!existsSync(indexPath)) {
			console.error(`WARNING: index.html not found at: ${indexPath}`);
			console.error(`Static path: ${staticPath}`);
			console.error(`__dirname: ${__dirname}`);
		}
		app.use((req, res, next) => {
			// Only handle GET requests that aren't API routes
			if (req.method !== "GET" || req.path.startsWith("/api")) {
				return next();
			}
			// Check if index.html exists before sending
			if (existsSync(indexPath)) {
				// Only send if response hasn't been sent yet
				if (!res.headersSent) {
					// sendFile requires an absolute path, and the path must be within the static directory
					// For SPA routing, always send index.html
					res.sendFile("index.html", { root: staticPath }, (err) => {
						if (err && !res.headersSent) {
							console.error(`Failed to send index.html from ${staticPath}:`, err);
							next(err);
						}
					});
				}
			} else {
				if (!res.headersSent) {
					res.status(404).send(`Not Found: index.html not found at ${indexPath}`);
				}
			}
		});
	}

	// Start server
	app.listen(port, async () => {
		const url = `http://localhost:${port}`;
		console.log(`Server running on ${url}`);
		
		try {
			// Find electron binary
			const electronPath = path.join(__dirname, "../node_modules/.bin/electron");
			let electronExecutable: string;
			
			if (existsSync(electronPath)) {
				electronExecutable = electronPath;
			} else {
				// Try alternative paths
				const altPath = path.join(__dirname, "../node_modules/electron/cli.js");
				if (existsSync(altPath)) {
					electronExecutable = process.execPath;
					// Will use node to run cli.js
				} else {
					throw new Error("Electron binary not found. Make sure electron is installed.");
				}
			}
			
			// Create a simple Electron main script
			const electronMainScript = `
const { app, BrowserWindow } = require('electron');
const url = '${url}';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'repo2txt',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  
  win.loadURL(url);
  
  win.on('closed', () => {
    process.exit(0);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  process.exit(0);
});
`;
			
			const scriptPath = path.join(__dirname, "../tmp/electron-main.cjs");
			const scriptDir = path.dirname(scriptPath);
			if (!existsSync(scriptDir)) {
				const { mkdir } = await import("fs/promises");
				await mkdir(scriptDir, { recursive: true });
			}
			await import("fs/promises").then(({ writeFile }) => writeFile(scriptPath, electronMainScript));
			
			// Spawn electron process
			electronProcess = spawn(electronExecutable, [scriptPath], {
				stdio: "inherit",
				cwd: path.join(__dirname, ".."),
			});
			
			// When electron exits, exit the program
			electronProcess.on("exit", (code) => {
				electronProcess = null;
				process.exit(code || 0);
			});
			
			electronProcess.on("error", (error) => {
				console.error("Failed to start electron:", error);
			});
		} catch (error) {
			console.error("Failed to start electron:", error);
			console.error("Make sure electron package is installed: pnpm install electron");
		}
	});
	
	// Handle process termination signals
	const shutdown = () => {
		if (electronProcess && !electronProcess.killed) {
			electronProcess.kill();
		}
		process.exit(0);
	};
	
	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
}

