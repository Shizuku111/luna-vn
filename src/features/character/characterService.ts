import {
  BANGUMI_SUBJECT_TYPE_GAME,
  getCharacterById,
  getCharacterSubjects,
} from "@/features/bangumi";
import {
  deleteLibraryCharacter,
  getLibraryCharacter,
  linkCharacterGamesByBangumi,
  updateLibraryCharacterFavorite,
  upsertLibraryCharacter,
} from "./characterStore";
import type { LibraryCharacter } from "./types";

export async function deleteCharacter(
  character: LibraryCharacter,
): Promise<void> {
  await deleteLibraryCharacter(character.id);
}

export async function markCharacterFavorite(
  character: LibraryCharacter,
  favorite: boolean,
): Promise<LibraryCharacter> {
  return updateLibraryCharacterFavorite(character.id, favorite);
}

export async function refreshCharacter(id: number): Promise<LibraryCharacter> {
  const [detail, subjects] = await Promise.all([
    getCharacterById(id),
    getCharacterSubjects(id),
  ]);

  await upsertLibraryCharacter({
    id: detail.id,
    name: detail.name,
    type: detail.type,
    summary: detail.summary ?? null,
    images: detail.images ?? null,
    infobox: detail.infobox ?? null,
    gender: detail.gender ?? null,
    bloodType: detail.blood_type ?? null,
    birthYear: detail.birth_year ?? null,
    birthMon: detail.birth_mon ?? null,
    birthDay: detail.birth_day ?? null,
    nsfw: detail.nsfw ?? false,
  });

  const gameLinks = subjects
    .filter((item) => item.type === BANGUMI_SUBJECT_TYPE_GAME && item.id > 0)
    .map((item) => ({
      bangumiId: item.id,
      relation: item.staff?.trim() || null,
    }));

  if (gameLinks.length > 0) {
    await linkCharacterGamesByBangumi(id, gameLinks);
  }

  return getLibraryCharacter(id);
}
