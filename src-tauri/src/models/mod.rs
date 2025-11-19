use serde::{Deserialize, Serialize};

pub mod config;
pub mod ui;
pub use config::AppConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub id: String, // Уникальный ID (или относительный путь)
    pub parent_id: Option<String>,
    pub name: String,
    pub path: String, // Полный путь (как String для сериализации)
    pub relative_path: String,
    pub is_directory: bool,
    // Делаем Option, чтобы различать "0 байт" и "еще не загружено"
    pub size: Option<u64>,
    pub token_count: Option<usize>, // Вычисляется лениво или в фоне
    pub selected: bool,
    pub expanded: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppStats {
    pub files: usize,
    pub size: u64,
    pub tokens: usize,
}

// Структура для обновления с фронтенда
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileUpdate {
    pub id: String,
    pub size: u64,
    pub token_count: usize,
}

// Структура для события прогресса генерации
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressEvent {
    pub current: usize,
    pub total: usize,
    pub stage: String, // "scanning", "processing", "writing"
}
