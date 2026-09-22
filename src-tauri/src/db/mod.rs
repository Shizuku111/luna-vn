use std::sync::Mutex;

use rusqlite::Connection;
use tauri::{AppHandle, Manager};

pub struct LibraryDb(pub Mutex<Connection>);

fn ensure_schema(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS games (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bangumi_id INTEGER NOT NULL UNIQUE,
          type INTEGER NOT NULL,
          name TEXT NOT NULL,
          name_cn TEXT NOT NULL DEFAULT '',
          summary TEXT,
          date TEXT,
          image TEXT,
          images TEXT,
          score REAL,
          rank INTEGER,
          tags TEXT NOT NULL DEFAULT '[]',
          nsfw INTEGER NOT NULL DEFAULT 0,
          infobox TEXT,
          launch_path TEXT NOT NULL,
          status INTEGER NOT NULL DEFAULT 0,
          region_launch INTEGER NOT NULL DEFAULT 0,
          favorite INTEGER NOT NULL DEFAULT 0,
          wishlist INTEGER NOT NULL DEFAULT 0,
          last_launched_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        "#,
    )
    .map_err(|err| err.to_string())?;

    let mut stmt = conn
        .prepare("PRAGMA table_info(games)")
        .map_err(|err| err.to_string())?;
    let columns = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;

    if !columns.iter().any(|name| name == "status") {
        conn.execute(
            "ALTER TABLE games ADD COLUMN status INTEGER NOT NULL DEFAULT 0",
            [],
        )
        .map_err(|err| err.to_string())?;
    }

    if !columns.iter().any(|name| name == "last_launched_at") {
        conn.execute("ALTER TABLE games ADD COLUMN last_launched_at TEXT", [])
            .map_err(|err| err.to_string())?;
    }

    if !columns.iter().any(|name| name == "region_launch") {
        conn.execute(
            "ALTER TABLE games ADD COLUMN region_launch INTEGER NOT NULL DEFAULT 0",
            [],
        )
        .map_err(|err| err.to_string())?;
    }

    if !columns.iter().any(|name| name == "favorite") {
        conn.execute(
            "ALTER TABLE games ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0",
            [],
        )
        .map_err(|err| err.to_string())?;
    }

    if !columns.iter().any(|name| name == "wishlist") {
        conn.execute(
            "ALTER TABLE games ADD COLUMN wishlist INTEGER NOT NULL DEFAULT 0",
            [],
        )
        .map_err(|err| err.to_string())?;
    }

    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS characters (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          type INTEGER NOT NULL,
          images TEXT,
          summary TEXT,
          infobox TEXT,
          gender TEXT,
          blood_type INTEGER,
          birth_year INTEGER,
          birth_mon INTEGER,
          birth_day INTEGER,
          nsfw INTEGER NOT NULL DEFAULT 0,
          favorite INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS game_characters (
          game_id INTEGER NOT NULL,
          character_id INTEGER NOT NULL,
          relation TEXT NOT NULL DEFAULT '',
          actors TEXT NOT NULL DEFAULT '[]',
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          PRIMARY KEY (game_id, character_id),
          FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
          FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS persons (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          type INTEGER NOT NULL,
          career TEXT NOT NULL DEFAULT '[]',
          images TEXT,
          summary TEXT,
          infobox TEXT,
          gender TEXT,
          blood_type INTEGER,
          birth_year INTEGER,
          birth_mon INTEGER,
          birth_day INTEGER,
          favorite INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS character_persons (
          character_id INTEGER NOT NULL,
          person_id INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (character_id, person_id),
          FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
          FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS game_persons (
          game_id INTEGER NOT NULL,
          person_id INTEGER NOT NULL,
          relation TEXT NOT NULL DEFAULT '',
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          PRIMARY KEY (game_id, person_id),
          FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
          FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS game_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          game_id INTEGER NOT NULL,
          bangumi_id INTEGER NOT NULL,
          action TEXT NOT NULL,
          session_id TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS game_relations (
          game_id INTEGER NOT NULL,
          related_game_id INTEGER NOT NULL,
          relation TEXT NOT NULL DEFAULT '',
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          PRIMARY KEY (game_id, related_game_id),
          FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
          FOREIGN KEY (related_game_id) REFERENCES games(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS archived (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          game_id INTEGER NOT NULL UNIQUE,
          tag TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_game_logs_game_id ON game_logs(game_id);
        CREATE INDEX IF NOT EXISTS idx_game_logs_action ON game_logs(action);
        CREATE INDEX IF NOT EXISTS idx_game_logs_created_at ON game_logs(created_at);
        CREATE INDEX IF NOT EXISTS idx_game_relations_related ON game_relations(related_game_id);
        CREATE INDEX IF NOT EXISTS idx_archived_game_id ON archived(game_id);
        "#,
    )
    .map_err(|err| err.to_string())?;

    ensure_table_favorite_column(conn, "characters")?;
    ensure_table_favorite_column(conn, "persons")?;

    Ok(())
}

fn ensure_table_favorite_column(conn: &Connection, table: &str) -> Result<(), String> {
    let pragma = format!("PRAGMA table_info({})", table);
    let mut stmt = conn.prepare(&pragma).map_err(|err| err.to_string())?;
    let columns = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|err| err.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| err.to_string())?;

    if !columns.iter().any(|name| name == "favorite") {
        let sql = format!(
            "ALTER TABLE {} ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0",
            table
        );
        conn.execute(&sql, []).map_err(|err| err.to_string())?;
    }
    Ok(())
}

pub fn init_db(app: &AppHandle) -> Result<LibraryDb, String> {
    let dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|err| err.to_string())?;

    let path = dir.join("lunavn.db");
    let conn = Connection::open(path).map_err(|err| err.to_string())?;
    conn.execute_batch(
        r#"
        PRAGMA journal_mode = WAL;
        PRAGMA busy_timeout = 5000;
        PRAGMA foreign_keys = ON;
        "#,
    )
    .map_err(|err| err.to_string())?;
    ensure_schema(&conn)?;
    conn.execute_batch(
        r#"
        CREATE INDEX IF NOT EXISTS idx_game_characters_character_id
          ON game_characters(character_id);
        CREATE INDEX IF NOT EXISTS idx_game_characters_game_id
          ON game_characters(game_id);
        CREATE INDEX IF NOT EXISTS idx_game_persons_person_id
          ON game_persons(person_id);
        CREATE INDEX IF NOT EXISTS idx_game_persons_game_id
          ON game_persons(game_id);
        CREATE INDEX IF NOT EXISTS idx_character_persons_person_id
          ON character_persons(person_id);
        CREATE INDEX IF NOT EXISTS idx_character_persons_character_id
          ON character_persons(character_id);
        "#,
    )
    .map_err(|err| err.to_string())?;

    Ok(LibraryDb(Mutex::new(conn)))
}

pub(crate) fn chrono_like_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    secs.to_string()
}
