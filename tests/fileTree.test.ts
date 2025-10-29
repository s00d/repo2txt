import { describe, expect, it } from "vitest";
import {
	getSelectedFiles,
	getTreeStructure,
	sortNodes,
} from "../src/fileTree.js";
import type { FileNode } from "../src/types.js";

describe("sortNodes", () => {
	it("должен ставить папки перед файлами", () => {
		const file: FileNode = {
			name: "a.ts",
			path: "a.ts",
			isDirectory: false,
			children: [],
			selected: true,
			expanded: false,
		};

		const dir: FileNode = {
			name: "z",
			path: "z",
			isDirectory: true,
			children: [],
			selected: true,
			expanded: false,
		};

		expect(sortNodes(dir, file)).toBeLessThan(0); // dir < file
		expect(sortNodes(file, dir)).toBeGreaterThan(0); // file > dir
	});

	it("должен сортировать папки по имени", () => {
		const dirA: FileNode = {
			name: "a",
			path: "a",
			isDirectory: true,
			children: [],
			selected: true,
			expanded: false,
		};

		const dirB: FileNode = {
			name: "b",
			path: "b",
			isDirectory: true,
			children: [],
			selected: true,
			expanded: false,
		};

		expect(sortNodes(dirA, dirB)).toBeLessThan(0);
		expect(sortNodes(dirB, dirA)).toBeGreaterThan(0);
	});

	it("должен сортировать файлы по имени", () => {
		const fileA: FileNode = {
			name: "a.ts",
			path: "a.ts",
			isDirectory: false,
			children: [],
			selected: true,
			expanded: false,
		};

		const fileB: FileNode = {
			name: "b.ts",
			path: "b.ts",
			isDirectory: false,
			children: [],
			selected: true,
			expanded: false,
		};

		expect(sortNodes(fileA, fileB)).toBeLessThan(0);
		expect(sortNodes(fileB, fileA)).toBeGreaterThan(0);
	});
});

describe("getTreeStructure", () => {
	it("должен показывать только выбранные файлы", () => {
		const nodes: FileNode[] = [
			{
				name: "selected.ts",
				path: "selected.ts",
				isDirectory: false,
				children: [],
				selected: true,
				expanded: false,
			},
			{
				name: "unselected.ts",
				path: "unselected.ts",
				isDirectory: false,
				children: [],
				selected: false,
				expanded: false,
			},
		];

		const structure = getTreeStructure(nodes);
		expect(structure).toContain("selected.ts");
		expect(structure).not.toContain("unselected.ts");
	});

	it("должен показывать папки с выбранными дочерними элементами", () => {
		const nodes: FileNode[] = [
			{
				name: "src",
				path: "src",
				isDirectory: true,
				selected: false,
				expanded: false,
				children: [
					{
						name: "file.ts",
						path: "src/file.ts",
						isDirectory: false,
						children: [],
						selected: true,
						expanded: false,
					},
				],
			},
		];

		const structure = getTreeStructure(nodes);
		expect(structure).toContain("src");
		expect(structure).toContain("file.ts");
	});

	it("не должен показывать пустые папки без выбранных элементов", () => {
		const nodes: FileNode[] = [
			{
				name: "empty",
				path: "empty",
				isDirectory: true,
				selected: false,
				expanded: false,
				children: [],
			},
		];

		const structure = getTreeStructure(nodes);
		expect(structure).not.toContain("empty");
	});

	it("должен правильно строить дерево с префиксами", () => {
		const nodes: FileNode[] = [
			{
				name: "dir",
				path: "dir",
				isDirectory: true,
				selected: true,
				expanded: false,
				children: [
					{
						name: "file.ts",
						path: "dir/file.ts",
						isDirectory: false,
						children: [],
						selected: true,
						expanded: false,
					},
				],
			},
		];

		const structure = getTreeStructure(nodes);
		expect(structure).toContain("dir");
		expect(structure).toContain("file.ts");
		expect(structure).toMatch(/├──|└──/); // Должны быть префиксы дерева
	});
});

describe("getSelectedFiles", () => {
	it("должен возвращать пути выбранных файлов", () => {
		const nodes: FileNode[] = [
			{
				name: "selected.ts",
				path: "selected.ts",
				isDirectory: false,
				children: [],
				selected: true,
				expanded: false,
			},
			{
				name: "unselected.ts",
				path: "unselected.ts",
				isDirectory: false,
				children: [],
				selected: false,
				expanded: false,
			},
		];

		const files = getSelectedFiles(nodes);
		expect(files).toEqual(["selected.ts"]);
	});

	it("должен возвращать файлы из выбранных папок", () => {
		const nodes: FileNode[] = [
			{
				name: "src",
				path: "src",
				isDirectory: true,
				selected: true,
				expanded: false,
				children: [
					{
						name: "file.ts",
						path: "src/file.ts",
						isDirectory: false,
						children: [],
						selected: true,
						expanded: false,
					},
				],
			},
		];

		const files = getSelectedFiles(nodes);
		expect(files).toContain("src/file.ts");
	});

	it("не должен возвращать файлы из невыбранных папок", () => {
		const nodes: FileNode[] = [
			{
				name: "src",
				path: "src",
				isDirectory: true,
				selected: false,
				expanded: false,
				children: [
					{
						name: "file.ts",
						path: "src/file.ts",
						isDirectory: false,
						children: [],
						selected: true,
						expanded: false,
					},
				],
			},
		];

		const files = getSelectedFiles(nodes);
		expect(files).not.toContain("src/file.ts");
	});
});
