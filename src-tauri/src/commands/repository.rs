use crate::models::{AppConfig, FileNode, FileUpdate};
use crate::state::AppState;
use futures::{stream, StreamExt};
use ignore::WalkBuilder;
use serde::Deserialize;
use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tiktoken_rs::cl100k_base;
use tokio::fs as tokio_fs;

// Вспомогательные структуры для парсинга .r2x (нужны только для чтения состояния)
#[derive(Deserialize)]
struct ConfigNodeSimple {
    path: String, // relative path
    selected: bool,
    expanded: bool,
    children: Option<Vec<ConfigNodeSimple>>,
}

#[derive(Deserialize)]
struct R2XConfigSimple {
    nodes: Vec<ConfigNodeSimple>,
}

// Функция для превращения дерева конфига в плоскую карту состояний
fn flatten_config_state(nodes: Vec<ConfigNodeSimple>, map: &mut HashMap<String, (bool, bool)>) {
    for node in nodes {
        map.insert(node.path.clone(), (node.selected, node.expanded));
        if let Some(children) = node.children {
            flatten_config_state(children, map);
        }
    }
}

// Функция проверки приватных файлов (оставляем хардкод для безопасности)
fn is_private_file(name: &str) -> bool {
    let name_lower = name.to_lowercase();
    name_lower == ".env"
        || name_lower.starts_with(".env.")
        || name_lower.ends_with(".secret")
        || name_lower.ends_with(".key")
        || name_lower.ends_with(".pem")
        || name_lower.contains("id_rsa")
        || name_lower.contains("secrets")
}

#[tauri::command]
pub async fn get_current_directory() -> Result<String, String> {
    log::debug!("Getting current directory");

    // Пытаемся получить из переменных окружения (в порядке приоритета)
    // OLDPWD - предыдущая директория (может быть установлена при запуске)
    // PWD - текущая рабочая директория терминала
    for env_var in &["OLDPWD", "PWD", "INIT_CWD"] {
        if let Ok(dir) = env::var(env_var) {
            let dir_path = Path::new(&dir);
            if dir_path.exists() && dir_path.is_dir() {
                let path = dir_path.to_string_lossy().to_string();
                log::info!("Current directory from {}: {}", env_var, path);
                return Ok(path);
            }
        }
    }

    // Если переменные окружения не доступны, используем текущую рабочую директорию процесса
    // Но сначала пытаемся получить родительскую директорию бинарника, если мы в директории бинарника
    let current_dir = env::current_dir().map_err(|e| {
        log::error!("Failed to get current directory: {}", e);
        format!("Failed to get current directory: {}", e)
    })?;

    let current_path = current_dir.to_string_lossy().to_string();
    log::info!(
        "Current directory from env::current_dir(): {}",
        current_path
    );

    // Если мы в директории с бинарником (target/debug или target/release),
    // пытаемся найти корень проекта (ищем Cargo.toml или package.json в родительских директориях)
    if current_path.contains("/target/") {
        let mut search_path = current_dir.clone();
        for _ in 0..10 {
            // Проверяем до 10 уровней вверх
            if let Some(parent) = search_path.parent() {
                search_path = parent.to_path_buf();
                // Проверяем наличие признаков корня проекта
                if search_path.join("Cargo.toml").exists()
                    || search_path.join("package.json").exists()
                    || search_path.join(".git").exists()
                {
                    let path = search_path.to_string_lossy().to_string();
                    log::info!("Found project root: {}", path);
                    return Ok(path);
                }
            } else {
                break;
            }
        }
    }

    Ok(current_path)
}

#[tauri::command]
pub async fn get_parent_directory(path: String) -> Result<Option<String>, String> {
    log::debug!("Getting parent directory for: {}", path);
    let parent = Path::new(&path).parent();

    if let Some(parent_path) = parent {
        let parent_str = parent_path.to_string_lossy().to_string();
        log::info!("Parent directory: {}", parent_str);
        Ok(Some(parent_str))
    } else {
        log::debug!("No parent directory (already at root)");
        Ok(None)
    }
}

#[tauri::command]
pub async fn open_directory(
    path: Option<String>,
    config: Option<AppConfig>,
    state: State<'_, Arc<AppState>>,
    app_handle: AppHandle,
) -> Result<Vec<FileNode>, String> {
    // Если путь не передан, используем текущую директорию
    let path = match path {
        Some(p) => {
            log::info!("Opening directory: {}", p);
            p
        }
        None => {
            log::info!("No path provided, using current directory");
            env::current_dir()
                .map(|p| p.to_string_lossy().to_string())
                .map_err(|e| {
                    log::error!("Failed to get current directory: {}", e);
                    "Failed to get current directory".to_string()
                })?
        }
    };
    let root_path = Path::new(&path);

    if !root_path.exists() || !root_path.is_dir() {
        log::error!("Directory does not exist or is not a directory: {}", path);
        return Err("Directory does not exist".to_string());
    }

    log::info!("Phase 1: Scan structure + Config Merge for: {}", path);

    // Используем переданный конфиг или дефолтный
    let app_config = config.unwrap_or_default();
    log::debug!(
        "Using config with {} ignored names and {} binary extensions",
        app_config.ignored_names.len(),
        app_config.binary_extensions.len()
    );

    // Сохраняем корень
    *state.root_path.lock().map_err(|_| {
        log::error!("Failed to lock root_path");
        "Failed to lock root_path"
    })? = Some(path.clone());

    // 1. Пытаемся загрузить конфиг .r2x и создать карту состояний
    let root_path_buf = PathBuf::from(&path);
    let config_path = root_path_buf.join(".r2x");
    let config_map = if config_path.exists() {
        match fs::read_to_string(&config_path) {
            Ok(content) => match serde_json::from_str::<R2XConfigSimple>(&content) {
                Ok(conf) => {
                    let mut map = HashMap::new();
                    flatten_config_state(conf.nodes, &mut map);
                    log::info!("Loaded .r2x config with {} entries", map.len());
                    Some(map)
                }
                Err(e) => {
                    log::warn!("Failed to parse .r2x: {}", e);
                    None
                }
            },
            Err(e) => {
                log::warn!("Failed to read .r2x: {}", e);
                None
            }
        }
    } else {
        log::debug!("No .r2x config found");
        None
    };

    // Инкрементируем scan_id для предотвращения гонок
    let scan_id = {
        let mut scan_id_guard = state.current_scan_id.lock().map_err(|_| "Lock error")?;
        *scan_id_guard += 1;
        *scan_id_guard
    };
    log::info!("Starting scan with ID: {}", scan_id);

    // 2. Сканируем ФС (Этап 1) с применением конфига
    let config_map_clone = config_map.clone();
    let app_config_clone = app_config.clone();
    let nodes = tauri::async_runtime::spawn_blocking(move || {
        let mut result_nodes = Vec::new();
        let mut node_map = HashMap::new();

        let mut builder = WalkBuilder::new(&root_path_buf);
        builder.hidden(false).git_ignore(true);

        // Добавляем поддержку .r2x_ignore
        let r2x_ignore_path = root_path_buf.join(".r2x_ignore");
        if r2x_ignore_path.exists() {
            log::info!("Found .r2x_ignore file, adding to ignore rules");
            builder.add_ignore(&r2x_ignore_path);
        }

        let walker = builder.build();

        for result in walker {
            if let Ok(entry) = result {
                let depth = entry.depth();
                if depth == 0 {
                    continue;
                }

                let entry_path = entry.path();
                let name = entry_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("");

                // Проверка по конфигу (вместо констант)
                if app_config_clone.ignored_names.contains(name) {
                    continue;
                }

                // Получаем только тип файла, без размера (file_type быстрее metadata)
                let is_directory = entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false);

                if !is_directory {
                    // Проверка расширения по конфигу
                    if let Some(ext) = entry_path.extension().and_then(|e| e.to_str()) {
                        if app_config_clone
                            .binary_extensions
                            .contains(&ext.to_lowercase())
                        {
                            continue;
                        }
                    }
                    // Проверка на приватные файлы (хардкод для безопасности)
                    if is_private_file(name) {
                        continue;
                    }
                }

                let relative_path = match entry_path.strip_prefix(&root_path_buf) {
                    Ok(p) => p.to_string_lossy().to_string(),
                    Err(_) => entry_path.to_string_lossy().to_string(),
                };
                let id = relative_path.clone();

                // Parent ID logic
                let parent_id = if depth <= 1 {
                    None
                } else {
                    entry_path
                        .parent()
                        .and_then(|p| p.strip_prefix(&root_path_buf).ok())
                        .map(|p| p.to_string_lossy().to_string())
                        .filter(|p| !p.is_empty())
                };

                // --- ЛОГИКА СЛИЯНИЯ (MERGE) ---
                // По умолчанию selected = true (если файла нет в конфиге, считаем новым и выбираем)
                let (selected, expanded) = if let Some(map) = &config_map_clone {
                    if let Some(&(s, e)) = map.get(&id) {
                        (s, e)
                    } else {
                        // Если файла нет в конфиге (новый файл) -> Выбираем его
                        (true, false)
                    }
                } else {
                    // Конфига нет -> все выбрано, папки закрыты
                    (true, false)
                };

                let node = FileNode {
                    id: id.clone(),
                    parent_id,
                    name: name.to_string(),
                    path: entry_path.to_string_lossy().to_string(),
                    relative_path,
                    is_directory,
                    size: None,        // <--- ВАЖНО: Пока не знаем размер
                    token_count: None, // <--- ВАЖНО: Пока не знаем токены
                    selected,          // <-- Применили из конфига
                    expanded,          // <-- Применили из конфига
                };

                node_map.insert(id, node.clone());
                result_nodes.push(node);
            }
        }
        // Сортировка: папки сверху
        result_nodes.sort_by(|a, b| {
            if a.is_directory != b.is_directory {
                return b.is_directory.cmp(&a.is_directory);
            }
            a.name.cmp(&b.name)
        });

        (result_nodes, node_map)
    })
    .await
    .map_err(|e| e.to_string())?;

    let (result_vec, result_map) = nodes;

    // Сохраняем структуру
    {
        let mut nodes_guard = state.nodes.lock().map_err(|_| "Lock error")?;
        *nodes_guard = result_map;
    }

    // Запускаем ЭТАП 2 в фоне с scan_id
    let app_handle_clone = app_handle.clone();
    // Получаем Arc из State (State уже содержит Arc)
    let state_arc = state.inner().clone();
    let items_to_scan = result_vec
        .iter()
        .filter(|n| !n.is_directory)
        .map(|n| (n.id.clone(), n.path.clone()))
        .collect::<Vec<_>>();

    tauri::async_runtime::spawn(async move {
        analyze_files_background(items_to_scan, app_handle_clone, state_arc, scan_id).await;
    });

    log::info!(
        "Phase 1 complete. Found {} nodes. Starting background analysis.",
        result_vec.len()
    );
    Ok(result_vec)
}

// Фоновая задача анализа
async fn analyze_files_background(
    items: Vec<(String, String)>,
    app_handle: AppHandle,
    state: std::sync::Arc<AppState>,
    scan_id: u32,
) {
    log::info!(
        "Phase 2: Background analysis of {} files (scan_id: {})",
        items.len(),
        scan_id
    );

    // Батчинг обновлений, чтобы не спамить событиями (каждые 100 файлов)
    let mut batch = Vec::with_capacity(100);

    // Используем поток для параллельной обработки
    let state_clone = state.clone();
    let mut stream = stream::iter(items)
        .map(move |(id, path)| {
            let state_inner = state_clone.clone();
            async move {
                // Проверяем, не отменили ли сканирование
                let current_scan_id =
                    { state_inner.current_scan_id.lock().map(|g| *g).unwrap_or(0) };
                if current_scan_id != scan_id {
                    log::debug!("Scan {} cancelled, skipping file {}", scan_id, id);
                    return None;
                }

                let path_obj = Path::new(&path);

                // 1. Получаем размер
                let size = match tokio_fs::metadata(path_obj).await {
                    Ok(m) => m.len(),
                    Err(_) => 0,
                };

                // 2. Считаем токены (читаем файл с безопасной обработкой UTF-8)
                let token_count = match tokio_fs::read(path_obj).await {
                    Ok(bytes) => {
                        // Проверка на бинарность по содержимому (первые 1KB)
                        if bytes.iter().take(1024).any(|&b| b == 0) {
                            log::warn!("File {} detected as binary during read", path);
                            0 // Бинарные файлы не считаем токены
                        } else {
                            let content = String::from_utf8_lossy(&bytes);
                            match cl100k_base() {
                                Ok(bpe) => bpe.encode_with_special_tokens(&content).len(),
                                Err(_) => content.len() / 4, // Fallback: approximate token count
                            }
                        }
                    }
                    Err(_) => 0,
                };

                Some(FileUpdate {
                    id,
                    size,
                    token_count,
                })
            }
        })
        .buffer_unordered(50); // 50 файлов параллельно

    while let Some(update_opt) = stream.next().await {
        // Проверяем, не отменили ли сканирование перед отправкой батча
        let current_scan_id = { state.current_scan_id.lock().map(|g| *g).unwrap_or(0) };
        if current_scan_id != scan_id {
            log::info!("Scan {} cancelled, stopping background analysis", scan_id);
            break;
        }

        if let Some(update) = update_opt {
            batch.push(update);

            if batch.len() >= 100 {
                // Отправляем батч на фронтенд
                if let Err(e) = app_handle.emit("files-updated", &batch) {
                    log::error!("Failed to emit update: {}", e);
                }
                batch.clear();
            }
        }
    }

    // Отправляем остатки только если сканирование не отменено
    let current_scan_id = { state.current_scan_id.lock().map(|g| *g).unwrap_or(0) };
    if current_scan_id == scan_id && !batch.is_empty() {
        let _ = app_handle.emit("files-updated", &batch);
        let _ = app_handle.emit("analysis-completed", ());
        log::info!("Phase 2: Analysis complete (scan_id: {})", scan_id);
    } else if current_scan_id != scan_id {
        log::info!("Phase 2: Analysis cancelled (scan_id: {})", scan_id);
    }
}

#[tauri::command]
pub async fn update_selection(
    id: String,
    selected: bool,
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    log::debug!("Updating selection for node {}: {}", id, selected);
    let mut nodes_map = state.nodes.lock().map_err(|_| "Failed to lock nodes")?;

    if let Some(node) = nodes_map.get_mut(&id) {
        node.selected = selected;

        // Оптимизированный рекурсивный выбор для директорий
        // Используем итеративный подход с префиксом пути для эффективности
        if node.is_directory {
            let target_prefix = format!("{}/", id);

            // Обновляем все дочерние элементы (прямые и вложенные)
            for (key, child) in nodes_map.iter_mut() {
                // Если это прямой потомок или вложенный (проверка по префиксу пути)
                // Внимание: это работает только если id == relative_path
                if key.starts_with(&target_prefix) || key == &id {
                    child.selected = selected;
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn toggle_expanded(
    id: String,
    expanded: bool,
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    let mut nodes_map = state.nodes.lock().map_err(|_| "Failed to lock nodes")?;

    if let Some(node) = nodes_map.get_mut(&id) {
        node.expanded = expanded;
    }

    Ok(())
}

#[tauri::command]
pub async fn get_tree(state: State<'_, std::sync::Arc<AppState>>) -> Result<Vec<FileNode>, String> {
    let nodes_map = state.nodes.lock().map_err(|_| "Failed to lock nodes")?;
    Ok(nodes_map.values().cloned().collect())
}

#[tauri::command]
pub async fn get_state(state: State<'_, std::sync::Arc<AppState>>) -> Result<HashMap<String, FileNode>, String> {
    let nodes_map = state.nodes.lock().map_err(|_| "Failed to lock nodes")?;
    Ok(nodes_map.clone())
}

#[tauri::command]
pub async fn scan_directory(
    id: String,
    config: Option<AppConfig>,
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<FileNode>, String> {
    log::debug!("Scanning directory: {}", id);
    let (root, node_relative_path) = {
        let nodes_map = state.nodes.lock().map_err(|_| "Failed to lock nodes")?;
        let root_path = state
            .root_path
            .lock()
            .map_err(|_| "Failed to lock root_path")?;

        let root = root_path.as_ref().ok_or("No root path set")?.clone();
        let node = nodes_map.get(&id).ok_or("Node not found")?;

        if !node.is_directory {
            return Err("Node is not a directory".to_string());
        }

        (root, node.relative_path.clone())
    };

    // Используем переданный конфиг или дефолтный
    let app_config = config.unwrap_or_default();

    // Сканируем директорию
    let dir_path = Path::new(&root).join(&node_relative_path);
    let walker = WalkBuilder::new(&dir_path)
        .hidden(false)
        .git_ignore(true)
        .max_depth(Some(1)) // Только первый уровень
        .build();

    let mut new_nodes = Vec::new();
    let mut nodes_map = state.nodes.lock().map_err(|_| "Failed to lock nodes")?;

    for result in walker {
        match result {
            Ok(entry) => {
                if entry.depth() == 0 {
                    continue; // Пропускаем саму директорию
                }

                let entry_path = entry.path();
                let name = entry_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("");

                // Проверка по конфигу
                if app_config.ignored_names.contains(name) {
                    continue;
                }

                let metadata = match entry.metadata() {
                    Ok(m) => m,
                    Err(_) => continue,
                };

                let is_directory = metadata.is_dir();

                if !is_directory {
                    // Проверка расширения по конфигу
                    if let Some(ext) = entry_path.extension().and_then(|e| e.to_str()) {
                        if app_config.binary_extensions.contains(&ext.to_lowercase()) {
                            log::debug!("Skipping binary file: {}", name);
                            continue;
                        }
                    }
                    // Проверка на приватные файлы
                    if is_private_file(name) {
                        log::debug!("Skipping private file: {}", name);
                        continue;
                    }
                }

                let relative_path = entry_path
                    .strip_prefix(Path::new(&root))
                    .unwrap_or(entry_path)
                    .to_string_lossy()
                    .to_string();

                let node_id = relative_path.clone();

                // Проверяем, существует ли уже узел с таким ID
                if nodes_map.contains_key(&node_id) {
                    continue; // Пропускаем, если уже существует
                }

                let size = if is_directory {
                    Some(0)
                } else {
                    Some(metadata.len())
                };

                let new_node = FileNode {
                    id: node_id.clone(),
                    parent_id: Some(id.clone()),
                    name: name.to_string(),
                    path: entry_path.to_string_lossy().to_string(),
                    relative_path: relative_path.clone(),
                    is_directory,
                    size,
                    token_count: None,
                    selected: true,
                    expanded: false,
                };

                nodes_map.insert(node_id.clone(), new_node.clone());
                new_nodes.push(new_node);
            }
            Err(err) => {
                log::warn!("Error scanning directory entry: {}", err);
            }
        }
    }

    log::debug!("Scanned directory {}: found {} items", id, new_nodes.len());
    Ok(new_nodes)
}

#[tauri::command]
pub async fn search_nodes(
    query: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<String>, String> {
    log::debug!("Searching nodes with query: {}", query);
    let nodes_map = state.nodes.lock().map_err(|_| {
        log::error!("Failed to lock nodes for search");
        "Failed to lock nodes"
    })?;
    let query_lower = query.to_lowercase();

    let matches: Vec<String> = nodes_map
        .values()
        .filter(|n| {
            let name_lower = n.name.to_lowercase();
            name_lower.contains(&query_lower)
        })
        .map(|n| n.id.clone())
        .collect();

    log::info!("Search '{}' found {} matches", query, matches.len());
    Ok(matches)
}

#[tauri::command]
pub async fn select_all(state: State<'_, std::sync::Arc<AppState>>) -> Result<(), String> {
    log::debug!("Selecting all files");
    let mut nodes_map = state.nodes.lock().map_err(|_| "Failed to lock nodes")?;

    for node in nodes_map.values_mut() {
        if !node.is_directory {
            node.selected = true;
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn deselect_all(state: State<'_, std::sync::Arc<AppState>>) -> Result<(), String> {
    log::debug!("Deselecting all files");
    let mut nodes_map = state.nodes.lock().map_err(|_| "Failed to lock nodes")?;

    for node in nodes_map.values_mut() {
        node.selected = false;
    }

    Ok(())
}
