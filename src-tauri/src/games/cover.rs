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

const COVER_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp", "gif"];

fn find_cover_in_dir(dir: &std::path::Path, bangumi_id: i64) -> Option<std::path::PathBuf> {
    if !dir.is_dir() {
        return None;
    }
    COVER_EXTENSIONS.iter().find_map(|ext| {
        let path = dir.join(format!("{bangumi_id}.{ext}"));
        path.is_file().then_some(path)
    })
}

pub(crate) fn find_local_cover(bangumi_id: i64) -> Option<std::path::PathBuf> {
    find_cover_in_dir(&games_cover_dir()?, bangumi_id)
}

pub(crate) fn new_local_cover_stem(bangumi_id: i64) -> Option<(std::path::PathBuf, String)> {
    games_cover_dir().map(|dir| (dir, bangumi_id.to_string()))
}

pub(crate) fn remove_cover_file(path: &std::path::Path) {
    let _ = std::fs::remove_file(path);
}

pub(crate) fn remove_local_covers(bangumi_id: i64) {
    let Some(dir) = games_cover_dir() else {
        return;
    };
    for ext in COVER_EXTENSIONS {
        let path = dir.join(format!("{bangumi_id}.{ext}"));
        if path.is_file() {
            remove_cover_file(&path);
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

fn download_cover_bytes(url: &str) -> Result<Vec<u8>, String> {
    crate::download::assert_allowed_download_url(url)?;
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

    response
        .bytes()
        .map(|bytes| bytes.to_vec())
        .map_err(|err| format!("读取封面数据失败：{}", err))
}

pub(crate) fn download_cover_to_dir(
    url: &str,
    dir: &std::path::Path,
    stem: &str,
) -> Result<std::path::PathBuf, String> {
    std::fs::create_dir_all(dir).map_err(|err| {
        format!("无法创建封面目录（{}）：{}", dir.display(), err)
    })?;
    let bytes = download_cover_bytes(url)?;
    let dest = crate::image_util::save_image_bytes(dir, stem, &bytes)?;
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
    Ok(dest)
}

fn ensure_local_cover(game: &LibraryGame) {
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
    if let Some(path) = find_local_cover(game.bangumi_id) {
        game.cover_path = Some(path.to_string_lossy().into_owned());
    } else {
        game.cover_path = None;
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
    let moved = std::fs::rename(&old_path, &new_path).is_ok()
        || (std::fs::copy(&old_path, &new_path).is_ok() && std::fs::remove_file(&old_path).is_ok());
    if moved {
        remove_local_covers(previous_bangumi_id);
        for ext in COVER_EXTENSIONS {
            let path = dir.join(format!("{next_bangumi_id}.{ext}"));
            if path != new_path && path.is_file() {
                let _ = std::fs::remove_file(&path);
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
