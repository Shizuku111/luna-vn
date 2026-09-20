use std::process::Command;

use tauri::{AppHandle, Manager, State};

use crate::db::LibraryDb;
use crate::image_cache::{self, ImageCacheRoot};

#[tauri::command]
pub fn clear_library_data(
    db: State<'_, LibraryDb>,
    cache: State<'_, ImageCacheRoot>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|err| err.to_string())?;
    conn.execute_batch(
        r#"
        DELETE FROM game_characters;
        DELETE FROM character_persons;
        DELETE FROM game_persons;
        DELETE FROM game_relations;
        DELETE FROM archived;
        DELETE FROM game_logs;
        DELETE FROM games;
        DELETE FROM characters;
        DELETE FROM persons;
        DELETE FROM sqlite_sequence
          WHERE name IN ('games', 'characters', 'persons', 'game_logs', 'archived');
        "#,
    )
    .map_err(|err| err.to_string())?;
    drop(conn);
    image_cache::clear_all(&cache.0)?;
    Ok(())
}

#[tauri::command]
pub fn clear_image_cache(cache: State<'_, ImageCacheRoot>) -> Result<(), String> {
    image_cache::clear_all(&cache.0)
}

#[tauri::command]
pub fn open_image_cache_dir(cache: State<'_, ImageCacheRoot>) -> Result<(), String> {
    std::fs::create_dir_all(&cache.0).map_err(|err| {
        format!("无法创建缓存目录（{}）：{}", cache.0.display(), err)
    })?;

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&cache.0)
            .spawn()
            .map_err(|err| format!("打开缓存目录失败：{}", err))?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&cache.0)
            .spawn()
            .map_err(|err| format!("打开缓存目录失败：{}", err))?;
        return Ok(());
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(&cache.0)
            .spawn()
            .map_err(|err| format!("打开缓存目录失败：{}", err))?;
        Ok(())
    }
}

#[tauri::command]
pub fn quit_app(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
pub fn show_main_window(app: AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window("main") else {
        return Err("主窗口不存在".to_string());
    };
    let _ = window.unminimize();
    window.show().map_err(|err| format!("显示窗口失败：{}", err))?;
    window
        .set_focus()
        .map_err(|err| format!("聚焦窗口失败：{}", err))?;
    Ok(())
}
