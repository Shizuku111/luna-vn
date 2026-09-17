fn is_allowed_download_url(url: &str) -> bool {
    let Ok(parsed) = reqwest::Url::parse(url.trim()) else {
        return false;
    };
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return false;
    }
    let Some(host) = parsed.host_str() else {
        return false;
    };
    let host = host.to_ascii_lowercase();
    host == "bgm.tv" || host.ends_with(".bgm.tv")
}

pub fn assert_allowed_download_url(url: &str) -> Result<(), String> {
    if is_allowed_download_url(url) {
        Ok(())
    } else {
        Err("不允许从此地址下载图片".to_string())
    }
}

pub fn download_redirect_policy() -> reqwest::redirect::Policy {
    reqwest::redirect::Policy::custom(|attempt| {
        if attempt.previous().len() >= 5 {
            return attempt.error("重定向次数过多");
        }
        if is_allowed_download_url(attempt.url().as_str()) {
            attempt.follow()
        } else {
            attempt.error("不允许重定向到非白名单地址")
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_bgm_hosts() {
        assert!(is_allowed_download_url("https://lain.bgm.tv/pic/cover/l/ab/cd.jpg"));
        assert!(is_allowed_download_url("https://bgm.tv/img.png"));
        assert!(assert_allowed_download_url("https://api.bgm.tv/x").is_ok());
    }

    #[test]
    fn rejects_other_hosts() {
        assert!(!is_allowed_download_url("https://example.com/a.png"));
        assert!(!is_allowed_download_url("javascript:alert(1)"));
        assert!(assert_allowed_download_url("http://evil.test/a").is_err());
    }
}
