use crate::models::{AppConfig, AppStats, FileNode, ProgressEvent};
use crate::state::AppState;
use futures::{stream, StreamExt};
use std::collections::HashMap;
use std::path::Path;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tiktoken_rs::cl100k_base;
use tokio::fs::{self, File};
use tokio::io::{AsyncWriteExt, BufWriter};

fn get_language_by_extension(file_path: &str) -> &str {
    let file_name = Path::new(file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");

    // Special files
    match file_name {
        "Dockerfile" => return "dockerfile",
        "Makefile" => return "makefile",
        "LICENSE" => return "text",
        "README" => return "markdown",
        "CHANGELOG" => return "markdown",
        ".gitignore" => return "gitignore",
        ".gitattributes" => return "gitattributes",
        ".env" => return "dotenv",
        ".env.example" => return "dotenv",
        _ => {}
    }

    if file_name == "docker-compose.yml" || file_name == "docker-compose.yaml" {
        return "yaml";
    }

    // By extension
    let ext = Path::new(file_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "ts" => "typescript",
        "js" => "javascript",
        "tsx" => "tsx",
        "jsx" => "jsx",
        "json" => "json",
        "md" => "markdown",
        "yml" | "yaml" => "yaml",
        "xml" => "xml",
        "html" => "html",
        "css" => "css",
        "scss" => "scss",
        "sass" => "sass",
        "less" => "less",
        "py" => "python",
        "java" => "java",
        "cpp" | "hpp" => "cpp",
        "c" | "h" => "c",
        "rs" => "rust",
        "go" => "go",
        "php" => "php",
        "rb" => "ruby",
        "sh" | "bash" | "zsh" => "bash",
        "sql" => "sql",
        "vue" => "vue",
        "svelte" => "svelte",
        "toml" => "toml",
        "ini" => "ini",
        "conf" | "config" => "conf",
        _ => "text",
    }
}

// Вспомогательная функция для подсчета токенов (используется в get_stats)
fn count_tokens(content: &str) -> usize {
    match cl100k_base() {
        Ok(bpe) => bpe.encode_with_special_tokens(content).len(),
        Err(_) => {
            // Fallback: approximate token count (roughly 4 chars per token)
            content.len() / 4
        }
    }
}

fn build_tree_structure(nodes: &HashMap<String, FileNode>, _root_path: &str) -> String {
    let mut lines = Vec::new();
    let root_nodes: Vec<&FileNode> = nodes
        .values()
        .filter(|n| {
            n.parent_id.is_none() || n.parent_id.as_ref().map(|p| p.is_empty()).unwrap_or(true)
        })
        .collect();

    // Сортируем корневые узлы для стабильности
    let mut sorted_roots = root_nodes.clone();
    sorted_roots.sort_by(|a, b| {
        if a.is_directory != b.is_directory {
            return b.is_directory.cmp(&a.is_directory); // Папки сверху
        }
        a.name.cmp(&b.name)
    });

    fn traverse(
        node: &FileNode,
        nodes: &HashMap<String, FileNode>,
        prefix: &str,
        is_last: bool,
        lines: &mut Vec<String>,
    ) {
        let marker = if node.selected { "[✓]" } else { "[ ]" };
        let icon = if node.is_directory { "▶ " } else { "" };
        let current_prefix = if is_last { "└── " } else { "├── " };
        let next_prefix = if is_last { "    " } else { "│   " };

        lines.push(format!(
            "{}{}{} {}{}",
            prefix, current_prefix, marker, icon, node.name
        ));

        // Показываем дочерние элементы, если:
        // 1. Это директория И
        // 2. (Она развернута ИЛИ она выбрана - чтобы показать выбранные элементы даже в свернутых папках)
        if node.is_directory {
            let should_show_children = node.expanded || node.selected;

            if should_show_children {
                let mut children: Vec<&FileNode> = nodes
                    .values()
                    .filter(|n| n.parent_id.as_ref().map(|p| p.as_str()) == Some(node.id.as_str()))
                    .collect();

                // Сортировка детей
                children.sort_by(|a, b| {
                    if a.is_directory != b.is_directory {
                        return b.is_directory.cmp(&a.is_directory);
                    }
                    a.name.cmp(&b.name)
                });

                for (i, child) in children.iter().enumerate() {
                    let is_last_child = i == children.len() - 1;
                    traverse(
                        child,
                        nodes,
                        &format!("{}{}", prefix, next_prefix),
                        is_last_child,
                        lines,
                    );
                }
            }
        }
    }

    for (i, node) in sorted_roots.iter().enumerate() {
        let is_last = i == sorted_roots.len() - 1;
        traverse(node, nodes, "", is_last, &mut lines);
    }

    lines.join("\n")
}

#[derive(serde::Serialize)]
pub struct GenerateResult {
    pub preview_content: String, // Только первые N байт для превью
    pub is_truncated: bool,      // Флаг, что контент обрезан
    pub stats: AppStats,
}

struct ProcessedChunk {
    relative_path: String,
    formatted_content: String,
    original_size: u64,
}

#[tauri::command]
pub async fn generate_markdown(
    output_path: Option<String>,
    config: Option<AppConfig>,
    state: State<'_, Arc<AppState>>,
    app_handle: AppHandle,
) -> Result<GenerateResult, String> {
    let start_time = std::time::Instant::now();

    // Используем переданный конфиг или дефолтный
    let app_config = config.unwrap_or_default();
    log::debug!(
        "Using config: max_file_size={} bytes, template length={}",
        app_config.max_file_size,
        app_config.output_template.len()
    );

    // 1. Подготовка списка файлов (очень быстро, в памяти)
    let (selected_files, tree_structure, root_path) = {
        let nodes_map = state.nodes.lock().map_err(|_| "Failed to lock nodes")?;
        let root_path = state
            .root_path
            .lock()
            .map_err(|_| "Failed to lock root_path")?;
        let root = root_path.as_ref().ok_or("No root path set")?.clone();

        let files: Vec<FileNode> = nodes_map
            .values()
            .filter(|n| {
                // Фильтруем: только файлы, только выбранные, и родители тоже должны быть выбраны
                if n.is_directory || !n.selected {
                    return false;
                }
                if let Some(ref parent_id) = n.parent_id {
                    if let Some(parent) = nodes_map.get(parent_id) {
                        if !parent.selected {
                            return false;
                        }
                    }
                }
                true
            })
            .cloned()
            .collect();

        let tree = build_tree_structure(&nodes_map, &root);
        (files, tree, root)
    };

    let total_files = selected_files.len();
    log::info!("Starting generation for {} files", total_files);

    // Отправляем начальное событие прогресса
    let _ = app_handle.emit(
        "generation-progress",
        ProgressEvent {
            current: 0,
            total: total_files,
            stage: "preparing".to_string(),
        },
    );

    // 2. Если пишем в файл — открываем его сразу (Stream to Disk)
    // Если в буфер обмена — пишем в память (Vec<u8>)
    let mut file_writer = if let Some(ref path) = output_path {
        // Если путь относительный, делаем его относительно root_path
        let full_path = if Path::new(path).is_absolute() {
            PathBuf::from(path)
        } else {
            PathBuf::from(&root_path).join(path)
        };

        log::info!("Creating output file at: {}", full_path.display());
        let file = File::create(&full_path)
            .await
            .map_err(|e| format!("Failed to create file at {}: {}", full_path.display(), e))?;
        Some(BufWriter::new(file))
    } else {
        None
    };

    // ВМЕСТО memory_buffer, который был опциональным, теперь создаем его всегда,
    // чтобы сохранить результат в кэш для последующего копирования
    let mut full_content_buffer = Vec::new();

    // Буфер ТОЛЬКО для превью (ограниченный размер)
    let mut preview_buffer = Vec::new();
    const PREVIEW_LIMIT: usize = 50 * 1024; // 50 KB превью максимум
    let mut is_truncated = false;

    // 3. Записываем заголовок
    let header = format!(
        "# Collected Files\n\n## File Structure\n\n```\n{}\n```\n\n---\n\n",
        tree_structure
    );

    if let Some(w) = file_writer.as_mut() {
        w.write_all(header.as_bytes())
            .await
            .map_err(|e| format!("Failed to write header: {}", e))?;
    }
    // Сохраняем заголовок в полный буфер
    full_content_buffer.extend_from_slice(header.as_bytes());

    // Добавляем заголовок в превью
    let header_bytes = header.as_bytes();
    if preview_buffer.len() + header_bytes.len() <= PREVIEW_LIMIT {
        preview_buffer.extend_from_slice(header_bytes);
    } else {
        let remaining = PREVIEW_LIMIT - preview_buffer.len();
        preview_buffer.extend_from_slice(&header_bytes[..remaining]);
        is_truncated = true;
    }

    // 4. Параллельное чтение и форматирование
    let progress_counter = Arc::new(std::sync::atomic::AtomicUsize::new(0));

    let app_config_clone = app_config.clone();
    let app_handle_clone = app_handle.clone();
    let mut stream = stream::iter(selected_files)
        .map(move |node| {
            let counter = Arc::clone(&progress_counter);
            let handle = app_handle_clone.clone();
            let total = total_files;
            let config = app_config_clone.clone();

            async move {
                let full_path = Path::new(&node.path);

                // Проверяем размер файла перед чтением
                let file_size = match fs::metadata(full_path).await {
                    Ok(meta) => meta.len(),
                    Err(_) => {
                        let relative_path = node.relative_path.clone();
                        log::warn!("Failed to get metadata for {}", node.path);
                        return ProcessedChunk {
                            relative_path: relative_path.clone(),
                            formatted_content: format!("## {}\n\n*Error: Could not read file*\n\n---\n\n", relative_path),
                            original_size: 0,
                        };
                    }
                };

                // Пропускаем файлы, превышающие лимит
                if file_size > config.max_file_size {
                    let relative_path = node.relative_path.clone();
                    log::warn!(
                        "File {} exceeds max_file_size ({} > {}), skipping",
                        node.path,
                        file_size,
                        config.max_file_size
                    );
                    return ProcessedChunk {
                        relative_path: relative_path.clone(),
                        formatted_content: format!(
                            "## {}\n\n*File too large ({} bytes, limit: {} bytes) - skipped*\n\n---\n\n",
                            relative_path,
                            file_size,
                            config.max_file_size
                        ),
                        original_size: file_size,
                    };
                }

                // Читаем файл с безопасной обработкой UTF-8
                let content = match fs::read(full_path).await {
                    Ok(bytes) => {
                        // Проверка на бинарность по содержимому (первые 1KB)
                        if bytes.iter().take(1024).any(|&b| b == 0) {
                            log::warn!("File {} detected as binary during generation", node.path);
                            String::from("*Binary file*")
                        } else {
                            String::from_utf8_lossy(&bytes).to_string()
                        }
                    }
                    Err(_) => String::from("*Error reading file*"),
                };

                let language = get_language_by_extension(&node.relative_path);
                
                // Используем шаблон из конфига
                let mut formatted = config.output_template
                    .replace("{{path}}", &node.relative_path)
                    .replace("{{language}}", language);
                
                // Замена контента (самая тяжелая часть)
                formatted = formatted.replace("{{content}}", &content);

                // Обновляем прогресс каждые 5 файлов или при завершении
                let current = counter.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
                if current % 5 == 0 || current == total {
                    let _ = handle.emit(
                        "generation-progress",
                        ProgressEvent {
                            current,
                            total,
                            stage: "processing".to_string(),
                        },
                    );
                }

                ProcessedChunk {
                    relative_path: node.relative_path,
                    formatted_content: formatted,
                    original_size: node.size.unwrap_or(0),
                }
            }
        })
        .buffer_unordered(50); // Читаем по 50 файлов параллельно

    // 5. Сбор результатов
    let mut chunks = Vec::with_capacity(total_files);
    while let Some(chunk) = stream.next().await {
        chunks.push(chunk);
    }

    // Сортируем, чтобы порядок файлов в MD был детерминированным
    chunks.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));

    // Отправляем событие начала записи
    let _ = app_handle.emit(
        "generation-progress",
        ProgressEvent {
            current: total_files,
            total: total_files,
            stage: "writing".to_string(),
        },
    );

    // 6. Запись на диск одним потоком (очень быстро, так как это уже подготовленные байты)
    let mut total_size = 0u64;
    let mut total_tokens = 0usize;

    // Получаем токены из уже посчитанных значений
    {
        let nodes_map = state.nodes.lock().map_err(|_| "Failed to lock nodes")?;
        for chunk in &chunks {
            if let Some(node) = nodes_map.get(&chunk.relative_path) {
                total_size += chunk.original_size;
                total_tokens += node.token_count.unwrap_or(0);
            }
        }
    }

    for chunk in chunks {
        let chunk_bytes = chunk.formatted_content.as_bytes();

        // Пишем в файл (если надо)
        if let Some(w) = file_writer.as_mut() {
            w.write_all(chunk_bytes)
                .await
                .map_err(|e| format!("Failed to write chunk: {}", e))?;
        }

        // Пишем в полный буфер (для кэша)
        full_content_buffer.extend_from_slice(chunk_bytes);

        // Собираем превью для UI
        if preview_buffer.len() < PREVIEW_LIMIT {
            let remaining = PREVIEW_LIMIT - preview_buffer.len();
            if chunk_bytes.len() > remaining {
                preview_buffer.extend_from_slice(&chunk_bytes[..remaining]);
                is_truncated = true;
            } else {
                preview_buffer.extend_from_slice(chunk_bytes);
            }
        } else {
            is_truncated = true;
        }
    }

    // Сбрасываем буфер на диск
    if let Some(mut w) = file_writer {
        w.flush()
            .await
            .map_err(|e| format!("Failed to flush file: {}", e))?;
    }

    let elapsed = start_time.elapsed();
    log::info!("Generation completed in {:?}", elapsed);

    // Отправляем финальное событие
    let _ = app_handle.emit(
        "generation-progress",
        ProgressEvent {
            current: total_files,
            total: total_files,
            stage: "completed".to_string(),
        },
    );

    // Превращаем полный буфер в строку
    let full_content_string = String::from_utf8_lossy(&full_content_buffer).to_string();

    // СОХРАНЯЕМ В КЭШ STATE
    {
        let mut cache = state
            .last_generated_content
            .lock()
            .map_err(|_| "Lock error")?;
        *cache = Some(full_content_string);
    }

    // Автоматически сохраняем конфиг после успешной генерации
    if let Err(e) = crate::commands::file_ops::save_config(state).await {
        log::warn!("Failed to save config after generation: {}", e);
    } else {
        log::info!("Config saved successfully after generation");
    }

    let preview_string = String::from_utf8_lossy(&preview_buffer).to_string();

    Ok(GenerateResult {
        preview_content: preview_string,
        is_truncated,
        stats: AppStats {
            files: total_files,
            size: total_size,
            tokens: total_tokens,
        },
    })
}

#[tauri::command]
pub async fn get_stats(state: State<'_, std::sync::Arc<AppState>>) -> Result<AppStats, String> {
    log::debug!("Getting statistics");

    // Получаем список файлов, которые нужно обработать
    let files_to_process: Vec<(String, u64, Option<usize>)> = {
        let nodes_map = state.nodes.lock().map_err(|_| "Failed to lock nodes")?;
        nodes_map
            .values()
            .filter(|n| {
                if n.is_directory || !n.selected {
                    return false;
                }
                // Доп проверка родителей
                if let Some(ref parent_id) = n.parent_id {
                    if let Some(parent) = nodes_map.get(parent_id) {
                        return parent.selected;
                    }
                }
                true
            })
            .map(|n| (n.path.clone(), n.size.unwrap_or(0), n.token_count))
            .collect()
    };

    // Разделяем на кэшированные и те, что нужно подсчитать
    let (cached, needs_calc): (Vec<_>, Vec<_>) = files_to_process
        .into_iter()
        .partition(|(_, _, tokens)| tokens.is_some());

    let mut total_stats = AppStats {
        files: 0,
        size: 0,
        tokens: 0,
    };

    // Суммируем кэшированные
    for (_, size, tokens) in cached {
        total_stats.files += 1;
        total_stats.size += size;
        total_stats.tokens += tokens.unwrap_or(0);
    }

    if needs_calc.is_empty() {
        return Ok(total_stats);
    }

    // Считаем токены параллельно только для тех, где их нет
    let calculated_results = stream::iter(needs_calc)
        .map(|(path, size, _)| async move {
            let tokens = match fs::read(&path).await {
                Ok(bytes) => {
                    // Проверка на бинарность
                    if bytes.iter().take(1024).any(|&b| b == 0) {
                        0
                    } else {
                        let content = String::from_utf8_lossy(&bytes);
                        count_tokens(&content)
                    }
                }
                Err(_) => 0,
            };
            (path, size, tokens)
        })
        .buffer_unordered(50) // Параллельная обработка
        .collect::<Vec<_>>()
        .await;

    // Обновляем статистику
    for (_, size, tokens) in calculated_results {
        total_stats.files += 1;
        total_stats.size += size;
        total_stats.tokens += tokens;
    }

    Ok(total_stats)
}

// НОВАЯ КОМАНДА: Копирование из кэша
#[tauri::command]
pub async fn copy_from_cache_to_clipboard(
    state: State<'_, Arc<AppState>>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let content = {
        let cache = state
            .last_generated_content
            .lock()
            .map_err(|_| "Lock error")?;
        cache.clone().ok_or("No content generated yet")?
    };

    // Лимит для буфера обмена (10 МБ)
    const CLIPBOARD_LIMIT_BYTES: usize = 10 * 1024 * 1024;

    if content.len() > CLIPBOARD_LIMIT_BYTES {
        return Err(format!(
            "Content too large for clipboard ({} MB). Maximum size is 10 MB. Please save to file instead.",
            content.len() / (1024 * 1024)
        ));
    }

    app_handle
        .clipboard()
        .write_text(&content)
        .map_err(|e| format!("Failed to write to clipboard: {}", e))?;

    log::info!(
        "Full content copied to clipboard from cache ({} bytes)",
        content.len()
    );
    Ok(())
}
