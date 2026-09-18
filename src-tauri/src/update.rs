use serde::Serialize;
use std::fs::File;
use std::io::{copy, Write};

use std::path::PathBuf;
use std::process::Command;
use tauri::AppHandle;

const GITHUB_REPO: &str = "Shizuku111/luna-vn";
const GITHUB_API_LATEST: &str =
    "https://api.github.com/repos/Shizuku111/luna-vn/releases/latest";
const USER_AGENT: &str = "luna-vn-updater";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub update_available: bool,
    pub download_url: Option<String>,
    pub release_name: Option<String>,
    pub html_url: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
struct GithubRelease {
    tag_name: String,
    name: Option<String>,
    html_url: Option<String>,
    draft: bool,
    prerelease: bool,
    assets: Vec<GithubAsset>,
}

#[derive(Debug, serde::Deserialize)]
struct GithubAsset {
    name: String,
    browser_download_url: String,
}

fn normalize_version(raw: &str) -> String {
    raw.trim().trim_start_matches(['v', 'V']).trim().to_string()
}

fn parse_version_parts(raw: &str) -> Vec<u64> {
    normalize_version(raw)
        .split('.')
        .map(|part| {
            part.chars()
                .take_while(|ch| ch.is_ascii_digit())
                .collect::<String>()
                .parse::<u64>()
                .unwrap_or(0)
        })
        .collect()
}

fn is_newer_version(latest: &str, current: &str) -> bool {
    let latest_parts = parse_version_parts(latest);
    let current_parts = parse_version_parts(current);
    let len = latest_parts.len().max(current_parts.len());
    for index in 0..len {
        let left = latest_parts.get(index).copied().unwrap_or(0);
        let right = current_parts.get(index).copied().unwrap_or(0);
        if left > right {
            return true;
        }
        if left < right {
            return false;
        }
    }
    false
}

fn pick_windows_installer(assets: &[GithubAsset]) -> Option<&GithubAsset> {
    let setup = assets.iter().find(|asset| {
        let name = asset.name.to_ascii_lowercase();
        name.ends_with("-setup.exe") || name.ends_with("_x64-setup.exe")
    });
    if setup.is_some() {
        return setup;
    }
    assets.iter().find(|asset| {
        let name = asset.name.to_ascii_lowercase();
        name.ends_with(".msi") && !name.contains(".sig")
    })
}

fn is_allowed_update_url(url: &str) -> bool {
    let Ok(parsed) = reqwest::Url::parse(url.trim()) else {
        return false;
    };
    if parsed.scheme() != "https" {
        return false;
    }
    let Some(host) = parsed.host_str() else {
        return false;
    };
    let host = host.to_ascii_lowercase();
    host == "github.com"
        || host == "api.github.com"
        || host == "objects.githubusercontent.com"
        || host == "release-assets.githubusercontent.com"
        || host.ends_with(".githubusercontent.com")
}

fn update_redirect_policy() -> reqwest::redirect::Policy {
    reqwest::redirect::Policy::custom(|attempt| {
        if attempt.previous().len() >= 8 {
            return attempt.error("重定向次数过多");
        }
        if is_allowed_update_url(attempt.url().as_str()) {
            attempt.follow()
        } else {
            attempt.error("不允许重定向到非白名单地址")
        }
    })
}

fn http_client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .redirect(update_redirect_policy())
        .user_agent(USER_AGENT)
        .build()
        .map_err(|err| format!("创建更新客户端失败：{}", err))
}

fn fetch_latest_release(client: &reqwest::blocking::Client) -> Result<GithubRelease, String> {
    let response = client
        .get(GITHUB_API_LATEST)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .map_err(|err| format!("检查更新失败：{}", err))?;

    if response.status().as_u16() == 404 {
        return Err("尚未发布任何版本".to_string());
    }
    if !response.status().is_success() {
        return Err(format!("检查更新失败：HTTP {}", response.status()));
    }

    response
        .json::<GithubRelease>()
        .map_err(|err| format!("解析更新信息失败：{}", err))
}

fn installer_temp_path(file_name: &str) -> Result<PathBuf, String> {
    let safe_name = PathBuf::from(file_name)
        .file_name()
        .map(|name| name.to_os_string())
        .ok_or_else(|| "安装包文件名无效".to_string())?;
    let dir = std::env::temp_dir().join(format!("luna-vn-update-{}", GITHUB_REPO.replace('/', "-")));
    std::fs::create_dir_all(&dir).map_err(|err| format!("创建临时目录失败：{}", err))?;
    Ok(dir.join(safe_name))
}

fn download_installer(client: &reqwest::blocking::Client, url: &str, dest: &PathBuf) -> Result<(), String> {
    if !is_allowed_update_url(url) {
        return Err("不允许从此地址下载更新".to_string());
    }

    let mut response = client
        .get(url)
        .send()
        .map_err(|err| format!("下载更新失败：{}", err))?;
    if !response.status().is_success() {
        return Err(format!("下载更新失败：HTTP {}", response.status()));
    }

    let mut file = File::create(dest).map_err(|err| format!("写入安装包失败：{}", err))?;
    copy(&mut response, &mut file).map_err(|err| format!("保存安装包失败：{}", err))?;
    file.flush()
        .map_err(|err| format!("保存安装包失败：{}", err))?;
    Ok(())
}

fn launch_installer(path: &PathBuf) -> Result<(), String> {
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    #[cfg(windows)]
    {
        if extension == "msi" {
            Command::new("msiexec")
                .arg("/i")
                .arg(path)
                .spawn()
                .map_err(|err| format!("启动安装程序失败：{}", err))?;
            return Ok(());
        }

        Command::new(path)
            .spawn()
            .map_err(|err| format!("启动安装程序失败：{}", err))?;
        return Ok(());
    }

    #[cfg(not(windows))]
    {
        let _ = extension;
        Err("当前平台暂不支持自动安装更新".to_string())
    }
}

#[tauri::command]
pub async fn check_app_update(app: AppHandle) -> Result<AppUpdateInfo, String> {
    let current_version = app.package_info().version.to_string();
    let current_version_for_compare = current_version.clone();

    let release = tauri::async_runtime::spawn_blocking(|| {
        let client = http_client()?;
        fetch_latest_release(&client)
    })
    .await
    .map_err(|err| format!("检查更新失败：{}", err))??;

    if release.draft || release.prerelease {
        return Ok(AppUpdateInfo {
            current_version,
            latest_version: normalize_version(&release.tag_name),
            update_available: false,
            download_url: None,
            release_name: release.name,
            html_url: release.html_url,
        });
    }

    let latest_version = normalize_version(&release.tag_name);
    let update_available = is_newer_version(&latest_version, &current_version_for_compare);
    let download_url = if update_available {
        pick_windows_installer(&release.assets).map(|asset| asset.browser_download_url.clone())
    } else {
        None
    };

    if update_available && download_url.is_none() {
        return Err("发现新版本，但未找到 Windows 安装包".to_string());
    }

    Ok(AppUpdateInfo {
        current_version,
        latest_version,
        update_available,
        download_url,
        release_name: release.name,
        html_url: release.html_url,
    })
}

#[tauri::command]
pub async fn download_and_install_update(app: AppHandle, url: String) -> Result<(), String> {
    let url = url.trim().to_string();
    if !is_allowed_update_url(&url) {
        return Err("不允许从此地址下载更新".to_string());
    }

    let file_name = reqwest::Url::parse(&url)
        .ok()
        .and_then(|parsed| {
            parsed
                .path_segments()
                .and_then(|mut segments| segments.next_back().map(|s| s.to_string()))
        })
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| "LunaVN-setup.exe".to_string());

    let dest = installer_temp_path(&file_name)?;
    let dest_for_download = dest.clone();
    let download_url = url.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let client = http_client()?;
        download_installer(&client, &download_url, &dest_for_download)
    })
    .await
    .map_err(|err| format!("下载更新失败：{}", err))??;

    launch_installer(&dest)?;

    // Quit after the installer starts so app files are not locked.
    let app_handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(800));
        app_handle.exit(0);
    });

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compares_versions() {
        assert!(is_newer_version("0.2.0", "0.1.0"));
        assert!(is_newer_version("v1.0.0", "0.9.9"));
        assert!(!is_newer_version("0.1.0", "0.1.0"));
        assert!(!is_newer_version("0.1.0", "0.2.0"));
    }

    #[test]
    fn allows_github_hosts() {
        assert!(is_allowed_update_url(
            "https://api.github.com/repos/Shizuku111/luna-vn/releases/latest"
        ));
        assert!(is_allowed_update_url(
            "https://github.com/Shizuku111/luna-vn/releases/download/v0.1.0/app.msi"
        ));
        assert!(!is_allowed_update_url("https://evil.test/a.exe"));
    }
}
