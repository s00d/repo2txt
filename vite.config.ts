import { defineConfig } from "vite";
import { resolve } from "path";
import dts from "vite-plugin-dts";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => {
	// Если BUILD_WEB === "true", собираем web UI
	if (process.env.BUILD_WEB === "true") {
		return {
			plugins: [react(), tailwindcss()],
			root: "web",
			build: {
				outDir: "../dist/web",
				emptyOutDir: true,
			},
			resolve: {
				alias: {
					"@": resolve(__dirname, "./src"),
				},
			},
			esbuild: {
				jsx: "automatic",
			},
		};
	}

	// Обычная сборка для CLI
	return {
		plugins: [
			dts({
				include: ["src/**/*"],
				exclude: ["src/**/*.test.ts", "src/**/*.spec.ts", "src/main.ts"],
				outDir: "dist",
				rollupTypes: false,
				copyDtsFiles: true,
				insertTypesEntry: false,
			}),
		],
		build: {
			target: "es2022",
			outDir: "dist",
			lib: {
				entry: {
					main: resolve(__dirname, "src/main.ts"),
					index: resolve(__dirname, "src/index.ts"),
				},
				formats: ["es"],
				fileName: (_format, entryName) => `${entryName}.js`,
			},
			rollupOptions: {
				external: [
					// Node.js встроенные модули
					/^node:/,
					"fs",
					"fs/promises",
					"path",
					"url",
					"events",
					"os",
					"util",
					"stream",
					"buffer",
					// Внешние зависимости
					"blessed",
					"chalk",
					"citty",
					"ignore",
					"clipboardy",
					"gpt-tokenizer",
					"express",
					"open",
					"vite",
				],
				output: {
					preserveModules: true,
					entryFileNames: "[name].js",
					// Shebang уже есть в исходном файле main.ts, Vite сохранит его
				},
			},
			minify: false,
			sourcemap: true,
		},
	};
});
