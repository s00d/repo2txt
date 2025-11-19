use crate::models::{AppConfig, FileNode};
use crate::models::ui::{get_app_settings_schema, SettingSection};
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::State;
use tokio::fs;

#[derive(Debug, Serialize, Deserialize)]
struct ConfigNode {
    name: String,
    path: String,
    is_directory: bool,
    selected: bool,
    expanded: bool,
    children: Option<Vec<ConfigNode>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct R2XConfig {
    version: String,
    nodes: Vec<ConfigNode>,
}

fn file_node_to_config_node(node: &FileNode, nodes: &HashMap<String, FileNode>) -> ConfigNode {
    let children: Vec<ConfigNode> = nodes
        .values()
        .filter(|n| n.parent_id.as_ref() == Some(&node.id))
        .map(|n| file_node_to_config_node(n, nodes))
        .collect();

    ConfigNode {
        name: node.name.clone(),
        path: node.relative_path.clone(),
        is_directory: node.is_directory,
        selected: node.selected,
        expanded: node.expanded,
        children: if children.is_empty() {
            None
        } else {
            Some(children)
        },
    }
}

fn config_node_to_file_node(
    config: &ConfigNode,
    root_path: &str,
    parent_id: Option<String>,
) -> FileNode {
    let path = PathBuf::from(root_path).join(&config.path);

    FileNode {
        id: config.path.clone(),
        parent_id,
        name: config.name.clone(),
        path: path.to_string_lossy().to_string(),
        relative_path: config.path.clone(),
        is_directory: config.is_directory,
        size: Some(0), // Будет обновлено при сканировании
        token_count: None,
        selected: config.selected,
        expanded: config.expanded,
    }
}

const MAX_PREVIEW_SIZE: u64 = 100 * 1024; // 100KB

#[tauri::command]
pub async fn read_file(id: String, state: State<'_, Arc<AppState>>) -> Result<String, String> {
    log::debug!("Reading file with ID: {}", id);
    
    // Получаем путь. Важно: ID должен совпадать с тем, что в мапе.
    let (file_path, file_size) = {
        let nodes_map = state.nodes.lock().map_err(|_| "Failed to lock nodes")?;
        
        // Логируем для отладки, если файл не найден
        if !nodes_map.contains_key(&id) {
            log::error!("File ID '{}' not found in nodes map. Total nodes: {}", id, nodes_map.len());
            return Err(format!("File not found in index: {}", id));
        }
        
        let node = nodes_map.get(&id).unwrap();

        if node.is_directory {
            return Err("Cannot read directory as file".to_string());
        }

        (node.path.clone(), node.size.unwrap_or(0))
    };

    // Ограничение на размер файла для превью
    if file_size > MAX_PREVIEW_SIZE {
        log::warn!(
            "File {} is too large ({} bytes), truncating to {} bytes",
            id,
            file_size,
            MAX_PREVIEW_SIZE
        );
        use tokio::io::AsyncReadExt;
        let mut file = fs::File::open(Path::new(&file_path)).await.map_err(|e| {
            log::error!("Failed to open file {}: {}", file_path, e);
            format!("Failed to open file: {}", e)
        })?;

        let mut buffer = vec![0u8; MAX_PREVIEW_SIZE as usize];
        let bytes_read = file.read(&mut buffer).await.map_err(|e| {
            log::error!("Failed to read file {}: {}", file_path, e);
            format!("Failed to read file: {}", e)
        })?;

        let content = String::from_utf8_lossy(&buffer[..bytes_read]);
        log::info!("Read {} bytes from file {} (truncated)", bytes_read, id);
        return Ok(format!(
            "{}\n\n--- TRUNCATED (File too large: {} bytes) ---",
            content, file_size
        ));
    }

    log::info!("Reading file {} ({} bytes)", id, file_size);

    // Читаем файл с безопасной обработкой UTF-8
    let bytes = fs::read(Path::new(&file_path)).await.map_err(|e| {
        log::error!("Failed to read file {}: {}", file_path, e);
        format!("Failed to read file: {}", e)
    })?;

    // Проверка на бинарность по содержимому (первые 1KB)
    if bytes.iter().take(1024).any(|&b| b == 0) {
        log::warn!("File {} detected as binary", file_path);
        return Ok(String::from("*Binary file*"));
    }

    Ok(String::from_utf8_lossy(&bytes).to_string())
}

#[tauri::command]
pub async fn save_config(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    log::debug!("Saving configuration");
    let (config_nodes, root) = {
        let nodes_map = state.nodes.lock().map_err(|_| "Failed to lock nodes")?;
        let root_path = state
            .root_path
            .lock()
            .map_err(|_| "Failed to lock root_path")?;

        let root = root_path.as_ref().ok_or("No root path set")?.clone();

        // Получаем корневые узлы
        let root_nodes: Vec<&FileNode> = nodes_map
            .values()
            .filter(|n| {
                n.parent_id.is_none() || n.parent_id.as_ref().map(|p| p.is_empty()).unwrap_or(true)
            })
            .collect();

        let config_nodes: Vec<ConfigNode> = root_nodes
            .iter()
            .map(|n| file_node_to_config_node(n, &nodes_map))
            .collect();

        (config_nodes, root)
    };

    // Убеждаемся, что путь абсолютный
    let root_path = PathBuf::from(&root);
    let config_path = if root_path.is_absolute() {
        root_path.join(".r2x")
    } else {
        // Если путь относительный, делаем его абсолютным относительно текущей директории
        std::env::current_dir()
            .map_err(|e| format!("Failed to get current directory: {}", e))?
            .join(&root)
            .join(".r2x")
    };

    log::info!("Saving config to: {}", config_path.display());

    let config = R2XConfig {
        version: "1.0".to_string(),
        nodes: config_nodes,
    };

    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&config_path, content)
        .await
        .map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn load_config(state: State<'_, Arc<AppState>>) -> Result<Vec<FileNode>, String> {
    log::debug!("Loading configuration");
    let root = {
        let root_path = state
            .root_path
            .lock()
            .map_err(|_| "Failed to lock root_path")?;
        root_path.as_ref().ok_or("No root path set")?.clone()
    };

    // Убеждаемся, что путь абсолютный
    let root_path = PathBuf::from(&root);
    let config_path = if root_path.is_absolute() {
        root_path.join(".r2x")
    } else {
        // Если путь относительный, делаем его абсолютным относительно текущей директории
        std::env::current_dir()
            .map_err(|e| format!("Failed to get current directory: {}", e))?
            .join(&root)
            .join(".r2x")
    };

    log::info!("Loading config from: {}", config_path.display());

    if !config_path.exists() {
        log::debug!("Config file does not exist, returning empty list");
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&config_path)
        .await
        .map_err(|e| format!("Failed to read config: {}", e))?;

    let config: R2XConfig =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse config: {}", e))?;

    let mut nodes_map = state.nodes.lock().map_err(|_| "Failed to lock nodes")?;
    let mut result_nodes = Vec::new();

    fn load_node(
        config: &ConfigNode,
        root_path: &str,
        parent_id: Option<String>,
        nodes_map: &mut HashMap<String, FileNode>,
        result_nodes: &mut Vec<FileNode>,
    ) {
        let node = config_node_to_file_node(config, root_path, parent_id.clone());
        let node_id = node.id.clone();

        nodes_map.insert(node_id.clone(), node.clone());
        result_nodes.push(node.clone());

        if let Some(children) = &config.children {
            for child in children {
                load_node(
                    child,
                    root_path,
                    Some(node_id.clone()),
                    nodes_map,
                    result_nodes,
                );
            }
        }
    }

    for config_node in &config.nodes {
        load_node(config_node, &root, None, &mut nodes_map, &mut result_nodes);
    }

    Ok(result_nodes)
}

#[tauri::command]
pub async fn get_config_schema() -> Result<Vec<SettingSection>, String> {
    log::debug!("Getting config schema");
    Ok(get_app_settings_schema())
}

#[tauri::command]
pub async fn get_default_config() -> Result<AppConfig, String> {
    log::debug!("Getting default config");
    Ok(AppConfig::default())
}
