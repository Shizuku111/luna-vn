use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, State};

use crate::db::{chrono_like_now, LibraryDb};

mod cover;
mod meta;
pub mod relations;
use cover::{
    attach_cover_path, finalize_game_cover, find_game_cover,
    install_cover_from_path, new_local_cover_stem, relocate_local_cover, remove_local_covers,
    remove_luna_vn_dir,
};
use meta::write_launch_meta;

pub struct BatchImportScanControl {
    pub cancel: AtomicBool,
}

impl Default for BatchImportScanControl {
    fn default() -> Self {
        Self {
            cancel: AtomicBool::new(false),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveLibraryGameInput {
    pub bangumi_id: i64,
    #[serde(rename = "type")]
    pub subject_type: i32,
    pub name: String,
    pub name_cn: String,
    pub summary: Option<String>,
    pub date: Option<String>,
    pub image: Option<String>,
    pub images: Option<serde_json::Value>,
    pub score: Option<f64>,
    pub rank: Option<i64>,
    pub tags: Vec<String>,
    pub nsfw: Option<bool>,
    pub infobox: Option<serde_json::Value>,
    pub launch_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveManualLibraryGameInput {
    pub bangumi_id: Option<i64>,
    pub name: String,
    pub name_cn: String,
    pub launch_path: String,
    pub cover_source_path: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateLibraryGameSubject {
    #[serde(rename = "type")]
    pub subject_type: i32,
    pub summary: Option<String>,
    pub date: Option<String>,
    pub image: Option<String>,
    pub images: Option<serde_json::Value>,
    pub score: Option<f64>,
    pub rank: Option<i64>,
    pub tags: Vec<String>,
    pub nsfw: Option<bool>,
    pub infobox: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateLibraryGameInput {
    pub id: i64,
    pub bangumi_id: i64,
    pub name: String,
    pub name_cn: String,
    pub launch_path: String,
    pub cover_source_path: Option<String>,
    pub subject: Option<UpdateLibraryGameSubject>,
    pub update_cover: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedLibraryGame {
    pub id: i64,
    pub bangumi_id: i64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LibraryGame {
    pub id: i64,
    pub bangumi_id: i64,
    #[serde(rename = "type")]
    pub subject_type: i32,
    pub name: String,
    pub name_cn: String,
    pub summary: Option<String>,
    pub date: Option<String>,
    pub image: Option<String>,
    pub images: Option<serde_json::Value>,
    pub score: Option<f64>,
    pub rank: Option<i64>,
    pub tags: Vec<String>,
    pub nsfw: bool,
    pub infobox: Option<serde_json::Value>,
    pub launch_path: String,
    pub status: i32,
    pub region_launch: bool,
    pub favorite: bool,
    pub wishlist: bool,
    pub last_launched_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub cover_path: Option<String>,
    pub cover_thumb_path: Option<String>,
    pub archived: Option<LibraryGameArchive>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LibraryGameArchive {
    pub id: i64,
    pub tag: String,
    pub created_at: String,
}

pub(crate) fn map_game_row_at(row: &Row<'_>, offset: usize) -> rusqlite::Result<LibraryGame> {
    let tags_raw: String = row.get(offset + 11)?;
    let images_raw: Option<String> = row.get(offset + 8)?;
    let infobox_raw: Option<String> = row.get(offset + 13)?;
    let nsfw: i64 = row.get(offset + 12)?;

    Ok(LibraryGame {
        id: row.get(offset)?,
        bangumi_id: row.get(offset + 1)?,
        subject_type: row.get(offset + 2)?,
        name: row.get(offset + 3)?,
        name_cn: row.get(offset + 4)?,
        summary: row.get(offset + 5)?,
        date: row.get(offset + 6)?,
        image: row.get(offset + 7)?,
        images: images_raw.and_then(|value| serde_json::from_str(&value).ok()),
        score: row.get(offset + 9)?,
        rank: row.get(offset + 10)?,
        tags: serde_json::from_str(&tags_raw).unwrap_or_default(),
        nsfw: nsfw != 0,
        infobox: infobox_raw.and_then(|value| serde_json::from_str(&value).ok()),
        launch_path: row.get(offset + 14)?,
        status: row.get(offset + 15)?,
        region_launch: {
            let value: i64 = row.get(offset + 16)?;
            value != 0
        },
        favorite: {
            let value: i64 = row.get(offset + 17)?;
            value != 0
        },
        wishlist: {
            let value: i64 = row.get(offset + 18)?;
            value != 0
        },
        last_launched_at: row.get(offset + 19)?,
        created_at: row.get(offset + 20)?,
        updated_at: row.get(offset + 21)?,
        cover_path: None,
        cover_thumb_path: None,
        archived: None,
    })
}

fn map_game_row(row: &Row<'_>) -> rusqlite::Result<LibraryGame> {
    map_game_row_at(row, 0)
}

const GAME_SELECT_SQL: &str = concat!(
    "SELECT ",
    "id, bangumi_id, type, name, name_cn, summary, date, image, images, ",
    "score, rank, tags, nsfw, infobox, launch_path, status, region_launch, ",
    "favorite, wishlist, last_launched_at, created_at, updated_at ",
    "FROM games"
);

fn fetch_game_row_by_bangumi_id(
    conn: &Connection,
    bangumi_id: i64,
) -> Result<LibraryGame, String> {
    conn.query_row(
        &format!("{GAME_SELECT_SQL} WHERE bangumi_id = ?1"),
        params![bangumi_id],
        map_game_row,
    )
    .map_err(|err| err.to_string())
}

fn fetch_game_by_bangumi_id(
    conn: &Connection,
    bangumi_id: i64,
) -> Result<LibraryGame, String> {
    Ok(attach_cover_path(fetch_game_row_by_bangumi_id(
        conn, bangumi_id,
    )?))
}

fn fetch_game_row_by_id(conn: &Connection, id: i64) -> Result<LibraryGame, String> {
    let game = conn
        .query_row(
            &format!("{GAME_SELECT_SQL} WHERE id = ?1"),
            params![id],
            map_game_row,
        )
        .map_err(|_| "游戏不存在".to_string())?;
    attach_archive(conn, game)
}

const GAME_LOG_ACTION_IMPORT: &str = "import";
const GAME_LOG_ACTION_OPEN: &str = "open";
const GAME_LOG_ACTION_FAVORITE: &str = "favorite";
const GAME_LOG_ACTION_UNFAVORITE: &str = "unfavorite";
const GAME_LOG_ACTION_WISHLIST: &str = "wishlist";
const GAME_LOG_ACTION_UNWISHLIST: &str = "unwishlist";
const GAME_LOG_ACTION_STATUS_NOT_STARTED: &str = "status_not_started";
const GAME_LOG_ACTION_STATUS_PLAYING: &str = "status_playing";
const GAME_LOG_ACTION_STATUS_FINISHED: &str = "status_finished";
const GAME_LOG_ACTION_STATUS_ON_HOLD: &str = "status_on_hold";
const GAME_LOG_ACTION_STATUS_DROPPED: &str = "status_dropped";
const GAME_LOG_ACTION_ARCHIVE: &str = "archive";
const GAME_LOG_ACTION_UNARCHIVE: &str = "unarchive";
const EVENT_GAME_LOGS_CHANGED: &str = "game-logs-changed";

fn map_archive_row(row: &Row<'_>) -> rusqlite::Result<LibraryGameArchive> {
    Ok(LibraryGameArchive {
        id: row.get(0)?,
        tag: row.get(1)?,
        created_at: row.get(2)?,
    })
}

fn fetch_archive_for_game(
    conn: &Connection,
    game_id: i64,
) -> Result<Option<LibraryGameArchive>, String> {
    let mut stmt = conn
        .prepare("SELECT id, tag, created_at FROM archived WHERE game_id = ?1 LIMIT 1")
        .map_err(|err| err.to_string())?;
    let mut rows = stmt
        .query(params![game_id])
        .map_err(|err| err.to_string())?;
    match rows.next().map_err(|err| err.to_string())? {
        Some(row) => Ok(Some(map_archive_row(row).map_err(|err| err.to_string())?)),
        None => Ok(None),
    }
}

pub(crate) fn attach_archive(
    conn: &Connection,
    mut game: LibraryGame,
) -> Result<LibraryGame, String> {
    game.archived = fetch_archive_for_game(conn, game.id)?;
    Ok(game)
}

fn attach_archives(
    conn: &Connection,
    mut games: Vec<LibraryGame>,
) -> Result<Vec<LibraryGame>, String> {
    if games.is_empty() {
        return Ok(games);
    }

    let mut stmt = conn
        .prepare("SELECT id, game_id, tag, created_at FROM archived")
        .map_err(|err| err.to_string())?;
    let mapped = stmt
        .query_map([], |row| {
            let game_id: i64 = row.get(1)?;
            Ok((
                game_id,
                LibraryGameArchive {
                    id: row.get(0)?,
                    tag: row.get(2)?,
                    created_at: row.get(3)?,
                },
            ))
        })
        .map_err(|err| err.to_string())?;

    let mut archives = HashMap::new();
    for row in mapped {
        let (game_id, archive) = row.map_err(|err| err.to_string())?;
        archives.insert(game_id, archive);
    }

    for game in &mut games {
        game.archived = archives.remove(&game.id);
    }
    Ok(games)
}

fn game_status_log_action(status: i32) -> Option<&'static str> {
    match status {
        0 => Some(GAME_LOG_ACTION_STATUS_NOT_STARTED),
        1 => Some(GAME_LOG_ACTION_STATUS_PLAYING),
        2 => Some(GAME_LOG_ACTION_STATUS_FINISHED),
        3 => Some(GAME_LOG_ACTION_STATUS_ON_HOLD),
        4 => Some(GAME_LOG_ACTION_STATUS_DROPPED),
        _ => None,
    }
}

fn notify_game_logs_changed(app: &AppHandle) {
    let _ = app.emit(EVENT_GAME_LOGS_CHANGED, ());
}

fn insert_game_log(
    conn: &Connection,
    game_id: i64,
    bangumi_id: i64,
    action: &str,
    session_id: Option<&str>,
) -> Result<(), String> {
    let now = chrono_like_now();
    conn.execute(
        r#"
        INSERT INTO game_logs (game_id, bangumi_id, action, session_id, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5)
        "#,
        params![game_id, bangumi_id, action, session_id, now],
    )
    .map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn save_library_game(
    app: AppHandle,
    db: State<'_, LibraryDb>,
    game: SaveLibraryGameInput,
) -> Result<SavedLibraryGame, String> {
    let conn = db.0.lock().map_err(|err| err.to_string())?;
    let existed_before: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM games WHERE bangumi_id = ?1)",
            params![game.bangumi_id],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())?;
    if existed_before {
        return Err("当前游戏已存在于游戏库中".to_string());
    }
    let now = chrono_like_now();
    let tags_json = serde_json::to_string(&game.tags).map_err(|err| err.to_string())?;
    let images_json = game
        .images
        .as_ref()
        .map(serde_json::to_string)
        .transpose()
        .map_err(|err| err.to_string())?;
    let infobox_json = game
        .infobox
        .as_ref()
        .map(serde_json::to_string)
        .transpose()
        .map_err(|err| err.to_string())?;
    let nsfw = if game.nsfw.unwrap_or(false) { 1 } else { 0 };

    conn.execute(
        r#"
        INSERT INTO games (
          bangumi_id, type, name, name_cn, summary, date, image, images,
          score, rank, tags, nsfw, infobox, launch_path, status, created_at, updated_at
        ) VALUES (
          ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8,
          ?9, ?10, ?11, ?12, ?13, ?14, 0, ?15, ?16
        )
        "#,
        params![
            game.bangumi_id,
            game.subject_type,
            game.name,
            game.name_cn,
            game.summary,
            game.date,
            game.image,
            images_json,
            game.score,
            game.rank,
            tags_json,
            nsfw,
            infobox_json,
            game.launch_path,
            now,
            now,
        ],
    )
    .map_err(|err| {
        let message = err.to_string();
        if message.contains("UNIQUE") || message.contains("unique") {
            "当前游戏已存在于游戏库中".to_string()
        } else {
            message
        }
    })?;

    let saved_game = fetch_game_by_bangumi_id(&conn, game.bangumi_id)?;
    insert_game_log(
        &conn,
        saved_game.id,
        saved_game.bangumi_id,
        GAME_LOG_ACTION_IMPORT,
        None,
    )?;
    let game_id = saved_game.id;
    let launch_path = saved_game.launch_path.clone();
    drop(conn);
    notify_game_logs_changed(&app);

    let saved_game = finalize_game_cover(saved_game);
    if let Err(err) = write_launch_meta(&saved_game) {
        cleanup_failed_new_import(&db, game_id, saved_game.bangumi_id, &launch_path);
        return Err(err);
    }

    Ok(SavedLibraryGame {
        id: saved_game.id,
        bangumi_id: saved_game.bangumi_id,
    })
}

fn next_manual_bangumi_id(conn: &Connection) -> Result<i64, String> {
    let min_negative: Option<i64> = conn
        .query_row(
            "SELECT MIN(bangumi_id) FROM games WHERE bangumi_id < 0",
            [],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())?;
    Ok(min_negative.map(|value| value - 1).unwrap_or(-1))
}

#[tauri::command]
pub fn save_manual_library_game(
    app: AppHandle,
    db: State<'_, LibraryDb>,
    game: SaveManualLibraryGameInput,
) -> Result<SavedLibraryGame, String> {
    let name = game.name.trim();
    let name_cn = game.name_cn.trim();
    if name.is_empty() && name_cn.is_empty() {
        return Err("请填写游戏名".to_string());
    }
    let launch_path = game.launch_path.trim();
    if launch_path.is_empty() {
        return Err("请选择启动程序".to_string());
    }

    let conn = db.0.lock().map_err(|err| err.to_string())?;
    let bangumi_id = match game.bangumi_id {
        Some(id) if id > 0 => id,
        Some(id) if id < 0 => {
            let exists: bool = conn
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM games WHERE bangumi_id = ?1)",
                    params![id],
                    |row| row.get(0),
                )
                .map_err(|err| err.to_string())?;
            if exists {
                return Err("该 Bangumi ID 已存在于游戏库中".to_string());
            }
            id
        }
        _ => next_manual_bangumi_id(&conn)?,
    };

    if bangumi_id > 0 {
        let exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM games WHERE bangumi_id = ?1)",
                params![bangumi_id],
                |row| row.get(0),
            )
            .map_err(|err| err.to_string())?;
        if exists {
            return Err("该 Bangumi ID 已存在于游戏库中".to_string());
        }
    }

    let now = chrono_like_now();
    let resolved_name = if name.is_empty() { name_cn } else { name };

    conn.execute(
        r#"
        INSERT INTO games (
          bangumi_id, type, name, name_cn, summary, date, image, images,
          score, rank, tags, nsfw, infobox, launch_path, status, created_at, updated_at
        ) VALUES (
          ?1, 4, ?2, ?3, NULL, NULL, NULL, NULL,
          NULL, NULL, "[]", 0, NULL, ?4, 0, ?5, ?6
        )
        "#,
        params![
            bangumi_id,
            resolved_name,
            name_cn,
            launch_path,
            now,
            now,
        ],
    )
    .map_err(|err| {
        let message = err.to_string();
        if message.contains("UNIQUE") || message.contains("unique") {
            "该 Bangumi ID 已存在于游戏库中".to_string()
        } else {
            message
        }
    })?;

    let mut saved_game = fetch_game_by_bangumi_id(&conn, bangumi_id)?;
    insert_game_log(
        &conn,
        saved_game.id,
        saved_game.bangumi_id,
        GAME_LOG_ACTION_IMPORT,
        None,
    )?;
    let game_id = saved_game.id;
    let bangumi_id = saved_game.bangumi_id;
    let launch_path = saved_game.launch_path.clone();
    drop(conn);
    notify_game_logs_changed(&app);

    let finish = (|| -> Result<LibraryGame, String> {
        if let Some(source) = game
            .cover_source_path
            .as_ref()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
        {
            remove_local_covers(saved_game.bangumi_id);
            if let Some((dir, stem)) = new_local_cover_stem(saved_game.bangumi_id) {
                install_cover_from_path(source, &dir, &stem)?;
            }
        }

        saved_game = attach_cover_path(saved_game);
        write_launch_meta(&saved_game)?;
        Ok(saved_game)
    })();

    let saved_game = match finish {
        Ok(game) => game,
        Err(err) => {
            cleanup_failed_new_import(&db, game_id, bangumi_id, &launch_path);
            return Err(err);
        }
    };

    Ok(SavedLibraryGame {
        id: saved_game.id,
        bangumi_id: saved_game.bangumi_id,
    })
}

#[tauri::command]
pub fn update_library_game(
    db: State<'_, LibraryDb>,
    game: UpdateLibraryGameInput,
) -> Result<LibraryGame, String> {
    if game.bangumi_id == 0 {
        return Err("Bangumi ID 无效".to_string());
    }
    let name = game.name.trim();
    let name_cn = game.name_cn.trim();
    if name.is_empty() && name_cn.is_empty() {
        return Err("请至少填写一个名称".to_string());
    }
    let launch_path = game.launch_path.trim();
    if launch_path.is_empty() {
        return Err("请选择启动程序".to_string());
    }

    let conn = db.0.lock().map_err(|err| err.to_string())?;
    let previous = conn
        .query_row(
            &format!("{GAME_SELECT_SQL} WHERE id = ?1"),
            params![game.id],
            map_game_row,
        )
        .map_err(|_| "游戏不存在".to_string())?;

    let now = chrono_like_now();
    let resolved_name = if name.is_empty() { name_cn } else { name };
    let replace_subject = game.subject.is_some();

    let updated = if let Some(subject) = game.subject.as_ref() {
        let tags_json = serde_json::to_string(&subject.tags).map_err(|err| err.to_string())?;
        let images_json = subject
            .images
            .as_ref()
            .map(serde_json::to_string)
            .transpose()
            .map_err(|err| err.to_string())?;
        let infobox_json = subject
            .infobox
            .as_ref()
            .map(serde_json::to_string)
            .transpose()
            .map_err(|err| err.to_string())?;
        let nsfw = if subject.nsfw.unwrap_or(false) { 1 } else { 0 };

        conn.execute(
            r#"
            UPDATE games
            SET bangumi_id = ?1,
                type = ?2,
                name = ?3,
                name_cn = ?4,
                summary = ?5,
                date = ?6,
                image = ?7,
                images = ?8,
                score = ?9,
                rank = ?10,
                tags = ?11,
                nsfw = ?12,
                infobox = ?13,
                launch_path = ?14,
                updated_at = ?15
            WHERE id = ?16
            "#,
            params![
                game.bangumi_id,
                subject.subject_type,
                resolved_name,
                name_cn,
                subject.summary,
                subject.date,
                subject.image,
                images_json,
                subject.score,
                subject.rank,
                tags_json,
                nsfw,
                infobox_json,
                launch_path,
                now,
                game.id,
            ],
        )
    } else {
        conn.execute(
            r#"
            UPDATE games
            SET bangumi_id = ?1,
                name = ?2,
                name_cn = ?3,
                launch_path = ?4,
                updated_at = ?5
            WHERE id = ?6
            "#,
            params![
                game.bangumi_id,
                resolved_name,
                name_cn,
                launch_path,
                now,
                game.id,
            ],
        )
    }
    .map_err(|err| {
        let message = err.to_string();
        if message.contains("UNIQUE") || message.contains("unique") {
            "该 Bangumi ID 已存在于游戏库中".to_string()
        } else {
            message
        }
    })?;

    if updated == 0 {
        return Err("游戏不存在".to_string());
    }

    let previous_bangumi_id = previous.bangumi_id;
    let mut saved_game = conn
        .query_row(
            &format!("{GAME_SELECT_SQL} WHERE id = ?1"),
            params![game.id],
            map_game_row,
        )
        .map_err(|_| "游戏不存在".to_string())?;
    saved_game = attach_archive(&conn, saved_game)?;
    drop(conn);

    if let Some(source) = game
        .cover_source_path
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        remove_local_covers(saved_game.bangumi_id);
        if previous_bangumi_id != saved_game.bangumi_id {
            remove_local_covers(previous_bangumi_id);
        }
        if let Some((dir, stem)) = new_local_cover_stem(saved_game.bangumi_id) {
            install_cover_from_path(source, &dir, &stem)?;
        }
    } else if game.update_cover.unwrap_or(false) {
        remove_local_covers(previous_bangumi_id);
        if previous_bangumi_id != saved_game.bangumi_id {
            remove_local_covers(saved_game.bangumi_id);
        }
    } else if previous_bangumi_id != saved_game.bangumi_id {
        if replace_subject {
            remove_local_covers(previous_bangumi_id);
            remove_local_covers(saved_game.bangumi_id);
        } else {
            relocate_local_cover(previous_bangumi_id, saved_game.bangumi_id);
        }
    }

    saved_game = finalize_game_cover(saved_game);
    write_launch_meta(&saved_game)?;
    Ok(saved_game)
}

fn list_library_game_rows(db: &LibraryDb) -> Result<Vec<LibraryGame>, String> {
    let conn = db.0.lock().map_err(|err| err.to_string())?;
    let mut stmt = conn
        .prepare(&format!(
            "{GAME_SELECT_SQL} ORDER BY CAST(created_at AS INTEGER) DESC, id DESC"
        ))
        .map_err(|err| err.to_string())?;

    let rows = stmt
        .query_map([], map_game_row)
        .map_err(|err| err.to_string())?;

    let mut list = Vec::new();
    for row in rows {
        list.push(row.map_err(|err| err.to_string())?);
    }
    attach_archives(&conn, list)
}

#[tauri::command]
pub fn list_library_games(db: State<'_, LibraryDb>) -> Result<Vec<LibraryGame>, String> {
    let games = list_library_game_rows(&db)?;
    Ok(games.into_iter().map(attach_cover_path).collect())
}

#[tauri::command]
pub fn list_library_games_basic(db: State<'_, LibraryDb>) -> Result<Vec<LibraryGame>, String> {
    list_library_game_rows(&db)
}

#[tauri::command]
pub fn get_library_game(db: State<'_, LibraryDb>, id: i64) -> Result<LibraryGame, String> {
    let game = {
        let conn = db.0.lock().map_err(|err| err.to_string())?;
        fetch_game_row_by_id(&conn, id)?
    };
    Ok(attach_cover_path(game))
}

#[tauri::command]
pub fn ensure_library_game_cover(db: State<'_, LibraryDb>, id: i64) -> Result<LibraryGame, String> {
    let game = {
        let conn = db.0.lock().map_err(|err| err.to_string())?;
        fetch_game_row_by_id(&conn, id)?
    };
    Ok(finalize_game_cover(game))
}

#[tauri::command]
pub fn update_library_game_status(
    app: AppHandle,
    db: State<'_, LibraryDb>,
    id: i64,
    status: i32,
) -> Result<LibraryGame, String> {
    if !(0..=4).contains(&status) {
        return Err("无效的游戏状态".to_string());
    }

    let game = {
        let conn = db.0.lock().map_err(|err| err.to_string())?;
        let previous: i32 = conn
            .query_row(
                "SELECT status FROM games WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .map_err(|_| "游戏不存在".to_string())?;

        let now = chrono_like_now();
        let updated = conn
            .execute(
                "UPDATE games SET status = ?1, updated_at = ?2 WHERE id = ?3",
                params![status, now, id],
            )
            .map_err(|err| err.to_string())?;

        if updated == 0 {
            return Err("游戏不存在".to_string());
        }

        let game = fetch_game_row_by_id(&conn, id)?;
        if previous != status {
            if let Some(action) = game_status_log_action(status) {
                insert_game_log(&conn, game.id, game.bangumi_id, action, None)?;
                notify_game_logs_changed(&app);
            }
        }
        game
    };
    let _ = write_launch_meta(&game);
    Ok(attach_cover_path(game))
}

#[tauri::command]
pub fn update_library_game_region_launch(
    db: State<'_, LibraryDb>,
    id: i64,
    region_launch: bool,
) -> Result<LibraryGame, String> {
    let game = {
        let conn = db.0.lock().map_err(|err| err.to_string())?;
        let now = chrono_like_now();
        let value = if region_launch { 1 } else { 0 };
        let updated = conn
            .execute(
                "UPDATE games SET region_launch = ?1, updated_at = ?2 WHERE id = ?3",
                params![value, now, id],
            )
            .map_err(|err| err.to_string())?;

        if updated == 0 {
            return Err("游戏不存在".to_string());
        }

        fetch_game_row_by_id(&conn, id)?
    };
    let _ = write_launch_meta(&game);
    Ok(attach_cover_path(game))
}

#[tauri::command]
pub fn update_library_game_favorite(
    app: AppHandle,
    db: State<'_, LibraryDb>,
    id: i64,
    favorite: bool,
) -> Result<LibraryGame, String> {
    let game = {
        let conn = db.0.lock().map_err(|err| err.to_string())?;
        let now = chrono_like_now();
        let value = if favorite { 1 } else { 0 };
        let updated = conn
            .execute(
                "UPDATE games SET favorite = ?1, updated_at = ?2 WHERE id = ?3",
                params![value, now, id],
            )
            .map_err(|err| err.to_string())?;

        if updated == 0 {
            return Err("游戏不存在".to_string());
        }

        let game = fetch_game_row_by_id(&conn, id)?;
        let action = if favorite {
            GAME_LOG_ACTION_FAVORITE
        } else {
            GAME_LOG_ACTION_UNFAVORITE
        };
        insert_game_log(&conn, game.id, game.bangumi_id, action, None)?;
        notify_game_logs_changed(&app);
        game
    };
    let _ = write_launch_meta(&game);
    Ok(attach_cover_path(game))
}

#[tauri::command]
pub fn update_library_game_wishlist(
    app: AppHandle,
    db: State<'_, LibraryDb>,
    id: i64,
    wishlist: bool,
) -> Result<LibraryGame, String> {
    let game = {
        let conn = db.0.lock().map_err(|err| err.to_string())?;
        let now = chrono_like_now();
        let value = if wishlist { 1 } else { 0 };
        let updated = conn
            .execute(
                "UPDATE games SET wishlist = ?1, updated_at = ?2 WHERE id = ?3",
                params![value, now, id],
            )
            .map_err(|err| err.to_string())?;

        if updated == 0 {
            return Err("游戏不存在".to_string());
        }

        let game = fetch_game_row_by_id(&conn, id)?;
        let action = if wishlist {
            GAME_LOG_ACTION_WISHLIST
        } else {
            GAME_LOG_ACTION_UNWISHLIST
        };
        insert_game_log(&conn, game.id, game.bangumi_id, action, None)?;
        notify_game_logs_changed(&app);
        game
    };
    let _ = write_launch_meta(&game);
    Ok(attach_cover_path(game))
}

#[tauri::command]
pub fn archive_library_game(
    app: AppHandle,
    db: State<'_, LibraryDb>,
    id: i64,
    tag: Option<String>,
) -> Result<LibraryGame, String> {
    let tag = tag.unwrap_or_default().trim().to_string();
    let game = {
        let conn = db.0.lock().map_err(|err| err.to_string())?;
        let exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM archived WHERE game_id = ?1)",
                params![id],
                |row| row.get(0),
            )
            .map_err(|err| err.to_string())?;
        if exists {
            return Err("游戏已归档".to_string());
        }

        let game = fetch_game_row_by_id(&conn, id)?;
        let now = chrono_like_now();
        conn.execute(
            r#"
            INSERT INTO archived (game_id, tag, created_at)
            VALUES (?1, ?2, ?3)
            "#,
            params![id, tag, now],
        )
        .map_err(|err| err.to_string())?;
        insert_game_log(
            &conn,
            game.id,
            game.bangumi_id,
            GAME_LOG_ACTION_ARCHIVE,
            None,
        )?;
        notify_game_logs_changed(&app);
        attach_archive(&conn, game)?
    };
    Ok(attach_cover_path(game))
}

#[tauri::command]
pub fn unarchive_library_game(
    app: AppHandle,
    db: State<'_, LibraryDb>,
    id: i64,
) -> Result<LibraryGame, String> {
    let game = {
        let conn = db.0.lock().map_err(|err| err.to_string())?;
        let game = fetch_game_row_by_id(&conn, id)?;
        let deleted = conn
            .execute("DELETE FROM archived WHERE game_id = ?1", params![id])
            .map_err(|err| err.to_string())?;
        if deleted == 0 {
            return Err("游戏未归档".to_string());
        }
        insert_game_log(
            &conn,
            game.id,
            game.bangumi_id,
            GAME_LOG_ACTION_UNARCHIVE,
            None,
        )?;
        notify_game_logs_changed(&app);
        attach_archive(&conn, game)?
    };
    Ok(attach_cover_path(game))
}

#[tauri::command]
pub fn list_recent_archive_tags(
    db: State<'_, LibraryDb>,
    limit: Option<i64>,
) -> Result<Vec<String>, String> {
    let limit = limit.unwrap_or(5).clamp(1, 20) as usize;
    let conn = db.0.lock().map_err(|err| err.to_string())?;
    let mut stmt = conn
        .prepare(
            r#"
            SELECT tag
            FROM archived
            WHERE TRIM(tag) != ''
            ORDER BY CAST(created_at AS INTEGER) DESC, id DESC
            "#,
        )
        .map_err(|err| err.to_string())?;
    let mapped = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|err| err.to_string())?;

    let mut tags = Vec::new();
    let mut seen = HashSet::new();
    for row in mapped {
        let tag = row.map_err(|err| err.to_string())?;
        let tag = tag.trim();
        if tag.is_empty() || !seen.insert(tag.to_string()) {
            continue;
        }
        tags.push(tag.to_string());
        if tags.len() >= limit {
            break;
        }
    }
    Ok(tags)
}

#[tauri::command]
pub fn launch_library_game(
    app: AppHandle,
    db: State<'_, LibraryDb>,
    id: i64,
    le_path: Option<String>,
) -> Result<LibraryGame, String> {
    let game = {
        let conn = db.0.lock().map_err(|err| err.to_string())?;
        fetch_game_row_by_id(&conn, id)?
    };

    let launch = std::path::Path::new(&game.launch_path);
    if !launch.is_file() {
        return Err("启动程序不存在".to_string());
    }

    let cwd = launch
        .parent()
        .filter(|dir| !dir.as_os_str().is_empty())
        .unwrap_or_else(|| std::path::Path::new("."))
        .to_path_buf();

    let use_region_launch = game.region_launch;
    let le_path = le_path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);

    let _child = if use_region_launch {
        let Some(le_path) = le_path else {
            return Err("转区启动已开启，请先配置 Locale Emulator".to_string());
        };
        let le = std::path::Path::new(&le_path);
        if !le.is_file() {
            return Err("Locale Emulator 程序不存在".to_string());
        }

        std::process::Command::new(le)
            .arg(launch)
            .current_dir(&cwd)
            .spawn()
            .map_err(|err| format!("转区启动失败：{}", err))?
    } else {
        std::process::Command::new(launch)
            .current_dir(&cwd)
            .spawn()
            .map_err(|err| format!("启动失败：{}", err))?
    };

    let updated = {
        let conn = db.0.lock().map_err(|err| err.to_string())?;
        insert_game_log(
            &conn,
            game.id,
            game.bangumi_id,
            GAME_LOG_ACTION_OPEN,
            None,
        )?;

        let now = chrono_like_now();
        conn.execute(
            "UPDATE games SET last_launched_at = ?1, updated_at = ?1 WHERE id = ?2",
            params![now, id],
        )
        .map_err(|err| err.to_string())?;

        fetch_game_row_by_id(&conn, id)?
    };
    notify_game_logs_changed(&app);

    let _ = write_launch_meta(&updated);
    Ok(attach_cover_path(updated))
}

#[tauri::command]
pub fn reveal_library_game(path: String) -> Result<(), String> {
    let launch = std::path::Path::new(&path);
    if !launch.exists() {
        return Err("启动程序不存在".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;

        std::process::Command::new("explorer")
            .raw_arg(format!("/select,\"{}\"", path))
            .spawn()
            .map_err(|err| format!("打开文件夹失败：{}", err))?;
        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    {
        let folder = launch
            .parent()
            .filter(|dir| !dir.as_os_str().is_empty())
            .ok_or_else(|| "无法解析所在文件夹".to_string())?;

        #[cfg(target_os = "macos")]
        {
            let _ = folder;
            std::process::Command::new("open")
                .args(["-R", &path])
                .spawn()
                .map_err(|err| format!("打开文件夹失败：{}", err))?;
            return Ok(());
        }

        #[cfg(not(target_os = "macos"))]
        {
            std::process::Command::new("xdg-open")
                .arg(folder)
                .spawn()
                .map_err(|err| format!("打开文件夹失败：{}", err))?;
            return Ok(());
        }
    }
}

#[tauri::command]
pub fn delete_library_game(db: State<'_, LibraryDb>, id: i64) -> Result<(), String> {
    let mut conn = db.0.lock().map_err(|err| err.to_string())?;

    let (launch_path, bangumi_id): (String, i64) = conn
        .query_row(
            "SELECT launch_path, bangumi_id FROM games WHERE id = ?1",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "游戏不存在".to_string())?;

    let tx = conn.transaction().map_err(|err| err.to_string())?;

    tx.execute(
        "DELETE FROM game_characters WHERE game_id = ?1",
        params![id],
    )
    .map_err(|err| err.to_string())?;
    tx.execute("DELETE FROM game_persons WHERE game_id = ?1", params![id])
        .map_err(|err| err.to_string())?;

    let removed = tx
        .execute("DELETE FROM games WHERE id = ?1", params![id])
        .map_err(|err| err.to_string())?;
    if removed == 0 {
        return Err("游戏不存在".to_string());
    }

    tx.commit().map_err(|err| err.to_string())?;

    remove_local_covers(bangumi_id);
    remove_luna_vn_dir(&launch_path);
    Ok(())
}

fn cleanup_failed_new_import(
    db: &LibraryDb,
    game_id: i64,
    bangumi_id: i64,
    launch_path: &str,
) {
    remove_local_covers(bangumi_id);
    remove_luna_vn_dir(launch_path);
    let Ok(mut conn) = db.0.lock() else {
        return;
    };
    let Ok(tx) = conn.transaction() else {
        return;
    };
    let _ = tx.execute(
        "DELETE FROM game_characters WHERE game_id = ?1",
        params![game_id],
    );
    let _ = tx.execute("DELETE FROM game_persons WHERE game_id = ?1", params![game_id]);
    let _ = tx.execute("DELETE FROM games WHERE id = ?1", params![game_id]);
    let _ = tx.commit();
}

fn read_folder_meta_bangumi_id(folder: &std::path::Path) -> Option<i64> {
    let meta_path = folder.join(".LunaVN").join("meta.json");
    let content = std::fs::read_to_string(meta_path).ok()?;
    let value: serde_json::Value = serde_json::from_str(&content).ok()?;
    value.get("bangumiId").and_then(|v| v.as_i64())
}

fn load_library_bangumi_ids(conn: &Connection) -> Result<HashSet<i64>, String> {
    let mut stmt = conn
        .prepare("SELECT bangumi_id FROM games")
        .map_err(|err| err.to_string())?;
    let rows = stmt
        .query_map([], |row| row.get::<_, i64>(0))
        .map_err(|err| err.to_string())?;

    let mut ids = HashSet::new();
    for row in rows {
        ids.insert(row.map_err(|err| err.to_string())?);
    }
    Ok(ids)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchImportScanItem {
    pub folder_name: String,
    pub folder_path: String,
    pub exe_paths: Vec<String>,
}

#[tauri::command]
pub fn cancel_batch_import_scan(scan: State<'_, BatchImportScanControl>) {
    scan.cancel.store(true, Ordering::SeqCst);
}

#[tauri::command]
pub fn scan_batch_import_root(
    root_path: String,
    db: State<'_, LibraryDb>,
    scan: State<'_, BatchImportScanControl>,
) -> Result<Vec<BatchImportScanItem>, String> {
    scan.cancel.store(false, Ordering::SeqCst);

    let root = std::path::Path::new(root_path.trim());
    if !root.is_dir() {
        return Err("根文件夹不存在或不可用".to_string());
    }

    let library_bangumi_ids = {
        let conn = db.0.lock().map_err(|err| err.to_string())?;
        load_library_bangumi_ids(&conn)?
    };

    let mut items: Vec<BatchImportScanItem> = Vec::new();
    let entries = std::fs::read_dir(root).map_err(|err| {
        format!("读取根文件夹失败（{}）：{}", root.display(), err)
    })?;

    for entry in entries.flatten() {
        if scan.cancel.load(Ordering::SeqCst) {
            return Err("扫描已取消".to_string());
        }

        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let Some(folder_name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        if folder_name.starts_with('.') {
            continue;
        }

        if let Some(bangumi_id) = read_folder_meta_bangumi_id(&path) {
            if library_bangumi_ids.contains(&bangumi_id) {
                continue;
            }
        }

        let mut exe_paths: Vec<String> = Vec::new();
        if let Ok(child_entries) = std::fs::read_dir(&path) {
            for child in child_entries.flatten() {
                if scan.cancel.load(Ordering::SeqCst) {
                    return Err("扫描已取消".to_string());
                }
                let child_path = child.path();
                if !child_path.is_file() {
                    continue;
                }
                let Some(name) = child_path.file_name().and_then(|n| n.to_str()) else {
                    continue;
                };
                if name.to_ascii_lowercase().ends_with(".exe") {
                    exe_paths.push(child_path.to_string_lossy().into_owned());
                }
            }
        }

        if exe_paths.is_empty() {
            continue;
        }

        exe_paths.sort_by(|a, b| {
            let an = std::path::Path::new(a)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(a);
            let bn = std::path::Path::new(b)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(b);
            an.to_ascii_lowercase()
                .cmp(&bn.to_ascii_lowercase())
                .then_with(|| a.cmp(b))
        });

        items.push(BatchImportScanItem {
            folder_name: folder_name.to_string(),
            folder_path: path.to_string_lossy().into_owned(),
            exe_paths,
        });
    }

    if scan.cancel.load(Ordering::SeqCst) {
        return Err("扫描已取消".to_string());
    }

    items.sort_by(|a, b| {
        a.folder_name
            .to_ascii_lowercase()
            .cmp(&b.folder_name.to_ascii_lowercase())
            .then_with(|| a.folder_name.cmp(&b.folder_name))
    });

    Ok(items)
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GameLogItem {
    pub id: i64,
    pub game_id: i64,
    pub bangumi_id: i64,
    pub action: String,
    pub session_id: Option<String>,
    pub created_at: String,
    pub name: String,
    pub name_cn: String,
    pub image: Option<String>,
    pub cover_path: Option<String>,
    pub cover_thumb_path: Option<String>,
    pub infobox: Option<serde_json::Value>,
    pub nsfw: bool,
}

type GameLogRow = (
    i64,
    i64,
    i64,
    String,
    Option<String>,
    String,
    String,
    String,
    Option<String>,
    String,
    Option<String>,
    i64,
);

fn map_game_log_query_row(row: &Row<'_>) -> rusqlite::Result<GameLogRow> {
    Ok((
        row.get(0)?,
        row.get(1)?,
        row.get(2)?,
        row.get(3)?,
        row.get(4)?,
        row.get(5)?,
        row.get(6)?,
        row.get(7)?,
        row.get(8)?,
        row.get(9)?,
        row.get(10)?,
        row.get(11)?,
    ))
}

fn finish_game_log_item(row: GameLogRow) -> GameLogItem {
    let (
        id,
        game_id,
        bangumi_id,
        action,
        session_id,
        created_at,
        name,
        name_cn,
        image,
        launch_path,
        infobox_raw,
        nsfw,
    ) = row;

    let cover = find_game_cover(&launch_path, bangumi_id);
    let cover_path = cover
        .as_ref()
        .map(|path| path.to_string_lossy().into_owned());
    let cover_thumb_path = match cover.as_ref() {
        Some(path) => {
            if let Some(thumb) = crate::image_util::find_existing_sidecar_thumbnail(path) {
                Some(thumb.to_string_lossy().into_owned())
            } else {
                crate::image_util::schedule_sidecar_thumbnail(path.clone());
                None
            }
        }
        None => None,
    };
    let infobox = infobox_raw.and_then(|value| serde_json::from_str(&value).ok());

    GameLogItem {
        id,
        game_id,
        bangumi_id,
        action,
        session_id,
        created_at,
        name,
        name_cn,
        image,
        cover_path,
        cover_thumb_path,
        infobox,
        nsfw: nsfw != 0,
    }
}

#[tauri::command]
pub fn list_recent_game_logs(
    db: State<'_, LibraryDb>,
    limit: Option<i64>,
) -> Result<Vec<GameLogItem>, String> {
    let limit = limit.unwrap_or(40).clamp(1, 200);
    let rows = {
        let conn = db.0.lock().map_err(|err| err.to_string())?;
        let mut stmt = conn
            .prepare(
                r#"
                SELECT
                  l.id,
                  l.game_id,
                  l.bangumi_id,
                  l.action,
                  l.session_id,
                  l.created_at,
                  g.name,
                  g.name_cn,
                  g.image,
                  g.launch_path,
                  g.infobox,
                  g.nsfw
                FROM game_logs l
                INNER JOIN games g ON g.id = l.game_id
                ORDER BY l.id DESC
                LIMIT ?1
                "#,
            )
            .map_err(|err| err.to_string())?;

        let mapped = stmt
            .query_map(params![limit], map_game_log_query_row)
            .map_err(|err| err.to_string())?;

        let mut items = Vec::new();
        for row in mapped {
            items.push(row.map_err(|err| err.to_string())?);
        }
        items
    };

    Ok(rows.into_iter().map(finish_game_log_item).collect())
}

#[tauri::command]
pub fn list_library_game_logs(
    db: State<'_, LibraryDb>,
    game_id: i64,
    limit: Option<i64>,
) -> Result<Vec<GameLogItem>, String> {
    let limit = limit.unwrap_or(100).clamp(1, 500);
    let rows = {
        let conn = db.0.lock().map_err(|err| err.to_string())?;
        let mut stmt = conn
            .prepare(
                r#"
                SELECT
                  l.id,
                  l.game_id,
                  l.bangumi_id,
                  l.action,
                  l.session_id,
                  l.created_at,
                  g.name,
                  g.name_cn,
                  g.image,
                  g.launch_path,
                  g.infobox,
                  g.nsfw
                FROM game_logs l
                INNER JOIN games g ON g.id = l.game_id
                WHERE l.game_id = ?1
                ORDER BY l.id DESC
                LIMIT ?2
                "#,
            )
            .map_err(|err| err.to_string())?;

        let mapped = stmt
            .query_map(params![game_id, limit], map_game_log_query_row)
            .map_err(|err| err.to_string())?;

        let mut items = Vec::new();
        for row in mapped {
            items.push(row.map_err(|err| err.to_string())?);
        }
        items
    };

    Ok(rows.into_iter().map(finish_game_log_item).collect())
}

