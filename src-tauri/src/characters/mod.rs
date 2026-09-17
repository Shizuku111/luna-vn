use rusqlite::{params, Row};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{chrono_like_now, LibraryDb};
use crate::image_cache::{self, EntityImageKind, ImageCacheRoot};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveLibraryCharacterInput {
    pub id: i64,
    pub name: String,
    #[serde(rename = "type")]
    pub character_type: i32,
    pub summary: Option<String>,
    pub images: Option<serde_json::Value>,
    pub infobox: Option<serde_json::Value>,
    pub gender: Option<String>,
    pub blood_type: Option<i64>,
    pub birth_year: Option<i64>,
    pub birth_mon: Option<i64>,
    pub birth_day: Option<i64>,
    pub nsfw: Option<bool>,
    pub relation: String,
    pub actors: Option<serde_json::Value>,
    pub sort_order: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveLibraryCharacterDetailInput {
    pub id: i64,
    pub name: String,
    #[serde(rename = "type")]
    pub character_type: i32,
    pub summary: Option<String>,
    pub images: Option<serde_json::Value>,
    pub infobox: Option<serde_json::Value>,
    pub gender: Option<String>,
    pub blood_type: Option<i64>,
    pub birth_year: Option<i64>,
    pub birth_mon: Option<i64>,
    pub birth_day: Option<i64>,
    pub nsfw: Option<bool>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CharacterGameAppearance {
    pub id: i64,
    pub bangumi_id: i64,
    pub name: String,
    pub name_cn: String,
    pub image: Option<String>,
    pub relation: String,
    pub actors: Vec<serde_json::Value>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LibraryCharacter {
    pub id: i64,
    pub name: String,
    #[serde(rename = "type")]
    pub character_type: i32,
    pub summary: Option<String>,
    pub images: Option<serde_json::Value>,
    pub infobox: Option<serde_json::Value>,
    pub gender: Option<String>,
    pub blood_type: Option<i64>,
    pub birth_year: Option<i64>,
    pub birth_mon: Option<i64>,
    pub birth_day: Option<i64>,
    pub nsfw: bool,
    pub favorite: bool,
    pub relation: String,
    pub actors: Vec<serde_json::Value>,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

fn map_library_character_row(row: &Row<'_>) -> rusqlite::Result<LibraryCharacter> {
    let images_raw: Option<String> = row.get(3)?;
    let infobox_raw: Option<String> = row.get(5)?;
    let nsfw: i64 = row.get(11)?;
    let favorite: i64 = row.get(12)?;
    let actors_raw: String = row.get(14)?;

    Ok(LibraryCharacter {
        id: row.get(0)?,
        name: row.get(1)?,
        character_type: row.get(2)?,
        images: images_raw.and_then(|value| serde_json::from_str(&value).ok()),
        summary: row.get(4)?,
        infobox: infobox_raw.and_then(|value| serde_json::from_str(&value).ok()),
        gender: row.get(6)?,
        blood_type: row.get(7)?,
        birth_year: row.get(8)?,
        birth_mon: row.get(9)?,
        birth_day: row.get(10)?,
        nsfw: nsfw != 0,
        favorite: favorite != 0,
        relation: row.get(13)?,
        actors: serde_json::from_str(&actors_raw).unwrap_or_default(),
        sort_order: row.get(15)?,
        created_at: row.get(16)?,
        updated_at: row.get(17)?,
    })
}

fn map_library_character_base_row(row: &Row<'_>) -> rusqlite::Result<LibraryCharacter> {
    let images_raw: Option<String> = row.get(3)?;
    let infobox_raw: Option<String> = row.get(5)?;
    let nsfw: i64 = row.get(11)?;
    let favorite: i64 = row.get(12)?;

    Ok(LibraryCharacter {
        id: row.get(0)?,
        name: row.get(1)?,
        character_type: row.get(2)?,
        images: images_raw.and_then(|value| serde_json::from_str(&value).ok()),
        summary: row.get(4)?,
        infobox: infobox_raw.and_then(|value| serde_json::from_str(&value).ok()),
        gender: row.get(6)?,
        blood_type: row.get(7)?,
        birth_year: row.get(8)?,
        birth_mon: row.get(9)?,
        birth_day: row.get(10)?,
        nsfw: nsfw != 0,
        favorite: favorite != 0,
        relation: String::new(),
        actors: Vec::new(),
        sort_order: 0,
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
    })
}

#[tauri::command]
pub fn get_library_character(
    db: State<'_, LibraryDb>,
    id: i64,
) -> Result<LibraryCharacter, String> {
    let conn = db.0.lock().map_err(|err| err.to_string())?;
    conn.query_row(
        r#"
        SELECT
          id, name, type, images, summary, infobox,
          gender, blood_type, birth_year, birth_mon, birth_day,
          nsfw, favorite, created_at, updated_at
        FROM characters
        WHERE id = ?1
        "#,
        params![id],
        map_library_character_base_row,
    )
    .map_err(|err| match err {
        rusqlite::Error::QueryReturnedNoRows => "角色不存在".to_string(),
        other => other.to_string(),
    })
}

#[tauri::command]
pub fn list_character_games(
    db: State<'_, LibraryDb>,
    character_id: i64,
) -> Result<Vec<CharacterGameAppearance>, String> {
    use std::collections::{HashMap, HashSet};

    let conn = db.0.lock().map_err(|err| err.to_string())?;
    let mut stmt = conn
        .prepare(
            r#"
            SELECT
              g.id, g.bangumi_id, g.name, g.name_cn, g.image,
              gc.relation, gc.actors, gc.created_at
            FROM game_characters gc
            INNER JOIN games g ON g.id = gc.game_id
            WHERE gc.character_id = ?1
            ORDER BY
              CASE WHEN g.date IS NULL OR TRIM(g.date) = '' THEN 1 ELSE 0 END ASC,
              g.date DESC,
              g.id DESC
            "#,
        )
        .map_err(|err| err.to_string())?;

    let rows = stmt
        .query_map(params![character_id], |row| {
            let actors_raw: String = row.get(6)?;
            Ok(CharacterGameAppearance {
                id: row.get(0)?,
                bangumi_id: row.get(1)?,
                name: row.get(2)?,
                name_cn: row.get(3)?,
                image: row.get(4)?,
                relation: row.get(5)?,
                actors: serde_json::from_str(&actors_raw).unwrap_or_default(),
                created_at: row.get(7)?,
            })
        })
        .map_err(|err| err.to_string())?;

    let mut appearances = Vec::new();
    for row in rows {
        appearances.push(row.map_err(|err| err.to_string())?);
    }

    let mut person_ids = HashSet::new();
    let mut game_ids = HashSet::new();
    for appearance in &appearances {
        game_ids.insert(appearance.id);
        for actor in &appearance.actors {
            let Some(obj) = actor.as_object() else {
                continue;
            };
            let person_id = obj
                .get("id")
                .and_then(|value| value.as_i64())
                .unwrap_or(0);
            if person_id > 0 {
                person_ids.insert(person_id);
            }
        }
    }

    let mut person_name_cn: HashMap<i64, Option<String>> = HashMap::new();
    let mut person_relations: HashMap<(i64, i64), String> = HashMap::new();

    if !person_ids.is_empty() {
        let person_id_list: Vec<i64> = person_ids.into_iter().collect();
        let placeholders = person_id_list
            .iter()
            .map(|_| "?")
            .collect::<Vec<_>>()
            .join(",");
        let sql = format!(
            "SELECT id, infobox FROM persons WHERE id IN ({})",
            placeholders
        );
        let mut person_stmt = conn.prepare(&sql).map_err(|err| err.to_string())?;
        let person_params: Vec<&dyn rusqlite::ToSql> = person_id_list
            .iter()
            .map(|id| id as &dyn rusqlite::ToSql)
            .collect();
        let person_rows = person_stmt
            .query_map(person_params.as_slice(), |row| {
                let infobox_raw: Option<String> = row.get(1)?;
                Ok((
                    row.get::<_, i64>(0)?,
                    extract_name_cn_from_infobox(infobox_raw.as_deref()),
                ))
            })
            .map_err(|err| err.to_string())?;
        for row in person_rows {
            let (id, name_cn) = row.map_err(|err| err.to_string())?;
            person_name_cn.insert(id, name_cn);
        }

        if !game_ids.is_empty() {
            let game_id_list: Vec<i64> = game_ids.into_iter().collect();
            let game_placeholders = game_id_list
                .iter()
                .map(|_| "?")
                .collect::<Vec<_>>()
                .join(",");
            let person_placeholders = person_id_list
                .iter()
                .map(|_| "?")
                .collect::<Vec<_>>()
                .join(",");
            let sql = format!(
                r#"
                SELECT game_id, person_id, relation
                FROM game_persons
                WHERE game_id IN ({}) AND person_id IN ({})
                "#,
                game_placeholders, person_placeholders
            );
            let mut rel_stmt = conn.prepare(&sql).map_err(|err| err.to_string())?;
            let mut rel_values: Vec<i64> = Vec::with_capacity(game_id_list.len() + person_id_list.len());
            rel_values.extend(game_id_list.iter().copied());
            rel_values.extend(person_id_list.iter().copied());
            let rel_params: Vec<&dyn rusqlite::ToSql> = rel_values
                .iter()
                .map(|id| id as &dyn rusqlite::ToSql)
                .collect();
            let rel_rows = rel_stmt
                .query_map(rel_params.as_slice(), |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, String>(2)?,
                    ))
                })
                .map_err(|err| err.to_string())?;
            for row in rel_rows {
                let (game_id, person_id, relation) = row.map_err(|err| err.to_string())?;
                let trimmed = relation.trim().to_string();
                if !trimmed.is_empty() {
                    person_relations.insert((game_id, person_id), trimmed);
                }
            }
        }
    }

    for appearance in &mut appearances {
        let mut enriched = Vec::with_capacity(appearance.actors.len());
        for actor in appearance.actors.drain(..) {
            let Some(obj) = actor.as_object() else {
                enriched.push(actor);
                continue;
            };

            let mut next = obj.clone();
            let person_id = next
                .get("id")
                .and_then(|value| value.as_i64())
                .unwrap_or(0);

            let existing_relation = next
                .get("relation")
                .and_then(|value| value.as_str())
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string);

            let existing_name_cn = next
                .get("nameCn")
                .and_then(|value| value.as_str())
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string);

            let mut relation = existing_relation;
            let mut name_cn = existing_name_cn;

            if person_id > 0 {
                if relation.is_none() {
                    relation = person_relations
                        .get(&(appearance.id, person_id))
                        .cloned();
                }
                if name_cn.is_none() {
                    name_cn = person_name_cn.get(&person_id).cloned().flatten();
                }
            }

            let relation = relation.unwrap_or_else(|| "声优".to_string());
            next.insert(
                "relation".to_string(),
                serde_json::Value::String(relation),
            );
            if let Some(value) = name_cn {
                let actor_name = next
                    .get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .trim();
                if value != actor_name {
                    next.insert("nameCn".to_string(), serde_json::Value::String(value));
                }
            }
            enriched.push(serde_json::Value::Object(next));
        }
        appearance.actors = enriched;
    }

    Ok(appearances)
}

pub(crate) fn extract_name_cn_from_infobox(infobox_raw: Option<&str>) -> Option<String> {
    const KEYS: [&str; 4] = ["简体中文名", "中文名", "汉语", "汉译名"];
    let raw = infobox_raw?.trim();
    if raw.is_empty() {
        return None;
    }
    let items = serde_json::from_str::<Vec<serde_json::Value>>(raw).ok()?;
    for key in KEYS {
        for item in &items {
            let Some(obj) = item.as_object() else {
                continue;
            };
            if obj.get("key").and_then(|v| v.as_str()) != Some(key) {
                continue;
            }
            let text = match obj.get("value") {
                Some(serde_json::Value::String(s)) => s.trim().to_string(),
                Some(serde_json::Value::Array(entries)) => entries
                    .iter()
                    .filter_map(|entry| {
                        if let Some(s) = entry.as_str() {
                            let t = s.trim();
                            return (!t.is_empty()).then(|| t.to_string());
                        }
                        entry
                            .as_object()
                            .and_then(|o| o.get("v"))
                            .and_then(|v| v.as_str())
                            .map(str::trim)
                            .filter(|t| !t.is_empty())
                            .map(str::to_string)
                    })
                    .collect::<Vec<_>>()
                    .join("、"),
                _ => String::new(),
            };
            if !text.is_empty() {
                return Some(text);
            }
        }
    }
    None
}

fn cache_character_media(
    cache: &ImageCacheRoot,
    character_id: i64,
    images: &Option<serde_json::Value>,
    actors: Option<&serde_json::Value>,
    force: bool,
) {
    image_cache::schedule_cache_images_value(
        cache.0.clone(),
        EntityImageKind::Character,
        character_id,
        images,
        force,
    );

    let Some(actors) = actors.and_then(|value| value.as_array()) else {
        return;
    };
    for actor in actors {
        let Some(person_id) = actor.get("id").and_then(|value| value.as_i64()) else {
            continue;
        };
        if person_id <= 0 {
            continue;
        }
        let images = actor.get("images").cloned();
        image_cache::schedule_cache_images_value(
            cache.0.clone(),
            EntityImageKind::Person,
            person_id,
            &images,
            false,
        );
    }
}

#[tauri::command]
pub fn upsert_library_character(
    db: State<'_, LibraryDb>,
    cache: State<'_, ImageCacheRoot>,
    character: SaveLibraryCharacterDetailInput,
) -> Result<LibraryCharacter, String> {
    let conn = db.0.lock().map_err(|err| err.to_string())?;
    let now = chrono_like_now();

    let images_json = character
        .images
        .as_ref()
        .map(serde_json::to_string)
        .transpose()
        .map_err(|err| err.to_string())?;
    let infobox_json = character
        .infobox
        .as_ref()
        .map(serde_json::to_string)
        .transpose()
        .map_err(|err| err.to_string())?;
    let nsfw = if character.nsfw.unwrap_or(false) { 1 } else { 0 };

    conn.execute(
        r#"
        INSERT INTO characters (
          id, name, type, images, summary, infobox,
          gender, blood_type, birth_year, birth_mon, birth_day,
          nsfw, created_at, updated_at
        ) VALUES (
          ?1, ?2, ?3, ?4, ?5, ?6,
          ?7, ?8, ?9, ?10, ?11,
          ?12, ?13, ?14
        )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          type = excluded.type,
          images = excluded.images,
          summary = excluded.summary,
          infobox = excluded.infobox,
          gender = excluded.gender,
          blood_type = excluded.blood_type,
          birth_year = excluded.birth_year,
          birth_mon = excluded.birth_mon,
          birth_day = excluded.birth_day,
          nsfw = excluded.nsfw,
          updated_at = excluded.updated_at
        "#,
        params![
            character.id,
            character.name,
            character.character_type,
            images_json,
            character.summary,
            infobox_json,
            character.gender,
            character.blood_type,
            character.birth_year,
            character.birth_mon,
            character.birth_day,
            nsfw,
            now,
            now,
        ],
    )
    .map_err(|err| err.to_string())?;

    drop(conn);
    cache_character_media(&cache, character.id, &character.images, None, true);
    get_library_character(db, character.id)
}

#[tauri::command]
pub fn list_library_game_characters(
    db: State<'_, LibraryDb>,
    game_id: i64,
) -> Result<Vec<LibraryCharacter>, String> {
    let conn = db.0.lock().map_err(|err| err.to_string())?;
    let mut stmt = conn
        .prepare(
            r#"
            SELECT
              c.id, c.name, c.type, c.images, c.summary, c.infobox,
              c.gender, c.blood_type, c.birth_year, c.birth_mon, c.birth_day,
              c.nsfw, c.favorite, gc.relation, gc.actors, gc.sort_order,
              c.created_at, c.updated_at
            FROM game_characters gc
            INNER JOIN characters c ON c.id = gc.character_id
            WHERE gc.game_id = ?1
            ORDER BY
              CASE TRIM(gc.relation)
                WHEN '主角' THEN 0
                WHEN '配角' THEN 1
                WHEN '客串' THEN 2
                WHEN '闲角' THEN 3
                ELSE 4
              END ASC,
              gc.sort_order DESC,
              c.created_at ASC,
              gc.rowid ASC
            "#,
        )
        .map_err(|err| err.to_string())?;

    let rows = stmt
        .query_map(params![game_id], map_library_character_row)
        .map_err(|err| err.to_string())?;

    let mut characters = Vec::new();
    for row in rows {
        characters.push(row.map_err(|err| err.to_string())?);
    }
    Ok(characters)
}

#[tauri::command]
pub fn delete_library_character(
    db: State<'_, LibraryDb>,
    cache: State<'_, ImageCacheRoot>,
    id: i64,
) -> Result<(), String> {
    let mut conn = db.0.lock().map_err(|err| err.to_string())?;
    let tx = conn.transaction().map_err(|err| err.to_string())?;

    tx.execute(
        "DELETE FROM game_characters WHERE character_id = ?1",
        params![id],
    )
    .map_err(|err| err.to_string())?;
    tx.execute(
        "DELETE FROM character_persons WHERE character_id = ?1",
        params![id],
    )
    .map_err(|err| err.to_string())?;

    let removed = tx
        .execute("DELETE FROM characters WHERE id = ?1", params![id])
        .map_err(|err| err.to_string())?;
    if removed == 0 {
        return Err("角色不存在".to_string());
    }

    tx.commit().map_err(|err| err.to_string())?;
    image_cache::remove_cached(&cache.0, EntityImageKind::Character, id);
    Ok(())
}

#[tauri::command]
pub fn list_library_characters(
    db: State<'_, LibraryDb>,
) -> Result<Vec<LibraryCharacter>, String> {
    let conn = db.0.lock().map_err(|err| err.to_string())?;
    let mut stmt = conn
        .prepare(
            r#"
            SELECT
              id, name, type, images, summary, infobox,
              gender, blood_type, birth_year, birth_mon, birth_day,
              nsfw, favorite, created_at, updated_at
            FROM characters
            ORDER BY name COLLATE NOCASE ASC, id ASC
            "#,
        )
        .map_err(|err| err.to_string())?;

    let rows = stmt
        .query_map([], map_library_character_base_row)
        .map_err(|err| err.to_string())?;

    let mut characters = Vec::new();
    for row in rows {
        characters.push(row.map_err(|err| err.to_string())?);
    }
    Ok(characters)
}

#[tauri::command]
pub fn save_library_game_characters(
    db: State<'_, LibraryDb>,
    cache: State<'_, ImageCacheRoot>,
    game_id: i64,
    characters: Vec<SaveLibraryCharacterInput>,
    replace: Option<bool>,
) -> Result<Vec<LibraryCharacter>, String> {
    let mut conn = db.0.lock().map_err(|err| err.to_string())?;

    let exists: i64 = conn
        .query_row(
            "SELECT COUNT(1) FROM games WHERE id = ?1",
            params![game_id],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())?;
    if exists == 0 {
        return Err("游戏不存在".to_string());
    }

    let now = chrono_like_now();
    let tx = conn.transaction().map_err(|err| err.to_string())?;

    if replace.unwrap_or(false) {
        tx.execute(
            "DELETE FROM game_characters WHERE game_id = ?1",
            params![game_id],
        )
        .map_err(|err| err.to_string())?;
    }

    for character in &characters {
        let images_json = character
            .images
            .as_ref()
            .map(serde_json::to_string)
            .transpose()
            .map_err(|err| err.to_string())?;
        let infobox_json = character
            .infobox
            .as_ref()
            .map(serde_json::to_string)
            .transpose()
            .map_err(|err| err.to_string())?;
        let actors_json = character
            .actors
            .as_ref()
            .map(serde_json::to_string)
            .transpose()
            .map_err(|err| err.to_string())?
            .unwrap_or_else(|| "[]".to_string());
        let nsfw = if character.nsfw.unwrap_or(false) { 1 } else { 0 };
        let relation = character.relation.trim();

        tx.execute(
            r#"
            INSERT INTO characters (
              id, name, type, images, summary, infobox,
              gender, blood_type, birth_year, birth_mon, birth_day,
              nsfw, created_at, updated_at
            ) VALUES (
              ?1, ?2, ?3, ?4, ?5, ?6,
              ?7, ?8, ?9, ?10, ?11,
              ?12, ?13, ?14
            )
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              type = excluded.type,
              images = excluded.images,
              summary = excluded.summary,
              infobox = excluded.infobox,
              gender = excluded.gender,
              blood_type = excluded.blood_type,
              birth_year = excluded.birth_year,
              birth_mon = excluded.birth_mon,
              birth_day = excluded.birth_day,
              nsfw = excluded.nsfw,
              updated_at = excluded.updated_at
            "#,
            params![
                character.id,
                character.name,
                character.character_type,
                images_json,
                character.summary,
                infobox_json,
                character.gender,
                character.blood_type,
                character.birth_year,
                character.birth_mon,
                character.birth_day,
                nsfw,
                now,
                now,
            ],
        )
        .map_err(|err| err.to_string())?;

        tx.execute(
            r#"
            INSERT INTO game_characters (
              game_id, character_id, relation, actors, sort_order, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(game_id, character_id) DO UPDATE SET
              relation = excluded.relation,
              actors = excluded.actors,
              sort_order = excluded.sort_order
            "#,
            params![
                game_id,
                character.id,
                relation,
                actors_json,
                character.sort_order,
                now,
            ],
        )
        .map_err(|err| err.to_string())?;
    }

    tx.commit().map_err(|err| err.to_string())?;

    let mut stmt = conn
        .prepare(
            r#"
            SELECT
              c.id, c.name, c.type, c.images, c.summary, c.infobox,
              c.gender, c.blood_type, c.birth_year, c.birth_mon, c.birth_day,
              c.nsfw, c.favorite, gc.relation, gc.actors, gc.sort_order,
              c.created_at, c.updated_at
            FROM game_characters gc
            INNER JOIN characters c ON c.id = gc.character_id
            WHERE gc.game_id = ?1
            ORDER BY
              CASE TRIM(gc.relation)
                WHEN '主角' THEN 0
                WHEN '配角' THEN 1
                WHEN '客串' THEN 2
                WHEN '闲角' THEN 3
                ELSE 4
              END ASC,
              gc.sort_order DESC,
              c.created_at ASC,
              gc.rowid ASC
            "#,
        )
        .map_err(|err| err.to_string())?;

    let rows = stmt
        .query_map(params![game_id], map_library_character_row)
        .map_err(|err| err.to_string())?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|err| err.to_string())?);
    }
    drop(stmt);
    drop(conn);

    for character in &characters {
        cache_character_media(
            &cache,
            character.id,
            &character.images,
            character.actors.as_ref(),
            false,
        );
    }

    Ok(result)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CharacterGameBangumiLinkInput {
    pub bangumi_id: i64,
    pub relation: Option<String>,
}

#[tauri::command]
pub fn link_character_games_by_bangumi(
    db: State<'_, LibraryDb>,
    character_id: i64,
    links: Vec<CharacterGameBangumiLinkInput>,
) -> Result<i64, String> {
    let mut conn = db.0.lock().map_err(|err| err.to_string())?;

    let exists: i64 = conn
        .query_row(
            "SELECT COUNT(1) FROM characters WHERE id = ?1",
            params![character_id],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())?;
    if exists == 0 {
        return Err("角色不存在".to_string());
    }

    let now = chrono_like_now();
    let tx = conn.transaction().map_err(|err| err.to_string())?;
    let mut linked: i64 = 0;

    for link in &links {
        let game_id: Result<i64, rusqlite::Error> = tx.query_row(
            "SELECT id FROM games WHERE bangumi_id = ?1",
            params![link.bangumi_id],
            |row| row.get(0),
        );
        let Ok(game_id) = game_id else {
            continue;
        };

        let relation = link
            .relation
            .as_deref()
            .map(str::trim)
            .unwrap_or("")
            .to_string();

        tx.execute(
            r#"
            INSERT INTO game_characters (
              game_id, character_id, relation, actors, sort_order, created_at
            ) VALUES (?1, ?2, ?3, '[]', 0, ?4)
            ON CONFLICT(game_id, character_id) DO UPDATE SET
              relation = CASE
                WHEN excluded.relation = '' THEN game_characters.relation
                ELSE excluded.relation
              END
            "#,
            params![game_id, character_id, relation, now],
        )
        .map_err(|err| err.to_string())?;
        linked += 1;
    }

    tx.commit().map_err(|err| err.to_string())?;
    Ok(linked)
}

#[tauri::command]
pub fn update_library_character_favorite(
    db: State<'_, LibraryDb>,
    id: i64,
    favorite: bool,
) -> Result<LibraryCharacter, String> {
    let conn = db.0.lock().map_err(|err| err.to_string())?;
    let now = chrono_like_now();
    let value = if favorite { 1 } else { 0 };
    let updated = conn
        .execute(
            "UPDATE characters SET favorite = ?1, updated_at = ?2 WHERE id = ?3",
            params![value, now, id],
        )
        .map_err(|err| err.to_string())?;

    if updated == 0 {
        return Err("角色不存在".to_string());
    }

    drop(conn);
    get_library_character(db, id)
}
