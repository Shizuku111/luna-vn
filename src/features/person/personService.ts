import {
  BANGUMI_SUBJECT_TYPE_GAME,
  getPersonById,
  getPersonCharacters,
  getPersonSubjects,
} from "@/features/bangumi";
import {
  deleteLibraryPerson,
  getLibraryPerson,
  linkPersonRelationsByBangumi,
  updateLibraryPersonFavorite,
  upsertLibraryPerson,
} from "./personStore";
import type { LibraryPerson } from "./types";

export async function deletePerson(person: LibraryPerson): Promise<void> {
  await deleteLibraryPerson(person.id);
}

export async function markPersonFavorite(
  person: LibraryPerson,
  favorite: boolean,
): Promise<LibraryPerson> {
  return updateLibraryPersonFavorite(person.id, favorite);
}

export async function refreshPerson(id: number): Promise<LibraryPerson> {
  const [detail, subjects, relatedCharacters] = await Promise.all([
    getPersonById(id),
    getPersonSubjects(id),
    getPersonCharacters(id),
  ]);

  await upsertLibraryPerson({
    id: detail.id,
    name: detail.name,
    type: detail.type,
    career: detail.career ?? [],
    summary: detail.summary ?? null,
    images: detail.images ?? null,
    infobox: detail.infobox ?? null,
    gender: detail.gender ?? null,
    bloodType: detail.blood_type ?? null,
    birthYear: detail.birth_year ?? null,
    birthMon: detail.birth_mon ?? null,
    birthDay: detail.birth_day ?? null,
  });

  const gameLinkMap = new Map<number, string[]>();
  for (const item of subjects) {
    if (item.type !== BANGUMI_SUBJECT_TYPE_GAME || item.id <= 0) continue;
    const staff = item.staff?.trim() ?? "";
    const current = gameLinkMap.get(item.id) ?? [];
    if (staff && !current.includes(staff)) {
      current.push(staff);
    }
    gameLinkMap.set(item.id, current);
  }

  const gameLinks = [...gameLinkMap.entries()].flatMap(([bangumiId, relations]) => {
    if (relations.length === 0) {
      return [{ bangumiId, relation: null as string | null }];
    }
    return relations.map((relation) => ({ bangumiId, relation }));
  });

  const characterIds = [
    ...new Set(
      relatedCharacters
        .map((item) => item.id)
        .filter((characterId) => characterId > 0),
    ),
  ];

  if (gameLinks.length > 0 || characterIds.length > 0) {
    await linkPersonRelationsByBangumi(id, gameLinks, characterIds);
  }

  return getLibraryPerson(id);
}
