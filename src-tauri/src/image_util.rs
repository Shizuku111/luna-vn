use std::collections::VecDeque;
use std::fs;
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::thread;

const THUMB_MAX_EDGE: u32 = 720;
const THUMB_JPEG_QUALITY: u8 = 88;
const THUMB_WORKERS: usize = 2;

static THUMB_QUEUE: OnceLock<Mutex<ThumbQueueState>> = OnceLock::new();

struct ThumbJob {
    source: PathBuf,
    dest: PathBuf,
}

struct ThumbQueueState {
    pending: VecDeque<ThumbJob>,
    active: usize,
}

fn thumb_queue() -> &'static Mutex<ThumbQueueState> {
    THUMB_QUEUE.get_or_init(|| {
        Mutex::new(ThumbQueueState {
            pending: VecDeque::new(),
            active: 0,
        })
    })
}

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

pub fn decode_image_from_path(source: &Path) -> Result<image::DynamicImage, String> {
    let file = fs::File::open(source).map_err(|err| {
        format!("读取图片失败（{}）：{}", source.display(), err)
    })?;
    let reader = image::ImageReader::new(BufReader::new(file))
        .with_guessed_format()
        .map_err(|err| format!("识别图片格式失败（{}）：{}", source.display(), err))?;
    reader
        .decode()
        .map_err(|err| format!("解码图片失败（{}）：{}", source.display(), err))
}

pub fn write_jpeg_thumbnail(source: &Path, dest: &Path) -> Result<(), String> {
    let image = decode_image_from_path(source)?;
    let thumb = image.thumbnail(THUMB_MAX_EDGE, THUMB_MAX_EDGE);
    let rgb = thumb.to_rgb8();
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|err| {
            format!("无法创建目录（{}）：{}", parent.display(), err)
        })?;
    }
    let tmp = dest.with_extension("jpg.part");
    {
        let file = fs::File::create(&tmp).map_err(|err| {
            format!("写入缩略图失败（{}）：{}", tmp.display(), err)
        })?;
        let mut encoder =
            image::codecs::jpeg::JpegEncoder::new_with_quality(file, THUMB_JPEG_QUALITY);
        encoder
            .encode(
                rgb.as_raw(),
                rgb.width(),
                rgb.height(),
                image::ExtendedColorType::Rgb8,
            )
            .map_err(|err| format!("编码缩略图失败（{}）：{}", tmp.display(), err))?;
    }
    fs::rename(&tmp, dest).map_err(|err| {
        let _ = fs::remove_file(&tmp);
        format!("保存缩略图失败（{}）：{}", dest.display(), err)
    })?;
    Ok(())
}

pub fn ensure_jpeg_thumbnail(source: &Path, dest: &Path) -> Option<PathBuf> {
    if !source.is_file() {
        return None;
    }
    if dest.is_file() {
        let thumb_newer = match (dest.metadata(), source.metadata()) {
            (Ok(thumb_meta), Ok(source_meta)) => {
                match (thumb_meta.modified(), source_meta.modified()) {
                    (Ok(thumb_modified), Ok(source_modified)) => thumb_modified >= source_modified,
                    _ => true,
                }
            }
            _ => true,
        };
        if thumb_newer {
            return Some(dest.to_path_buf());
        }
    }
    if write_jpeg_thumbnail(source, dest).is_ok() {
        Some(dest.to_path_buf())
    } else {
        None
    }
}

fn pump_thumb_queue() {
    let job = {
        let Ok(mut state) = thumb_queue().lock() else {
            return;
        };
        if state.active >= THUMB_WORKERS {
            return;
        }
        let Some(job) = state.pending.pop_front() else {
            return;
        };
        state.active += 1;
        job
    };

    thread::spawn(move || {
        let _ = ensure_jpeg_thumbnail(&job.source, &job.dest);
        if let Ok(mut state) = thumb_queue().lock() {
            state.active = state.active.saturating_sub(1);
        }
        pump_thumb_queue();
    });
}

pub fn schedule_jpeg_thumbnail(source: PathBuf, dest: PathBuf) {
    if !source.is_file() {
        return;
    }
    if dest.is_file() {
        if let (Ok(t), Ok(s)) = (dest.metadata(), source.metadata()) {
            if let (Ok(tm), Ok(sm)) = (t.modified(), s.modified()) {
                if tm >= sm {
                    return;
                }
            }
        }
    }

    {
        let Ok(mut state) = thumb_queue().lock() else {
            return;
        };
        if state
            .pending
            .iter()
            .any(|job| job.source == source && job.dest == dest)
        {
            return;
        }
        state.pending.push_back(ThumbJob { source, dest });
    }
    pump_thumb_queue();
}

pub fn sidecar_thumbnail_path(source: &Path) -> PathBuf {
    source.with_file_name(format!(
        "{}_thumb.jpg",
        source
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("image")
    ))
}

pub fn find_existing_sidecar_thumbnail(source: &Path) -> Option<PathBuf> {
    let thumb = sidecar_thumbnail_path(source);
    if thumb.is_file() {
        Some(thumb)
    } else {
        None
    }
}

pub fn schedule_sidecar_thumbnail(source: PathBuf) {
    let dest = sidecar_thumbnail_path(&source);
    schedule_jpeg_thumbnail(source, dest);
}
