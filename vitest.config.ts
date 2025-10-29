import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		exclude: ["**/node_modules/**", "**/dist/**"],
	},
	build: {
		// Отключаем сборку для vitest конфигурации
		lib: false,
	},
});
