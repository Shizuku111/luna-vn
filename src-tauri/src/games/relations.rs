use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{chrono_like_now, LibraryDb};

use super::cover::attach_cover_path;
use super::{map_game_row_at, LibraryGame};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveGameRelationInput {
    pub related_game_id: i64,
    pub relation: Option<String>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LibraryGameRelation {
    pub game_id: i64,
    pub related_game_id: i64,
    pub relation: String,
    pub sort_order: i32,
    pub game: LibraryGame,
}

#[tauri::command]
pub fn save_library_game_relations(
    db: State<'_, LibraryDb>,
    game_id: i64,
    relations: Vec<SaveGameRelationInput>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|err| err.to_string())?;
    let exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM games WHERE id = ?1)",
            params![game_id],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())?;
    if !exists {
        return Err("游戏不存在".to_string());
    }

    conn.execute(
        "DELETE FROM game_relations WHERE game_id = ?1",
        params![game_id],
    )
    .map_err(|err| err.to_string())?;

    let now = chrono_like_now();
    for (index, item) in relations.iter().enumerate() {
        if item.related_game_id == game_id {
            continue;
        }
        let related_exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM games WHERE id = ?1)",
                params![item.related_game_id],
                |row| row.get(0),
            )
            .map_err(|err| err.to_string())?;
        if !related_exists {
            continue;
        }

        let relation = item
            .relation
            .as_ref()
            .map(|value| value.trim().to_string())
            .unwrap_or_default();
        let sort_order = item.sort_order.unwrap_or(index as i32);

        conn.execute(
            r#"
            INSERT INTO game_relations (game_id, related_game_id, relation, sort_order, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT(game_id, related_game_id) DO UPDATE SET
              relation = excluded.relation,
              sort_order = excluded.sort_order
            "#,
            params![game_id, item.related_game_id, relation, sort_order, now],
        )
        .map_err(|err| err.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn list_library_game_relations(
    db: State<'_, LibraryDb>,
    game_id: i64,
) -> Result<Vec<LibraryGameRelation>, String> {
    let rows = {
        let conn = db.0.lock().map_err(|err| err.to_string())?;
        let mut stmt = conn
            .prepare(
                r#"
                SELECT
                  gr.related_game_id,
                  gr.relation,
                  gr.sort_order,
                  g.id, g.bangumi_id, g.type, g.name, g.name_cn, g.summary, g.date, g.image, g.images,
                  g.score, g.rank, g.tags, g.nsfw, g.infobox, g.launch_path, g.status, g.region_launch,
                  g.favorite, g.wishlist, g.last_launched_at, g.created_at, g.updated_at
                FROM game_relations gr
                INNER JOIN games g ON g.id = gr.related_game_id
                WHERE gr.game_id = ?1
                ORDER BY gr.sort_order ASC, gr.related_game_id ASC
                "#,
            )
            .map_err(|err| err.to_string())?;

        let mapped = stmt
            .query_map(params![game_id], |row| {
                let related_game_id: i64 = row.get(0)?;
                let relation: String = row.get(1)?;
                let sort_order: i32 = row.get(2)?;
                let game = map_game_row_at(row, 3)?;
                Ok((related_game_id, relation, sort_order, game))
            })
            .map_err(|err| err.to_string())?;

        let mut items = Vec::new();
        for row in mapped {
            items.push(row.map_err(|err| err.to_string())?);
        }
        items
    };

    Ok(rows
        .into_iter()
        .map(|(related_game_id, relation, sort_order, game)| LibraryGameRelation {
            game_id,
            related_game_id,
            relation,
            sort_order,
            game: attach_cover_path(game),
        })
        .collect())
}
