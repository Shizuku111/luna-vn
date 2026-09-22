use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use serde::Deserialize;
use tauri::{AppHandle, Manager, State};

use crate::db::LibraryDb;
use crate::image_util::save_image_bytes;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EntityImageKind {
    Character,
    Person,
}

impl EntityImageKind {
    fn dir_name(self) -> &'static str {
        match self {
            Self::Character => "characters",
            Self::Person => "persons",
        }
    }

    fn parse(value: &str) -> Result<Self, String> {
        match value.trim() {
            "character" => Ok(Self::Character),
            "person" => Ok(Self::Person),
            _ => Err("无效的图片缓存类型".to_string()),
        }
    }
}

const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp", "gif"];
const IMAGE_URL_KEYS: &[&str] = &["large", "medium", "common", "small", "grid"];

pub struct ImageCacheRoot(pub PathBuf);

pub fn init_image_cache(app: &AppHandle) -> Result<ImageCacheRoot, String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|err| err.to_string())?
        .join("image-cache");
    fs::create_dir_all(root.join(EntityImageKind::Character.dir_name()))
        .map_err(|err| err.to_string())?;
    fs::create_dir_all(root.join(EntityImageKind::Person.dir_name()))
        .map_err(|err| err.to_string())?;
    fs::create_dir_all(root.join("games")).map_err(|err| err.to_string())?;
    let _ = IMAGE_CACHE_ROOT.set(root.clone());
    Ok(ImageCacheRoot(root))
}

static IMAGE_CACHE_ROOT: OnceLock<PathBuf> = OnceLock::new();

pub fn games_dir() -> Option<PathBuf> {
    IMAGE_CACHE_ROOT.get().map(|root| root.join("games"))
}

fn kind_dir(root: &Path, kind: EntityImageKind) -> PathBuf {
    root.join(kind.dir_name())
}

fn source_mark_path(root: &Path, kind: EntityImageKind, id: i64) -> PathBuf {
    kind_dir(root, kind).join(format!("{id}.source.txt"))
}

fn read_full_source_url(root: &Path, kind: EntityImageKind, id: i64) -> Option<String> {
    let raw = fs::read_to_string(source_mark_path(root, kind, id)).ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn write_full_source_url(root: &Path, kind: EntityImageKind, id: i64, url: &str) {
    let _ = fs::write(source_mark_path(root, kind, id), url.trim());
}

fn remove_full_image_files(root: &Path, kind: EntityImageKind, id: i64) {
    let dir = kind_dir(root, kind);
    for ext in IMAGE_EXTENSIONS {
        let path = dir.join(format!("{id}.{ext}"));
        if path.is_file() {
            let _ = fs::remove_file(path);
        }
    }
    let _ = fs::remove_file(source_mark_path(root, kind, id));
}

fn save_full_image(
    root: &Path,
    kind: EntityImageKind,
    id: i64,
    bytes: &[u8],
    source_url: &str,
) -> Result<PathBuf, String> {
    let dir = kind_dir(root, kind);
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    remove_full_image_files(root, kind, id);
    let dest = save_image_bytes(&dir, &id.to_string(), bytes)?;
    write_full_source_url(root, kind, id, source_url);
    Ok(dest)
}

fn find_full_image(root: &Path, kind: EntityImageKind, id: i64) -> Option<PathBuf> {
    let dir = kind_dir(root, kind);
    IMAGE_EXTENSIONS.iter().find_map(|ext| {
        let path = dir.join(format!("{id}.{ext}"));
        path.is_file().then_some(path)
    })
}

pub fn find_cached(root: &Path, kind: EntityImageKind, id: i64) -> Option<PathBuf> {
    find_full_image(root, kind, id)
}

pub fn pick_remote_image_url(images: &Option<serde_json::Value>) -> Option<String> {
    remote_image_urls(images).into_iter().next()
}

fn remote_image_urls(images: &Option<serde_json::Value>) -> Vec<String> {
    let Some(object) = images.as_ref().and_then(|value| value.as_object()) else {
        return Vec::new();
    };
    let mut urls = Vec::new();
    for key in IMAGE_URL_KEYS {
        if let Some(url) = object
            .get(*key)
            .and_then(|value| value.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            if !urls.iter().any(|existing| existing == url) {
                urls.push(url.to_string());
            }
        }
    }
    urls
}

fn lookup_images_value(
    db: &LibraryDb,
    kind: EntityImageKind,
    id: i64,
) -> Option<Option<serde_json::Value>> {
    let conn = db.0.lock().ok()?;
    let table = match kind {
        EntityImageKind::Character => "characters",
        EntityImageKind::Person => "persons",
    };
    let images_raw: Option<String> = conn
        .query_row(
            &format!("SELECT images FROM {table} WHERE id = ?1"),
            rusqlite::params![id],
            |row| row.get(0),
        )
        .ok()?;
    Some(images_raw.and_then(|value| serde_json::from_str(&value).ok()))
}

fn download_bytes(url: &str) -> Result<Vec<u8>, String> {
    crate::download::assert_allowed_download_url(url)?;
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .redirect(crate::download::download_redirect_policy())
        .user_agent(crate::download::APP_USER_AGENT)
        .build()
        .map_err(|err| format!("创建下载客户端失败：{}", err))?;

    let response = client
        .get(url)
        .send()
        .map_err(|err| format!("下载图片失败：{}", err))?;
    if !response.status().is_success() {
        return Err(format!("下载图片失败：HTTP {}", response.status()));
    }
    response
        .bytes()
        .map(|bytes| bytes.to_vec())
        .map_err(|err| format!("读取图片数据失败：{}", err))
}

fn ensure_entity_image_file(
    root: &Path,
    kind: EntityImageKind,
    id: i64,
    urls: &[String],
    force: bool,
) -> Option<PathBuf> {
    if id <= 0 {
        return None;
    }
    let dir = kind_dir(root, kind);
    let _ = fs::create_dir_all(&dir);

    let preferred = urls.first().map(String::as_str);
    if !force {
        if let Some(existing) = find_full_image(root, kind, id) {
            let mark = read_full_source_url(root, kind, id);
            let mark_ok = match (mark.as_deref(), preferred) {
                (Some(saved), Some(want)) => saved == want,
                (Some(_), None) => true,
                (None, Some(_)) => false,
                (None, None) => true,
            };
            if mark_ok {
                return Some(existing);
            }
        }
    }
    for url in urls {
        let Ok(bytes) = download_bytes(url) else {
            continue;
        };
        let Ok(dest) = save_full_image(root, kind, id, &bytes, url) else {
            continue;
        };
        return Some(dest);
    }
    find_full_image(root, kind, id)
}

pub fn ensure_entity_image_file_from_images(
    root: &Path,
    kind: EntityImageKind,
    id: i64,
    images: &Option<serde_json::Value>,
    force: bool,
) -> Option<PathBuf> {
    let urls = remote_image_urls(images);
    ensure_entity_image_file(root, kind, id, &urls, force)
}

pub fn schedule_cache_images_value(
    root: PathBuf,
    kind: EntityImageKind,
    id: i64,
    images: &Option<serde_json::Value>,
    force: bool,
) {
    if id <= 0 {
        return;
    }
    if !force && find_cached(&root, kind, id).is_some() {
        return;
    }
    if pick_remote_image_url(images).is_none() {
        return;
    }
    let images = images.clone();

    tauri::async_runtime::spawn(async move {
        let _ = tauri::async_runtime::spawn_blocking(move || {
            ensure_entity_image_file_from_images(&root, kind, id, &images, force)
        })
        .await;
    });
}

pub fn resolve_cached_path_string(
    root: &Path,
    kind: EntityImageKind,
    id: i64,
) -> Option<String> {
    find_cached(root, kind, id).map(|path| path.to_string_lossy().into_owned())
}

pub fn clear_all(root: &Path) -> Result<(), String> {
    if !root.exists() {
        return Ok(());
    }
    fs::remove_dir_all(root).map_err(|err| format!("清除图片缓存失败：{}", err))?;
    fs::create_dir_all(root.join(EntityImageKind::Character.dir_name()))
        .map_err(|err| err.to_string())?;
    fs::create_dir_all(root.join(EntityImageKind::Person.dir_name()))
        .map_err(|err| err.to_string())?;
    fs::create_dir_all(root.join("games")).map_err(|err| err.to_string())?;
    Ok(())
}

pub fn remove_cached(root: &Path, kind: EntityImageKind, id: i64) {
    remove_full_image_files(root, kind, id);
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnsureEntityImageInput {
    pub kind: String,
    pub id: i64,
    pub remote_url: Option<String>,
}

#[tauri::command]
pub async fn ensure_entity_image(
    cache: State<'_, ImageCacheRoot>,
    db: State<'_, LibraryDb>,
    input: EnsureEntityImageInput,
) -> Result<Option<String>, String> {
    let kind = EntityImageKind::parse(&input.kind)?;
    let root = cache.0.clone();
    let id = input.id;
    let preferred_url = input
        .remote_url
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    if let Some(path) = find_cached(&root, kind, id) {
        return Ok(Some(path.to_string_lossy().into_owned()));
    }

    let db_images = lookup_images_value(&db, kind, id).unwrap_or(None);
    let mut urls = Vec::new();
    if let Some(url) = preferred_url {
        urls.push(url);
    }
    for url in remote_image_urls(&db_images) {
        if !urls.iter().any(|existing| existing == &url) {
            urls.push(url);
        }
    }

    tauri::async_runtime::spawn_blocking(move || {
        ensure_entity_image_file(&root, kind, id, &urls, false)
            .map(|path| path.to_string_lossy().into_owned())
    })
    .await
    .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn resolve_entity_image(
    cache: State<'_, ImageCacheRoot>,
    kind: String,
    id: i64,
) -> Result<Option<String>, String> {
    let kind = EntityImageKind::parse(&kind)?;
    Ok(resolve_cached_path_string(&cache.0, kind, id))
}
