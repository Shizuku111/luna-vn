
mod bangumi_token;
mod characters;
mod db;
mod dialog;
mod download;
mod games;
mod image_cache;
mod image_util;
mod persons;
mod settings;
mod tray;
mod update;

use tauri::Manager;

#[cfg(windows)]
fn disable_windows_ghosting() {
    #[link(name = "user32")]
    extern "system" {
        fn DisableProcessWindowsGhosting();
    }
    unsafe {
        DisableProcessWindowsGhosting();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(windows)]
    disable_windows_ghosting();

    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = tray::show_main(app);
        }));
    }

    builder
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let db = db::init_db(app.handle()).map_err(|err| {
                Box::<dyn std::error::Error>::from(err)
            })?;
            let image_cache = image_cache::init_image_cache(app.handle()).map_err(|err| {
                Box::<dyn std::error::Error>::from(err)
            })?;
            app.manage(db);
            app.manage(image_cache);
            app.manage(games::BatchImportScanControl::default());
            tray::setup_system_tray(app.handle()).map_err(|err| {
                Box::<dyn std::error::Error>::from(err)
            })?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            bangumi_token::get_bangumi_token,
            bangumi_token::set_bangumi_token,
            bangumi_token::delete_bangumi_token,
            games::save_library_game,
            games::save_manual_library_game,
            games::scan_batch_import_root,
            games::cancel_batch_import_scan,
            games::list_library_games,
            games::list_library_games_basic,
            games::get_library_game,
            games::ensure_library_game_cover,
            games::update_library_game,
            games::update_library_game_status,
            games::update_library_game_region_launch,
            games::update_library_game_favorite,
            games::update_library_game_wishlist,
            games::archive_library_game,
            games::unarchive_library_game,
            games::list_recent_archive_tags,
            games::launch_library_game,
            games::reveal_library_game,
            games::delete_library_game,
            games::list_recent_game_logs,
            games::list_library_game_logs,
            games::relations::save_library_game_relations,
            games::relations::list_library_game_relations,
            settings::clear_library_data,
            settings::clear_image_cache,
            settings::open_image_cache_dir,
            settings::quit_app,
            settings::show_main_window,
            image_cache::ensure_entity_image,
            image_cache::resolve_entity_image,
            characters::delete_library_character,
            characters::get_library_character,
            characters::list_character_games,
            characters::list_library_game_characters,
            characters::list_library_characters,
            characters::save_library_game_characters,
            characters::upsert_library_character,
            characters::link_character_games_by_bangumi,
            characters::update_library_character_favorite,
            persons::delete_library_person,
            persons::get_library_person,
            persons::list_person_characters,
            persons::list_person_participations,
            persons::list_library_persons,
            persons::list_library_game_persons,
            persons::save_library_persons,
            persons::upsert_library_person,
            persons::link_person_relations_by_bangumi,
            persons::update_library_person_favorite,
            update::check_app_update,
            update::download_and_install_update,
            dialog::pick_file_at_default
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
