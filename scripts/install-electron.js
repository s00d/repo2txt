#!/usr/bin/env node

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

console.log("🔧 Starting Electron installation...");
console.log(`📦 Project root: ${projectRoot}`);

const electronPath = join(projectRoot, "node_modules", "electron");
const installScript = join(electronPath, "install.js");

if (!existsSync(installScript)) {
	console.error("❌ Electron install.js not found at:", installScript);
	console.log("💡 Make sure electron is installed first: pnpm install electron");
	process.exit(1);
}

console.log("✅ Found Electron install script:", installScript);
console.log("📥 Downloading Electron binary...");

const proc = spawn("node", [installScript], {
	cwd: projectRoot,
	env: {
		...process.env,
		ELECTRON_GET_USE_PROXY: "1",
		DEBUG: "electron-get:*",
		ELECTRON_GET_ATTACH_DEBUGGER: "1",
	},
	stdio: "inherit",
});

proc.on("error", (error) => {
	console.error("❌ Failed to start Electron installation:", error);
	process.exit(1);
});

proc.on("close", (code) => {
	if (code === 0) {
		console.log("✅ Electron installation completed successfully!");
	} else {
		console.error(`❌ Electron installation failed with code ${code}`);
		process.exit(code || 1);
	}
});

