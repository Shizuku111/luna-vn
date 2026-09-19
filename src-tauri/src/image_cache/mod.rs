use std::collections::VecDeque;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::thread;

use serde::Deserialize;
use tauri::{AppHandle, Manager, State};

use crate::db::LibraryDb;
use crate::image_util::{
    ensure_jpeg_thumbnail, save_image_bytes, schedule_jpeg_thumbnail, sniff_image_extension,
    write_bytes_atomic,
};

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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EntityImageVariant {
    List,
    Detail,
}

impl EntityImageVariant {
    fn parse(value: Option<&str>) -> Result<Self, String> {
        match value.map(str::trim).unwrap_or("list") {
            "" | "list" => Ok(Self::List),
            "detail" => Ok(Self::Detail),
            _ => Err("无效的图片缓存尺寸".to_string()),
        }
    }

    fn url_keys(self) -> &'static [&'static str] {
        match self {
            Self::List => &["grid", "small", "common", "medium", "large"],
            Self::Detail => &["large", "medium", "common", "small", "grid"],
        }
    }
}

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
    Ok(ImageCacheRoot(root))
}

fn kind_dir(root: &Path, kind: EntityImageKind) -> PathBuf {
    root.join(kind.dir_name())
}

fn thumb_path(root: &Path, kind: EntityImageKind, id: i64) -> PathBuf {
    kind_dir(root, kind).join(format!("{id}_thumb.jpg"))
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
    let id_prefix = format!("{id}.");
    let thumb_name = format!("{id}_thumb.jpg");
    let source_name = format!("{id}.source.txt");
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
                continue;
            };
            let lower = name.to_ascii_lowercase();
            if lower == thumb_name
                || lower == source_name
                || lower.starts_with(&format!("{id}_src."))
                || lower.starts_with(&format!("{id}_thumb."))
            {
                continue;
            }
            if lower.starts_with(&id_prefix.to_ascii_lowercase()) {
                let rest = &lower[id_prefix.len()..];
                if !rest.contains('.') {
                    let _ = fs::remove_file(path);
                }
            }
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

fn is_image_filename(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.ends_with(".jpg")
        || lower.ends_with(".jpeg")
        || lower.ends_with(".png")
        || lower.ends_with(".webp")
        || lower.ends_with(".gif")
}

fn find_full_image(root: &Path, kind: EntityImageKind, id: i64) -> Option<PathBuf> {
    let dir = kind_dir(root, kind);
    if !dir.is_dir() {
        return None;
    }
    let id_prefix = format!("{id}.");
    let thumb_name = format!("{id}_thumb.jpg");
    let mut matched = Vec::new();
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
                continue;
            };
            if !is_image_filename(name) {
                continue;
            }
            let lower = name.to_ascii_lowercase();
            if lower == thumb_name
                || lower == format!("{id}.source.txt")
                || lower.starts_with(&format!("{id}_src."))
            {
                continue;
            }
            if lower.starts_with(&id_prefix.to_ascii_lowercase()) {
                let rest = &lower[id_prefix.len()..];
                if !rest.contains('.') {
                    matched.push(path);
                }
            }
        }
    }
    matched.into_iter().next()
}

fn find_thumb_image(root: &Path, kind: EntityImageKind, id: i64) -> Option<PathBuf> {
    let thumb = thumb_path(root, kind, id);
    if thumb.is_file() {
        Some(thumb)
    } else {
        None
    }
}

pub fn find_cached(
    root: &Path,
    kind: EntityImageKind,
    id: i64,
    variant: EntityImageVariant,
) -> Option<PathBuf> {
    match variant {
        EntityImageVariant::List => find_thumb_image(root, kind, id),
        EntityImageVariant::Detail => find_full_image(root, kind, id).filter(|_| {
            read_full_source_url(root, kind, id).is_some()
        }),
    }
}

pub fn pick_remote_image_url(images: &Option<serde_json::Value>) -> Option<String> {
    remote_image_urls(images, EntityImageVariant::List)
        .into_iter()
        .next()
}

fn remote_image_urls(
    images: &Option<serde_json::Value>,
    variant: EntityImageVariant,
) -> Vec<String> {
    let Some(object) = images.as_ref().and_then(|value| value.as_object()) else {
        return Vec::new();
    };
    let mut urls = Vec::new();
    for key in variant.url_keys() {
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

fn schedule_thumb_from_full(root: &Path, kind: EntityImageKind, id: i64, full: PathBuf) {
    let thumb = thumb_path(root, kind, id);
    schedule_jpeg_thumbnail(full, thumb);
}

const LIST_PREP_WORKERS: usize = 2;

struct ListPrepJob {
    root: PathBuf,
    kind: EntityImageKind,
    id: i64,
    urls: Vec<String>,
}

struct ListPrepQueueState {
    pending: VecDeque<ListPrepJob>,
    active: usize,
}

static LIST_PREP_QUEUE: OnceLock<Mutex<ListPrepQueueState>> = OnceLock::new();

fn list_prep_queue() -> &'static Mutex<ListPrepQueueState> {
    LIST_PREP_QUEUE.get_or_init(|| {
        Mutex::new(ListPrepQueueState {
            pending: VecDeque::new(),
            active: 0,
        })
    })
}

fn prepare_list_thumb(root: &Path, kind: EntityImageKind, id: i64, urls: &[String]) {
    if find_thumb_image(root, kind, id).is_some() {
        return;
    }
    let thumb = thumb_path(root, kind, id);
    if let Some(full) = find_full_image(root, kind, id) {
        let _ = ensure_jpeg_thumbnail(&full, &thumb);
        return;
    }

    let dir = kind_dir(root, kind);
    let _ = fs::create_dir_all(&dir);
    for url in urls {
        let Ok(bytes) = download_bytes(url) else {
            continue;
        };
        let ext = sniff_image_extension(&bytes);
        let tmp = dir.join(format!("{id}_src.{ext}"));
        if write_bytes_atomic(&tmp, &bytes).is_err() {
            continue;
        }
        if ensure_jpeg_thumbnail(&tmp, &thumb).is_some() {
            let _ = fs::remove_file(&tmp);
            return;
        }
        let _ = fs::remove_file(&tmp);
    }
}

fn pump_list_prep_queue() {
    let job = {
        let Ok(mut state) = list_prep_queue().lock() else {
            return;
        };
        if state.active >= LIST_PREP_WORKERS {
            return;
        }
        let Some(job) = state.pending.pop_front() else {
            return;
        };
        state.active += 1;
        job
    };

    thread::spawn(move || {
        prepare_list_thumb(&job.root, job.kind, job.id, &job.urls);
        if let Ok(mut state) = list_prep_queue().lock() {
            state.active = state.active.saturating_sub(1);
        }
        pump_list_prep_queue();
    });
}

fn schedule_prepare_list_thumb(
    root: PathBuf,
    kind: EntityImageKind,
    id: i64,
    urls: Vec<String>,
) {
    if id <= 0 {
        return;
    }
    if find_thumb_image(&root, kind, id).is_some() {
        return;
    }
    {
        let Ok(mut state) = list_prep_queue().lock() else {
            return;
        };
        if state
            .pending
            .iter()
            .any(|job| job.kind == kind && job.id == id)
        {
            return;
        }
        state.pending.push_back(ListPrepJob {
            root,
            kind,
            id,
            urls,
        });
    }
    pump_list_prep_queue();
}

fn ensure_entity_image_file(
    root: &Path,
    kind: EntityImageKind,
    id: i64,
    variant: EntityImageVariant,
    urls: &[String],
    force: bool,
) -> Option<PathBuf> {
    if id <= 0 {
        return None;
    }
    let dir = kind_dir(root, kind);
    let _ = fs::create_dir_all(&dir);

    match variant {
        EntityImageVariant::Detail => {
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
                        schedule_thumb_from_full(root, kind, id, existing.clone());
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
                schedule_thumb_from_full(root, kind, id, dest.clone());
                return Some(dest);
            }
            find_full_image(root, kind, id)
        }
        EntityImageVariant::List => {
            if let Some(thumb) = find_thumb_image(root, kind, id) {
                return Some(thumb);
            }
            schedule_prepare_list_thumb(root.to_path_buf(), kind, id, urls.to_vec());
            None
        }
    }
}

pub fn ensure_entity_image_file_from_images(
    root: &Path,
    kind: EntityImageKind,
    id: i64,
    images: &Option<serde_json::Value>,
    force: bool,
) -> Option<PathBuf> {
    let detail = {
        let urls = remote_image_urls(images, EntityImageVariant::Detail);
        ensure_entity_image_file(root, kind, id, EntityImageVariant::Detail, &urls, force)
    };
    let list = {
        let urls = remote_image_urls(images, EntityImageVariant::List);
        ensure_entity_image_file(root, kind, id, EntityImageVariant::List, &urls, force)
    };
    detail.or(list)
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
    let list_ready = find_thumb_image(&root, kind, id).is_some();
    let detail_ready =
        find_cached(&root, kind, id, EntityImageVariant::Detail).is_some();
    if !force && list_ready && detail_ready {
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
    variant: EntityImageVariant,
) -> Option<String> {
    find_cached(root, kind, id, variant).map(|path| path.to_string_lossy().into_owned())
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
    Ok(())
}

pub fn remove_cached(root: &Path, kind: EntityImageKind, id: i64) {
    let dir = kind_dir(root, kind);
    let _ = fs::remove_file(thumb_path(root, kind, id));
    let _ = fs::remove_file(source_mark_path(root, kind, id));
    if let Ok(entries) = fs::read_dir(dir) {
        let id_dot = format!("{id}.");
        let id_thumb = format!("{id}_thumb.");
        let id_src = format!("{id}_src.");
        for entry in entries.flatten() {
            let path = entry.path();
            let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
                continue;
            };
            if name.starts_with(&id_dot)
                || name.starts_with(&id_thumb)
                || name.starts_with(&id_src)
                || name == format!("{id}_thumb.jpg")
                || name == format!("{id}.source.txt")
            {
                let _ = fs::remove_file(path);
            }
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnsureEntityImageInput {
    pub kind: String,
    pub id: i64,
    pub remote_url: Option<String>,
    pub variant: Option<String>,
}

#[tauri::command]
pub async fn ensure_entity_image(
    cache: State<'_, ImageCacheRoot>,
    db: State<'_, LibraryDb>,
    input: EnsureEntityImageInput,
) -> Result<Option<String>, String> {
    let kind = EntityImageKind::parse(&input.kind)?;
    let variant = EntityImageVariant::parse(input.variant.as_deref())?;
    let root = cache.0.clone();
    let id = input.id;
    let preferred_url = input
        .remote_url
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    if let Some(path) = find_cached(&root, kind, id, variant) {
        if variant == EntityImageVariant::Detail {
            if let Some(full) = find_full_image(&root, kind, id) {
                schedule_thumb_from_full(&root, kind, id, full);
            }
        }
        return Ok(Some(path.to_string_lossy().into_owned()));
    }

    let db_images = lookup_images_value(&db, kind, id).unwrap_or(None);
    let mut urls = Vec::new();
    if let Some(url) = preferred_url {
        urls.push(url);
    }
    for url in remote_image_urls(&db_images, variant) {
        if !urls.iter().any(|existing| existing == &url) {
            urls.push(url);
        }
    }

    if variant == EntityImageVariant::List {
        schedule_prepare_list_thumb(root, kind, id, urls);
        return Ok(None);
    }

    tauri::async_runtime::spawn_blocking(move || {
        ensure_entity_image_file(&root, kind, id, variant, &urls, false)
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
    variant: Option<String>,
) -> Result<Option<String>, String> {
    let kind = EntityImageKind::parse(&kind)?;
    let variant = EntityImageVariant::parse(variant.as_deref())?;
    Ok(resolve_cached_path_string(&cache.0, kind, id, variant))
}
