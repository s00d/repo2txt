import { defineConfig } from "vite";
import { resolve } from "path";
import dts from "vite-plugin-dts";

export default defineConfig({
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
});

