use rusqlite::{params, Row};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{chrono_like_now, LibraryDb};
use crate::image_cache::{self, EntityImageKind, ImageCacheRoot};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveLibraryPersonInput {
    pub id: i64,
    pub name: String,
    #[serde(rename = "type")]
    pub person_type: i32,
    pub career: Option<serde_json::Value>,
    pub summary: Option<String>,
    pub images: Option<serde_json::Value>,
    pub infobox: Option<serde_json::Value>,
    pub gender: Option<String>,
    pub blood_type: Option<i64>,
    pub birth_year: Option<i64>,
    pub birth_mon: Option<i64>,
    pub birth_day: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveLibraryPersonDetailInput {
    pub id: i64,
    pub name: String,
    #[serde(rename = "type")]
    pub person_type: i32,
    pub career: Option<serde_json::Value>,
    pub summary: Option<String>,
    pub images: Option<serde_json::Value>,
    pub infobox: Option<serde_json::Value>,
    pub gender: Option<String>,
    pub blood_type: Option<i64>,
    pub birth_year: Option<i64>,
    pub birth_mon: Option<i64>,
    pub birth_day: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CharacterPersonLinkInput {
    pub character_id: i64,
    pub person_id: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GamePersonLinkInput {
    pub game_id: i64,
    pub person_id: i64,
    pub relation: Option<String>,
    pub sort_order: Option<i64>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LibraryPerson {
    pub id: i64,
    pub name: String,
    #[serde(rename = "type")]
    pub person_type: i32,
    pub career: Vec<String>,
    pub summary: Option<String>,
    pub images: Option<serde_json::Value>,
    pub infobox: Option<serde_json::Value>,
    pub gender: Option<String>,
    pub blood_type: Option<i64>,
    pub birth_year: Option<i64>,
    pub birth_mon: Option<i64>,
    pub birth_day: Option<i64>,
    pub favorite: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LibraryGamePerson {
    pub id: i64,
    pub name: String,
    #[serde(rename = "type")]
    pub person_type: i32,
    pub career: Vec<String>,
    pub summary: Option<String>,
    pub images: Option<serde_json::Value>,
    pub infobox: Option<serde_json::Value>,
    pub gender: Option<String>,
    pub blood_type: Option<i64>,
    pub birth_year: Option<i64>,
    pub birth_mon: Option<i64>,
    pub birth_day: Option<i64>,
    pub favorite: bool,
    pub relation: String,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

fn parse_person_relations(raw: &str) -> Vec<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }
    let Ok(values) = serde_json::from_str::<Vec<serde_json::Value>>(trimmed) else {
        return Vec::new();
    };
    values
        .into_iter()
        .filter_map(|value| match value {
            serde_json::Value::String(text) => {
                let text = text.trim().to_string();
                (!text.is_empty()).then_some(text)
            }
            other => {
                let text = other.to_string();
                let text = text.trim().trim_matches('"').to_string();
                (!text.is_empty()).then_some(text)
            }
        })
        .collect()
}

fn format_person_relations(raw: &str) -> String {
    parse_person_relations(raw).join("、")
}

fn map_library_person_row(row: &Row<'_>) -> rusqlite::Result<LibraryPerson> {
    let career_raw: String = row.get(3)?;
    let images_raw: Option<String> = row.get(4)?;
    let infobox_raw: Option<String> = row.get(6)?;
    let favorite: i64 = row.get(12)?;

    Ok(LibraryPerson {
        id: row.get(0)?,
        name: row.get(1)?,
        person_type: row.get(2)?,
        career: serde_json::from_str(&career_raw).unwrap_or_default(),
        images: images_raw.and_then(|value| serde_json::from_str(&value).ok()),
        summary: row.get(5)?,
        infobox: infobox_raw.and_then(|value| serde_json::from_str(&value).ok()),
        gender: row.get(7)?,
        blood_type: row.get(8)?,
        birth_year: row.get(9)?,
        birth_mon: row.get(10)?,
        birth_day: row.get(11)?,
        favorite: favorite != 0,
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
    })
}

fn map_library_game_person_row(row: &Row<'_>) -> rusqlite::Result<LibraryGamePerson> {
    let career_raw: String = row.get(3)?;
    let images_raw: Option<String> = row.get(4)?;
    let infobox_raw: Option<String> = row.get(6)?;
    let favorite: i64 = row.get(12)?;

    Ok(LibraryGamePerson {
        id: row.get(0)?,
        name: row.get(1)?,
        person_type: row.get(2)?,
        career: serde_json::from_str(&career_raw).unwrap_or_default(),
        images: images_raw.and_then(|value| serde_json::from_str(&value).ok()),
        summary: row.get(5)?,
        infobox: infobox_raw.and_then(|value| serde_json::from_str(&value).ok()),
        gender: row.get(7)?,
        blood_type: row.get(8)?,
        birth_year: row.get(9)?,
        birth_mon: row.get(10)?,
        birth_day: row.get(11)?,
        favorite: favorite != 0,
        relation: format_person_relations(&row.get::<_, String>(13)?),
        sort_order: row.get(14)?,
        created_at: row.get(15)?,
        updated_at: row.get(16)?,
    })
}

#[tauri::command]
pub fn get_library_person(
    db: State<'_, LibraryDb>,
    id: i64,
) -> Result<LibraryPerson, String> {
    let conn = db.0.lock().map_err(|err| err.to_string())?;
    conn.query_row(
        r#"
        SELECT
          id, name, type, career, images, summary, infobox,
          gender, blood_type, birth_year, birth_mon, birth_day,
          favorite, created_at, updated_at
        FROM persons
        WHERE id = ?1
        "#,
        params![id],
        map_library_person_row,
    )
    .map_err(|err| match err {
        rusqlite::Error::QueryReturnedNoRows => "人物不存在".to_string(),
        other => other.to_string(),
    })
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PersonCharacterGame {
    pub id: i64,
    pub bangumi_id: i64,
    pub name: String,
    pub name_cn: String,
    pub image: Option<String>,
    pub relation: String,
    pub date: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PersonCharacterAppearance {
    pub id: i64,
    pub name: String,
    pub name_cn: Option<String>,
    pub images: Option<serde_json::Value>,
    pub relation: String,
    pub games: Vec<PersonCharacterGame>,
}

fn actor_json_contains_person(actors_raw: &str, person_id: i64) -> bool {
    let Ok(actors) = serde_json::from_str::<Vec<serde_json::Value>>(actors_raw) else {
        return false;
    };
    actors.iter().any(|actor| {
        actor
            .get("id")
            .and_then(|value| value.as_i64())
            .is_some_and(|id| id == person_id)
    })
}

#[tauri::command]
pub fn list_person_characters(
    db: State<'_, LibraryDb>,
    person_id: i64,
) -> Result<Vec<PersonCharacterAppearance>, String> {
    use std::collections::HashMap;

    let conn = db.0.lock().map_err(|err| err.to_string())?;
    let mut stmt = conn
        .prepare(
            r#"
            SELECT
              c.id, c.name, c.images, c.infobox,
              g.id, g.bangumi_id, g.name, g.name_cn, g.image, g.date,
              gc.relation, gc.actors,
              gp.relation AS person_relation
            FROM character_persons cp
            INNER JOIN characters c ON c.id = cp.character_id
            LEFT JOIN game_characters gc ON gc.character_id = c.id
            LEFT JOIN games g ON g.id = gc.game_id
            LEFT JOIN game_persons gp
              ON gp.game_id = g.id AND gp.person_id = ?1
            WHERE cp.person_id = ?1
            "#,
        )
        .map_err(|err| err.to_string())?;

    struct CharacterAcc {
        name: String,
        images: Option<serde_json::Value>,
        name_cn: Option<String>,
        relation: String,
        games: Vec<PersonCharacterGame>,
    }

    let rows = stmt
        .query_map(params![person_id], |row| {
            let images_raw: Option<String> = row.get(2)?;
            let infobox_raw: Option<String> = row.get(3)?;
            let character_id: i64 = row.get(0)?;
            let name: String = row.get(1)?;
            let images = images_raw.and_then(|value| serde_json::from_str(&value).ok());
            let name_cn =
                crate::characters::extract_name_cn_from_infobox(infobox_raw.as_deref());
            let game_id: Option<i64> = row.get(4)?;

            let game_opt = match game_id {
                Some(id) => {
                    let actors_raw: String = row.get(11)?;
                    Some((
                        PersonCharacterGame {
                            id,
                            bangumi_id: row.get(5)?,
                            name: row.get(6)?,
                            name_cn: row.get(7)?,
                            image: row.get(8)?,
                            relation: String::new(),
                            date: row.get(9)?,
                        },
                        row.get::<_, String>(10)?,
                        actors_raw,
                        row.get::<_, Option<String>>(12)?,
                    ))
                }
                None => None,
            };

            Ok((character_id, name, images, name_cn, game_opt))
        })
        .map_err(|err| err.to_string())?;

    let mut by_character: HashMap<i64, CharacterAcc> = HashMap::new();
    let mut character_order: Vec<i64> = Vec::new();

    for row in rows {
        let (character_id, name, images, name_cn, game_opt) =
            row.map_err(|err| err.to_string())?;

        let entry = by_character.entry(character_id).or_insert_with(|| {
            character_order.push(character_id);
            CharacterAcc {
                name,
                images,
                name_cn,
                relation: String::new(),
                games: Vec::new(),
            }
        });

        let Some((mut game, gc_relation, actors_raw, person_relation)) = game_opt else {
            continue;
        };
        if !actor_json_contains_person(&actors_raw, person_id) {
            continue;
        }
        if entry.relation.is_empty() {
            entry.relation = gc_relation.trim().to_string();
        }
        let relation = person_relation
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "声优".to_string());
        game.relation = relation;
        entry.games.push(game);
    }

    let mut appearances = Vec::with_capacity(character_order.len());
    for character_id in character_order {
        let Some(mut acc) = by_character.remove(&character_id) else {
            continue;
        };

        if !acc.games.is_empty() {
            acc.games.sort_by(|a, b| {
                let a_empty = a.date.as_deref().map(str::trim).unwrap_or("").is_empty();
                let b_empty = b.date.as_deref().map(str::trim).unwrap_or("").is_empty();
                match (a_empty, b_empty) {
                    (false, true) => std::cmp::Ordering::Less,
                    (true, false) => std::cmp::Ordering::Greater,
                    (true, true) => b.id.cmp(&a.id),
                    (false, false) => b
                        .date
                        .as_deref()
                        .unwrap_or("")
                        .cmp(a.date.as_deref().unwrap_or(""))
                        .then_with(|| b.id.cmp(&a.id)),
                }
            });
        } else {
            acc.relation = String::new();
        }

        let display_name_cn = acc.name_cn.filter(|value| value != &acc.name);
        appearances.push(PersonCharacterAppearance {
            id: character_id,
            name: acc.name,
            name_cn: display_name_cn,
            images: acc.images,
            relation: acc.relation,
            games: acc.games,
        });
    }

    appearances.sort_by(|a, b| {
        let a_date = a
            .games
            .first()
            .and_then(|game| game.date.as_deref())
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let b_date = b
            .games
            .first()
            .and_then(|game| game.date.as_deref())
            .map(str::trim)
            .filter(|value| !value.is_empty());
        match (a_date, b_date) {
            (Some(a_date), Some(b_date)) => b_date
                .cmp(a_date)
                .then_with(|| b.id.cmp(&a.id)),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(appearances)
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PersonGameParticipation {
    pub id: i64,
    pub bangumi_id: i64,
    pub name: String,
    pub name_cn: String,
    pub image: Option<String>,
    pub date: Option<String>,
    pub relations: Vec<String>,
}

#[tauri::command]
pub fn list_person_participations(
    db: State<'_, LibraryDb>,
    person_id: i64,
) -> Result<Vec<PersonGameParticipation>, String> {
    let conn = db.0.lock().map_err(|err| err.to_string())?;
    let mut stmt = conn
        .prepare(
            r#"
            SELECT
              g.id, g.bangumi_id, g.name, g.name_cn, g.image, g.date, gp.relation
            FROM game_persons gp
            INNER JOIN games g ON g.id = gp.game_id
            WHERE gp.person_id = ?1
            ORDER BY
              CASE WHEN g.date IS NULL OR TRIM(g.date) = '' THEN 1 ELSE 0 END ASC,
              g.date DESC,
              g.id DESC
            "#,
        )
        .map_err(|err| err.to_string())?;

    let rows = stmt
        .query_map(params![person_id], |row| {
            let relation_raw: String = row.get(6)?;
            Ok(PersonGameParticipation {
                id: row.get(0)?,
                bangumi_id: row.get(1)?,
                name: row.get(2)?,
                name_cn: row.get(3)?,
                image: row.get(4)?,
                date: row.get(5)?,
                relations: parse_person_relations(&relation_raw),
            })
        })
        .map_err(|err| err.to_string())?;

    let mut participations = Vec::new();
    for row in rows {
        participations.push(row.map_err(|err| err.to_string())?);
    }
    Ok(participations)
}

#[tauri::command]
pub fn upsert_library_person(
    db: State<'_, LibraryDb>,
    cache: State<'_, ImageCacheRoot>,
    person: SaveLibraryPersonDetailInput,
) -> Result<LibraryPerson, String> {
    let conn = db.0.lock().map_err(|err| err.to_string())?;
    let now = chrono_like_now();

    let career_json = person
        .career
        .as_ref()
        .map(serde_json::to_string)
        .transpose()
        .map_err(|err| err.to_string())?
        .unwrap_or_else(|| "[]".to_string());
    let images_json = person
        .images
        .as_ref()
        .map(serde_json::to_string)
        .transpose()
        .map_err(|err| err.to_string())?;
    let infobox_json = person
        .infobox
        .as_ref()
        .map(serde_json::to_string)
        .transpose()
        .map_err(|err| err.to_string())?;

    conn.execute(
        r#"
        INSERT INTO persons (
          id, name, type, career, images, summary, infobox,
          gender, blood_type, birth_year, birth_mon, birth_day,
          created_at, updated_at
        ) VALUES (
          ?1, ?2, ?3, ?4, ?5, ?6, ?7,
          ?8, ?9, ?10, ?11, ?12,
          ?13, ?14
        )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          type = excluded.type,
          career = excluded.career,
          images = excluded.images,
          summary = excluded.summary,
          infobox = excluded.infobox,
          gender = excluded.gender,
          blood_type = excluded.blood_type,
          birth_year = excluded.birth_year,
          birth_mon = excluded.birth_mon,
          birth_day = excluded.birth_day,
          updated_at = excluded.updated_at
        "#,
        params![
            person.id,
            person.name,
            person.person_type,
            career_json,
            images_json,
            person.summary,
            infobox_json,
            person.gender,
            person.blood_type,
            person.birth_year,
            person.birth_mon,
            person.birth_day,
            now,
            now,
        ],
    )
    .map_err(|err| err.to_string())?;

    drop(conn);
    image_cache::schedule_cache_images_value(
        cache.0.clone(),
        EntityImageKind::Person,
        person.id,
        &person.images,
        true,
    );
    get_library_person(db, person.id)
}

#[tauri::command]
pub fn list_library_persons(
    db: State<'_, LibraryDb>,
) -> Result<Vec<LibraryPerson>, String> {
    let conn = db.0.lock().map_err(|err| err.to_string())?;
    let mut stmt = conn
        .prepare(
            r#"
            SELECT
              id, name, type, career, images, summary, infobox,
              gender, blood_type, birth_year, birth_mon, birth_day,
              favorite, created_at, updated_at
            FROM persons
            ORDER BY name COLLATE NOCASE ASC, id ASC
            "#,
        )
        .map_err(|err| err.to_string())?;

    let rows = stmt
        .query_map([], map_library_person_row)
        .map_err(|err| err.to_string())?;

    let mut persons = Vec::new();
    for row in rows {
        persons.push(row.map_err(|err| err.to_string())?);
    }
    Ok(persons)
}

#[tauri::command]
pub fn list_library_game_persons(
    db: State<'_, LibraryDb>,
    game_id: i64,
) -> Result<Vec<LibraryGamePerson>, String> {
    let conn = db.0.lock().map_err(|err| err.to_string())?;
    let mut stmt = conn
        .prepare(
            r#"
            SELECT
              p.id, p.name, p.type, p.career, p.images, p.summary, p.infobox,
              p.gender, p.blood_type, p.birth_year, p.birth_mon, p.birth_day,
              p.favorite, gp.relation, gp.sort_order, p.created_at, p.updated_at
            FROM game_persons gp
            INNER JOIN persons p ON p.id = gp.person_id
            WHERE gp.game_id = ?1
            ORDER BY gp.sort_order ASC, p.created_at ASC
            "#,
        )
        .map_err(|err| err.to_string())?;

    let rows = stmt
        .query_map(params![game_id], map_library_game_person_row)
        .map_err(|err| err.to_string())?;

    let mut persons = Vec::new();
    for row in rows {
        persons.push(row.map_err(|err| err.to_string())?);
    }
    Ok(persons)
}

#[tauri::command]
pub fn save_library_persons(
    db: State<'_, LibraryDb>,
    cache: State<'_, ImageCacheRoot>,
    persons: Vec<SaveLibraryPersonInput>,
    character_links: Vec<CharacterPersonLinkInput>,
    game_links: Vec<GamePersonLinkInput>,
    replace_game_id: Option<i64>,
    replace_character_ids: Option<Vec<i64>>,
) -> Result<Vec<LibraryPerson>, String> {
    let mut conn = db.0.lock().map_err(|err| err.to_string())?;
    let now = chrono_like_now();
    let tx = conn.transaction().map_err(|err| err.to_string())?;

    if let Some(game_id) = replace_game_id {
        tx.execute(
            "DELETE FROM game_persons WHERE game_id = ?1",
            params![game_id],
        )
        .map_err(|err| err.to_string())?;
    }

    if let Some(character_ids) = replace_character_ids.as_ref() {
        for character_id in character_ids {
            tx.execute(
                "DELETE FROM character_persons WHERE character_id = ?1",
                params![character_id],
            )
            .map_err(|err| err.to_string())?;
        }
    }

    for person in &persons {
        let career_json = person
            .career
            .as_ref()
            .map(serde_json::to_string)
            .transpose()
            .map_err(|err| err.to_string())?
            .unwrap_or_else(|| "[]".to_string());
        let images_json = person
            .images
            .as_ref()
            .map(serde_json::to_string)
            .transpose()
            .map_err(|err| err.to_string())?;
        let infobox_json = person
            .infobox
            .as_ref()
            .map(serde_json::to_string)
            .transpose()
            .map_err(|err| err.to_string())?;

        tx.execute(
            r#"
            INSERT INTO persons (
              id, name, type, career, images, summary, infobox,
              gender, blood_type, birth_year, birth_mon, birth_day,
              created_at, updated_at
            ) VALUES (
              ?1, ?2, ?3, ?4, ?5, ?6, ?7,
              ?8, ?9, ?10, ?11, ?12,
              ?13, ?14
            )
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              type = excluded.type,
              career = excluded.career,
              images = excluded.images,
              summary = excluded.summary,
              infobox = excluded.infobox,
              gender = excluded.gender,
              blood_type = excluded.blood_type,
              birth_year = excluded.birth_year,
              birth_mon = excluded.birth_mon,
              birth_day = excluded.birth_day,
              updated_at = excluded.updated_at
            "#,
            params![
                person.id,
                person.name,
                person.person_type,
                career_json,
                images_json,
                person.summary,
                infobox_json,
                person.gender,
                person.blood_type,
                person.birth_year,
                person.birth_mon,
                person.birth_day,
                now,
                now,
            ],
        )
        .map_err(|err| err.to_string())?;
    }

    for link in &character_links {
        tx.execute(
            r#"
            INSERT INTO character_persons (
              character_id, person_id, created_at
            ) VALUES (?1, ?2, ?3)
            ON CONFLICT(character_id, person_id) DO NOTHING
            "#,
            params![link.character_id, link.person_id, now],
        )
        .map_err(|err| err.to_string())?;
    }

    for link in &game_links {
        let relation = link
            .relation
            .as_deref()
            .map(str::trim)
            .unwrap_or("");
        let sort_order = link.sort_order.unwrap_or(0);

        tx.execute(
            r#"
            INSERT INTO game_persons (
              game_id, person_id, relation, sort_order, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT(game_id, person_id) DO UPDATE SET
              relation = excluded.relation,
              sort_order = excluded.sort_order
            "#,
            params![link.game_id, link.person_id, relation, sort_order, now],
        )
        .map_err(|err| err.to_string())?;
    }

    tx.commit().map_err(|err| err.to_string())?;

    let mut stmt = conn
        .prepare(
            r#"
            SELECT
              id, name, type, career, images, summary, infobox,
              gender, blood_type, birth_year, birth_mon, birth_day,
              favorite, created_at, updated_at
            FROM persons
            ORDER BY name COLLATE NOCASE ASC, id ASC
            "#,
        )
        .map_err(|err| err.to_string())?;

    let rows = stmt
        .query_map([], map_library_person_row)
        .map_err(|err| err.to_string())?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|err| err.to_string())?);
    }
    drop(stmt);
    drop(conn);

    for person in &persons {
        image_cache::schedule_cache_images_value(
            cache.0.clone(),
            EntityImageKind::Person,
            person.id,
            &person.images,
            false,
        );
    }

    Ok(result)
}

#[tauri::command]
pub fn delete_library_person(
    db: State<'_, LibraryDb>,
    cache: State<'_, ImageCacheRoot>,
    id: i64,
) -> Result<(), String> {
    let mut conn = db.0.lock().map_err(|err| err.to_string())?;
    let tx = conn.transaction().map_err(|err| err.to_string())?;

    tx.execute(
        "DELETE FROM character_persons WHERE person_id = ?1",
        params![id],
    )
    .map_err(|err| err.to_string())?;
    tx.execute("DELETE FROM game_persons WHERE person_id = ?1", params![id])
        .map_err(|err| err.to_string())?;

    {
        let glob_a = format!(r#"*"id":{}[!0-9]*"#, id);
        let glob_b = format!(r#"*"id": {}[!0-9]*"#, id);
        let mut stmt = tx
            .prepare(
                r#"
                SELECT game_id, character_id, actors
                FROM game_characters
                WHERE actors GLOB ?1 OR actors GLOB ?2
                "#,
            )
            .map_err(|err| err.to_string())?;
        let rows = stmt
            .query_map(params![glob_a, glob_b], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })
            .map_err(|err| err.to_string())?;

        let mut updates = Vec::new();
        for row in rows {
            let (game_id, character_id, actors_raw) = row.map_err(|err| err.to_string())?;
            let Ok(actors) = serde_json::from_str::<Vec<serde_json::Value>>(&actors_raw) else {
                continue;
            };
            let next: Vec<serde_json::Value> = actors
                .into_iter()
                .filter(|actor| {
                    actor
                        .get("id")
                        .and_then(|value| value.as_i64())
                        .is_none_or(|actor_id| actor_id != id)
                })
                .collect();
            let next_raw = serde_json::to_string(&next).unwrap_or_else(|_| "[]".to_string());
            if next_raw != actors_raw {
                updates.push((game_id, character_id, next_raw));
            }
        }
        drop(stmt);

        for (game_id, character_id, actors_raw) in updates {
            tx.execute(
                r#"
                UPDATE game_characters
                SET actors = ?1
                WHERE game_id = ?2 AND character_id = ?3
                "#,
                params![actors_raw, game_id, character_id],
            )
            .map_err(|err| err.to_string())?;
        }
    }

    let removed = tx
        .execute("DELETE FROM persons WHERE id = ?1", params![id])
        .map_err(|err| err.to_string())?;
    if removed == 0 {
        return Err("人物不存在".to_string());
    }

    tx.commit().map_err(|err| err.to_string())?;
    image_cache::remove_cached(&cache.0, EntityImageKind::Person, id);
    Ok(())
}

fn merge_game_person_relations(existing: &str, incoming: &str) -> String {
    let mut relations: Vec<String> = Vec::new();
    let trimmed = existing.trim();
    if !trimmed.is_empty() {
        if let Ok(serde_json::Value::Array(items)) = serde_json::from_str::<serde_json::Value>(trimmed)
        {
            for item in items {
                let value = item
                    .as_str()
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(str::to_string);
                if let Some(value) = value {
                    if !relations.iter().any(|item| item == &value) {
                        relations.push(value);
                    }
                }
            }
        }
    }

    let incoming = incoming.trim();
    if !incoming.is_empty() && !relations.iter().any(|item| item == incoming) {
        relations.push(incoming.to_string());
    }

    serde_json::to_string(&relations).unwrap_or_else(|_| "[]".to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersonGameBangumiLinkInput {
    pub bangumi_id: i64,
    pub relation: Option<String>,
}

#[tauri::command]
pub fn link_person_relations_by_bangumi(
    db: State<'_, LibraryDb>,
    person_id: i64,
    game_links: Vec<PersonGameBangumiLinkInput>,
    character_ids: Vec<i64>,
) -> Result<(), String> {
    let mut conn = db.0.lock().map_err(|err| err.to_string())?;

    let exists: i64 = conn
        .query_row(
            "SELECT COUNT(1) FROM persons WHERE id = ?1",
            params![person_id],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())?;
    if exists == 0 {
        return Err("人物不存在".to_string());
    }

    let now = chrono_like_now();
    let tx = conn.transaction().map_err(|err| err.to_string())?;

    for link in &game_links {
        let game_id: Result<i64, rusqlite::Error> = tx.query_row(
            "SELECT id FROM games WHERE bangumi_id = ?1",
            params![link.bangumi_id],
            |row| row.get(0),
        );
        let Ok(game_id) = game_id else {
            continue;
        };

        let incoming = link
            .relation
            .as_deref()
            .map(str::trim)
            .unwrap_or("")
            .to_string();

        let existing: Option<String> = tx
            .query_row(
                "SELECT relation FROM game_persons WHERE game_id = ?1 AND person_id = ?2",
                params![game_id, person_id],
                |row| row.get(0),
            )
            .ok();

        let relation = merge_game_person_relations(existing.as_deref().unwrap_or(""), &incoming);

        tx.execute(
            r#"
            INSERT INTO game_persons (
              game_id, person_id, relation, sort_order, created_at
            ) VALUES (?1, ?2, ?3, 0, ?4)
            ON CONFLICT(game_id, person_id) DO UPDATE SET
              relation = excluded.relation
            "#,
            params![game_id, person_id, relation, now],
        )
        .map_err(|err| err.to_string())?;
    }

    for character_id in &character_ids {
        let character_exists: i64 = tx
            .query_row(
                "SELECT COUNT(1) FROM characters WHERE id = ?1",
                params![character_id],
                |row| row.get(0),
            )
            .map_err(|err| err.to_string())?;
        if character_exists == 0 {
            continue;
        }

        tx.execute(
            r#"
            INSERT INTO character_persons (
              character_id, person_id, created_at
            ) VALUES (?1, ?2, ?3)
            ON CONFLICT(character_id, person_id) DO NOTHING
            "#,
            params![character_id, person_id, now],
        )
        .map_err(|err| err.to_string())?;
    }

    tx.commit().map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_library_person_favorite(
    db: State<'_, LibraryDb>,
    id: i64,
    favorite: bool,
) -> Result<LibraryPerson, String> {
    let conn = db.0.lock().map_err(|err| err.to_string())?;
    let now = chrono_like_now();
    let value = if favorite { 1 } else { 0 };
    let updated = conn
        .execute(
            "UPDATE persons SET favorite = ?1, updated_at = ?2 WHERE id = ?3",
            params![value, now, id],
        )
        .map_err(|err| err.to_string())?;

    if updated == 0 {
        return Err("人物不存在".to_string());
    }

    drop(conn);
    get_library_person(db, id)
}
