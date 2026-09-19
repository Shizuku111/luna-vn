use serde::Deserialize;
use tauri::{AppHandle, Manager, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

/// Shell parsing name for This PC. The dialog plugin's `defaultPath` cannot
/// use it: the path does not exist, so the plugin treats the GUID as a file
/// name and Windows reopens the last folder.
const THIS_PC: &str = "::{20D04FE0-3AEA-1069-A2D8-08002B30309D}";

#[derive(Deserialize)]
pub(crate) struct DialogFilter {
    name: String,
    extensions: Vec<String>,
}

#[tauri::command]
pub async fn pick_file_at_default(
    app: AppHandle,
    window: WebviewWindow,
    title: Option<String>,
    filters: Vec<DialogFilter>,
) -> Result<Option<String>, String> {
    let mut builder = app
        .dialog()
        .file()
        .set_parent(&window)
        .set_directory(THIS_PC);
    if let Some(title) = title {
        builder = builder.set_title(title);
    }
    for filter in &filters {
        let extensions: Vec<&str> = filter.extensions.iter().map(String::as_str).collect();
        builder = builder.add_filter(filter.name.as_str(), &extensions);
    }

    let Some(file) = builder.blocking_pick_file() else {
        return Ok(None);
    };
    let path = file
        .simplified()
        .into_path()
        .map_err(|err| err.to_string())?;
    window
        .state::<tauri::scope::Scopes>()
        .allow_file(&path)
        .map_err(|err| err.to_string())?;
    Ok(Some(path.to_string_lossy().into_owned()))
}
