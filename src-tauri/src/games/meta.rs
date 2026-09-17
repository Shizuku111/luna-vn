use super::LibraryGame;
use super::cover::ensure_luna_vn_notice;

pub(crate) fn write_launch_meta(game: &LibraryGame) -> Result<(), String> {
    let launch = std::path::Path::new(&game.launch_path);
    let parent = launch
        .parent()
        .filter(|path| !path.as_os_str().is_empty())
        .ok_or_else(|| "无法解析启动程序所在目录".to_string())?;
    let launch_name = launch
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .ok_or_else(|| "无法解析启动程序名称".to_string())?;

    let meta_dir = parent.join(".LunaVN");
    std::fs::create_dir_all(&meta_dir).map_err(|err| {
        format!(
            "无法创建 .LunaVN 目录（{}）：{}",
            meta_dir.display(),
            err
        )
    })?;
    ensure_luna_vn_notice(&meta_dir);

    let meta_path = meta_dir.join("meta.json");
    let file = std::fs::File::create(&meta_path).map_err(|err| {
        format!(
            "无法写入 meta.json（{}）：{}",
            meta_path.display(),
            err
        )
    })?;

    let meta = serde_json::json!({
        "id": game.id,
        "bangumiId": game.bangumi_id,
        "launcher": launch_name,
        "status": game.status,
        "favorite": game.favorite,
        "wishlist": game.wishlist,
    });

    serde_json::to_writer_pretty(file, &meta).map_err(|err| {
        format!("写入 meta.json 失败：{}", err)
    })?;

    Ok(())
}
