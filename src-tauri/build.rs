fn app_version() -> String {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR");
    let path = std::path::Path::new(&manifest_dir).join("../package.json");
    let text = std::fs::read_to_string(&path)
        .unwrap_or_else(|err| panic!("读取 {} 失败：{err}", path.display()));
    let marker = "\"version\"";
    let index = text
        .find(marker)
        .expect("package.json 缺少 version");
    let rest = text[index + marker.len()..].trim_start();
    let rest = rest
        .strip_prefix(':')
        .expect("package.json version 格式无效")
        .trim_start();
    let rest = rest
        .strip_prefix('"')
        .expect("package.json version 格式无效");
    let end = rest.find('"').expect("package.json version 格式无效");
    rest[..end].to_string()
}

fn main() {
    let version = app_version();
    println!("cargo:rustc-env=LUNA_VN_VERSION={version}");
    println!("cargo:rerun-if-changed=../package.json");
    tauri_build::build()
}
