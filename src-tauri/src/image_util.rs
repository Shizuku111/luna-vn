use std::fs;
use std::path::{Path, PathBuf};

pub fn sniff_image_extension(bytes: &[u8]) -> &'static str {
    if bytes.len() >= 3 && bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff {
        return "jpg";
    }
    if bytes.len() >= 8
        && bytes[0..8] == [0x89, b'P', b'N', b'G', b'\r', b'\n', 0x1a, b'\n']
    {
        return "png";
    }
    if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return "webp";
    }
    if bytes.len() >= 6 && (&bytes[0..6] == b"GIF87a" || &bytes[0..6] == b"GIF89a") {
        return "gif";
    }
    "jpg"
}

pub fn write_bytes_atomic(dest: &Path, bytes: &[u8]) -> Result<(), String> {
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|err| {
            format!("无法创建目录（{}）：{}", parent.display(), err)
        })?;
    }
    let tmp = dest.with_extension(format!(
        "{}.part",
        dest.extension()
            .and_then(|value| value.to_str())
            .unwrap_or("img")
    ));
    fs::write(&tmp, bytes).map_err(|err| {
        format!("写入文件失败（{}）：{}", tmp.display(), err)
    })?;
    fs::rename(&tmp, dest).map_err(|err| {
        let _ = fs::remove_file(&tmp);
        format!("保存文件失败（{}）：{}", dest.display(), err)
    })?;
    Ok(())
}

pub fn save_image_bytes(dir: &Path, stem: &str, bytes: &[u8]) -> Result<PathBuf, String> {
    let ext = sniff_image_extension(bytes);
    let dest = dir.join(format!("{stem}.{ext}"));
    write_bytes_atomic(&dest, bytes)?;
    Ok(dest)
}
