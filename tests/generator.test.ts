import { describe, expect, it } from "vitest";
import { getLanguageByExtension } from "../src/generator.js";

describe("getLanguageByExtension", () => {
	it("должен определять TypeScript", () => {
		expect(getLanguageByExtension("file.ts")).toBe("typescript");
		expect(getLanguageByExtension("src/index.ts")).toBe("typescript");
	});

	it("должен определять JavaScript", () => {
		expect(getLanguageByExtension("file.js")).toBe("javascript");
		expect(getLanguageByExtension("src/index.js")).toBe("javascript");
	});

	it("должен определять файлы без расширений по имени", () => {
		expect(getLanguageByExtension("Dockerfile")).toBe("dockerfile");
		expect(getLanguageByExtension("Makefile")).toBe("makefile");
		expect(getLanguageByExtension("LICENSE")).toBe("text");
		expect(getLanguageByExtension("README")).toBe("markdown");
		expect(getLanguageByExtension(".gitignore")).toBe("gitignore");
	});

	it("должен определять различные расширения файлов", () => {
		expect(getLanguageByExtension("file.py")).toBe("python");
		expect(getLanguageByExtension("file.java")).toBe("java");
		expect(getLanguageByExtension("file.rs")).toBe("rust");
		expect(getLanguageByExtension("file.go")).toBe("go");
	});

	it('должен возвращать "text" для неизвестных расширений', () => {
		expect(getLanguageByExtension("file.unknown")).toBe("text");
		expect(getLanguageByExtension("file")).toBe("text");
	});

	it("должен правильно обрабатывать конфигурационные файлы", () => {
		expect(getLanguageByExtension(".env")).toBe("dotenv");
		expect(getLanguageByExtension(".env.example")).toBe("dotenv");
		expect(getLanguageByExtension("docker-compose.yml")).toBe("yaml");
		expect(getLanguageByExtension("docker-compose.yaml")).toBe("yaml");
	});
});
