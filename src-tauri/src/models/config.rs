use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub ignored_names: HashSet<String>, // Имена файлов для игнора
    pub ignored_folders: HashSet<String>, // Имена папок для игнора
    pub binary_extensions: HashSet<String>, // Расширения (png, exe)
    #[serde(default = "default_token_limit")]
    pub token_limit: usize, // Лимит токенов для визуального предупреждения
    #[serde(default = "default_max_file_size")]
    pub max_file_size: u64, // Максимальный размер файла для включения в генерацию (в байтах)
    #[serde(default = "default_output_template")]
    pub output_template: String, // Шаблон для генерации вывода
    #[serde(default = "default_theme")]
    pub theme: String, // Тема интерфейса: "system", "light", "dark"
    #[serde(default = "default_output_filename")]
    pub output_filename: String, // Имя выходного файла по умолчанию
}

fn default_token_limit() -> usize {
    128000
}

fn default_max_file_size() -> u64 {
    1024 * 1024 // 1 MB
}

fn default_output_template() -> String {
    "## {{path}}\n\n```{{language}}\n{{content}}\n```\n\n---\n\n".to_string()
}

fn default_theme() -> String {
    "system".to_string()
}

fn default_output_filename() -> String {
    "output.md".to_string()
}

impl Default for AppConfig {
    fn default() -> Self {
        // Игнорируемые файлы (не папки)
        let ignored_files = vec![
            ".DS_Store",
            "Thumbs.db",
            "Gemfile.lock",
            "go.sum",
            "go.work.sum",
            "yarn.lock",
            "pnpm-lock.yaml",
            "composer.lock",
            "package-lock.json",
            "Cargo.lock",
        ];

        // Игнорируемые папки
        let ignored_folders = vec![
            ".git",
            ".svn",
            ".hg",
            ".idea",
            ".vscode",
            ".vs",
            ".history",
            "node_modules",
            "bower_components",
            "jspm_packages",
            "web_modules",
            "dist",
            "build",
            "out",
            "target",
            "bin",
            "obj",
            "release",
            "debug",
            "pkg",
            ".next",
            ".nuxt",
            ".cache",
            ".parcel-cache",
            ".turbo",
            ".vercel",
            ".output",
            "__pycache__",
            ".pytest_cache",
            ".mypy_cache",
            ".tox",
            "venv",
            ".venv",
            "env",
            "bundler",
            "vendor",
            ".bundle",
            "checkouts",
            ".cargo",
            ".rustup",
            ".gradle",
            ".settings",
            ".classpath",
            ".project",
            "Properties",
            "_build",
            "deps",
            "_opam",
            "storage",
            "bootstrap/cache",
            "htmlcov",
            "coverage",
            ".nyc_output",
        ];

        let binary = vec![
            "icns",
            "png",
            "jpg",
            "jpeg",
            "gif",
            "bmp",
            "ico",
            "svg",
            "webp",
            "tiff",
            "tif",
            "psd",
            "ai",
            "eps",
            "mp4",
            "avi",
            "mov",
            "wmv",
            "flv",
            "mkv",
            "webm",
            "3gp",
            "mp3",
            "wav",
            "flac",
            "aac",
            "ogg",
            "wma",
            "m4a",
            "zip",
            "rar",
            "7z",
            "tar",
            "gz",
            "bz2",
            "xz",
            "iso",
            "dmg",
            "pkg",
            "deb",
            "rpm",
            "exe",
            "dll",
            "so",
            "dylib",
            "bin",
            "msi",
            "msu",
            "ttf",
            "otf",
            "woff",
            "woff2",
            "eot",
            "pdf",
            "doc",
            "docx",
            "xls",
            "xlsx",
            "ppt",
            "pptx",
            "odt",
            "ods",
            "sqlite",
            "db",
            "db3",
            "mdb",
            "accdb",
            "pyc",
            "pyo",
            "pyd",
            "class",
            "jar",
            "war",
            "ear",
            "ds_store",
            "thumbs.db",
        ];

        Self {
            ignored_names: ignored_files.into_iter().map(String::from).collect(),
            ignored_folders: ignored_folders.into_iter().map(String::from).collect(),
            binary_extensions: binary.into_iter().map(String::from).collect(),
            token_limit: default_token_limit(),
            max_file_size: default_max_file_size(),
            output_template: default_output_template(),
            theme: default_theme(),
            output_filename: default_output_filename(),
        }
    }
}
