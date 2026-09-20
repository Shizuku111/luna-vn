use super::LibraryGame;

pub(crate) fn luna_vn_dir(launch_path: &str) -> Option<std::path::PathBuf> {
    std::path::Path::new(launch_path)
        .parent()
        .filter(|path| !path.as_os_str().is_empty())
        .map(|parent| parent.join(".LunaVN"))
}

const LUNA_VN_NOTICE_FILE: &str = "当前文件夹为Luna VN生成，请不要删除.txt";

pub(crate) fn ensure_luna_vn_notice(meta_dir: &std::path::Path) {
    let notice_path = meta_dir.join(LUNA_VN_NOTICE_FILE);
    if notice_path.is_file() {
        return;
    }
    let _ = std::fs::write(notice_path, "此目录由 Luna VN 生成，请不要删除。\n");
}

fn games_cover_dir() -> Option<std::path::PathBuf> {
    crate::image_cache::games_dir()
}

fn cover_name_suffix() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    const CHARS: &[u8] =
        b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    let mut n = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    n = n
        .wrapping_mul(0x9E37_79B9_7F4A_7C15)
        .wrapping_add(n >> 11);
    let mut out = [b'0'; 6];
    for slot in out.iter_mut().rev() {
        *slot = CHARS[(n % 62) as usize];
        n /= 62;
    }
    String::from_utf8_lossy(&out).into_owned()
}

pub(crate) fn is_cover_filename(bangumi_id: i64, file_name: &str) -> bool {
    let prefix = format!("{bangumi_id}_");
    let Some(rest) = file_name.strip_prefix(&prefix) else {
        return false;
    };
    let Some((suffix, ext)) = rest.rsplit_once('.') else {
        return false;
    };
    if suffix.ends_with("_thumb") {
        return false;
    }
    let ext = ext.to_ascii_lowercase();
    matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "webp" | "gif")
        && suffix.len() == 6
        && suffix.bytes().all(|b| {
            b.is_ascii_digit() || (b'A'..=b'Z').contains(&b) || (b'a'..=b'z').contains(&b)
        })
}

fn find_cover_in_dir(dir: &std::path::Path, bangumi_id: i64) -> Option<std::path::PathBuf> {
    if !dir.is_dir() {
        return None;
    }

    let mut matched: Vec<std::path::PathBuf> = Vec::new();
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
                continue;
            };
            if is_cover_filename(bangumi_id, name) {
                matched.push(path);
            }
        }
    }

    matched.sort_by(|a, b| {
        let am = a.metadata().and_then(|m| m.modified()).ok();
        let bm = b.metadata().and_then(|m| m.modified()).ok();
        bm.cmp(&am)
    });
    matched.into_iter().next()
}

fn copy_cover_into_cache(source: &std::path::Path) -> Option<std::path::PathBuf> {
    let dir = games_cover_dir()?;
    let name = source.file_name()?.to_str()?;
    let _ = std::fs::create_dir_all(&dir);
    let dest = dir.join(name);
    if source == dest {
        return Some(dest);
    }
    if !dest.is_file() {
        let copied = std::fs::copy(source, &dest).is_ok();
        if !copied {
            return None;
        }
    }
    let old_thumb = crate::image_util::sidecar_thumbnail_path(source);
    if old_thumb.is_file() {
        let new_thumb = crate::image_util::sidecar_thumbnail_path(&dest);
        if !new_thumb.is_file() {
            let _ = std::fs::copy(&old_thumb, &new_thumb);
        }
    }
    Some(dest)
}

fn migrate_legacy_cover(launch_path: &str, bangumi_id: i64) {
    let Some(cache_dir) = games_cover_dir() else {
        return;
    };
    if find_cover_in_dir(&cache_dir, bangumi_id).is_some() {
        return;
    }
    let Some(legacy_dir) = luna_vn_dir(launch_path) else {
        return;
    };
    let Some(old_path) = find_cover_in_dir(&legacy_dir, bangumi_id) else {
        return;
    };
    let _ = copy_cover_into_cache(&old_path);
}

pub(crate) fn find_local_cover(bangumi_id: i64) -> Option<std::path::PathBuf> {
    find_cover_in_dir(&games_cover_dir()?, bangumi_id)
}

pub(crate) fn find_game_cover(launch_path: &str, bangumi_id: i64) -> Option<std::path::PathBuf> {
    migrate_legacy_cover(launch_path, bangumi_id);
    find_local_cover(bangumi_id)
}

pub(crate) fn new_local_cover_stem(bangumi_id: i64) -> Option<(std::path::PathBuf, String)> {
    games_cover_dir().map(|dir| (dir, format!("{}_{}", bangumi_id, cover_name_suffix())))
}

pub(crate) fn remove_cover_and_thumb(path: &std::path::Path) {
    let thumb = crate::image_util::sidecar_thumbnail_path(path);
    let _ = std::fs::remove_file(path);
    let _ = std::fs::remove_file(thumb);
}

pub(crate) fn remove_local_covers(bangumi_id: i64) {
    let Some(dir) = games_cover_dir() else {
        return;
    };
    if !dir.is_dir() {
        return;
    }
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
                continue;
            };
            if path.is_file() && is_cover_filename(bangumi_id, name) {
                remove_cover_and_thumb(&path);
            }
        }
    }
}

pub(crate) fn remote_cover_url(game: &LibraryGame) -> Option<String> {
    let images = game.images.as_ref().and_then(|value| value.as_object());
    if let Some(images) = images {
        for key in ["large", "common", "medium", "small"] {
            if let Some(url) = images
                .get(key)
                .and_then(|value| value.as_str())
                .map(str::trim)
                .filter(|value| !value.is_empty())
            {
                return Some(url.to_string());
            }
        }
    }

    game.image
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(|value| value.to_string())
}

pub(crate) fn download_cover_to_dir(
    url: &str,
    dir: &std::path::Path,
    stem: &str,
) -> Result<std::path::PathBuf, String> {
    crate::download::assert_allowed_download_url(url)?;
    std::fs::create_dir_all(dir).map_err(|err| {
        format!("无法创建封面目录（{}）：{}", dir.display(), err)
    })?;

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .redirect(crate::download::download_redirect_policy())
        .user_agent(crate::download::APP_USER_AGENT)
        .build()
        .map_err(|err| format!("创建下载客户端失败：{}", err))?;

    let response = client
        .get(url)
        .send()
        .map_err(|err| format!("下载封面失败：{}", err))?;
    if !response.status().is_success() {
        return Err(format!("下载封面失败：HTTP {}", response.status()));
    }

    let bytes = response
        .bytes()
        .map_err(|err| format!("读取封面数据失败：{}", err))?;
    let dest = crate::image_util::save_image_bytes(dir, stem, &bytes)?;
    crate::image_util::schedule_sidecar_thumbnail(dest.clone());
    Ok(dest)
}

pub(crate) fn install_cover_from_path(
    source: &str,
    dir: &std::path::Path,
    stem: &str,
) -> Result<std::path::PathBuf, String> {
    let source_path = std::path::Path::new(source);
    if !source_path.is_file() {
        return Err("封面文件不存在".to_string());
    }
    std::fs::create_dir_all(dir).map_err(|err| {
        format!("无法创建封面目录（{}）：{}", dir.display(), err)
    })?;

    let bytes = std::fs::read(source_path).map_err(|err| {
        format!("读取封面失败（{}）：{}", source_path.display(), err)
    })?;
    let dest = crate::image_util::save_image_bytes(dir, stem, &bytes)?;
    crate::image_util::schedule_sidecar_thumbnail(dest.clone());
    Ok(dest)
}

fn ensure_local_cover(game: &LibraryGame) {
    migrate_legacy_cover(&game.launch_path, game.bangumi_id);
    if find_local_cover(game.bangumi_id).is_some() {
        return;
    }
    let Some((dir, stem)) = new_local_cover_stem(game.bangumi_id) else {
        return;
    };
    let Some(url) = remote_cover_url(game) else {
        return;
    };
    let _ = download_cover_to_dir(&url, &dir, &stem);
}

pub(crate) fn attach_cover_path(mut game: LibraryGame) -> LibraryGame {
    migrate_legacy_cover(&game.launch_path, game.bangumi_id);
    if let Some(path) = find_local_cover(game.bangumi_id) {
        game.cover_path = Some(path.to_string_lossy().into_owned());
        if let Some(thumb) = crate::image_util::find_existing_sidecar_thumbnail(&path) {
            game.cover_thumb_path = Some(thumb.to_string_lossy().into_owned());
        } else {
            game.cover_thumb_path = None;
            crate::image_util::schedule_sidecar_thumbnail(path);
        }
    } else {
        game.cover_path = None;
        game.cover_thumb_path = None;
    }
    game
}

pub(crate) fn finalize_game_cover(game: LibraryGame) -> LibraryGame {
    ensure_local_cover(&game);
    attach_cover_path(game)
}

pub(crate) fn relocate_local_cover(previous_bangumi_id: i64, next_bangumi_id: i64) {
    if previous_bangumi_id == next_bangumi_id {
        return;
    }
    let Some(old_path) = find_local_cover(previous_bangumi_id) else {
        return;
    };
    let Some((dir, stem)) = new_local_cover_stem(next_bangumi_id) else {
        return;
    };
    let ext = old_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("jpg");
    let new_path = dir.join(format!("{stem}.{ext}"));
    if old_path == new_path {
        return;
    }
    let _ = std::fs::create_dir_all(&dir);
    let old_thumb = crate::image_util::sidecar_thumbnail_path(&old_path);
    let moved = std::fs::rename(&old_path, &new_path).is_ok()
        || (std::fs::copy(&old_path, &new_path).is_ok() && std::fs::remove_file(&old_path).is_ok());
    if moved {
        let _ = std::fs::remove_file(old_thumb);
        crate::image_util::schedule_sidecar_thumbnail(new_path.clone());
        remove_local_covers(previous_bangumi_id);
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path == new_path {
                    continue;
                }
                let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
                    continue;
                };
                if path.is_file() && is_cover_filename(next_bangumi_id, name) {
                    remove_cover_and_thumb(&path);
                }
            }
        }
    }
}

pub(crate) fn remove_luna_vn_dir(launch_path: &str) {
    let Some(meta_dir) = luna_vn_dir(launch_path) else {
        return;
    };
    if meta_dir.is_dir() {
        let _ = std::fs::remove_dir_all(meta_dir);
    }
}
