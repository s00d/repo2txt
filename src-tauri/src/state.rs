use crate::models::FileNode;
use std::collections::HashMap;
use std::sync::Mutex;

pub struct AppState {
    // Храним плоский список узлов для быстрого доступа O(1)
    pub nodes: Mutex<HashMap<String, FileNode>>,
    pub root_path: Mutex<Option<String>>,
    // Кэш для последнего сгенерированного контента
    pub last_generated_content: Mutex<Option<String>>,
    // ID текущего сканирования для предотвращения гонок
    pub current_scan_id: Mutex<u32>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            nodes: Mutex::new(HashMap::new()),
            root_path: Mutex::new(None),
            last_generated_content: Mutex::new(None),
            current_scan_id: Mutex::new(0),
        }
    }
}
