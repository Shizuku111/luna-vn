import {
  getCharacterById,
  getPersonById,
  getSubjectCharacters,
  getSubjectPersons,
} from "@/features/bangumi";
import { getBangumiMaxConcurrent } from "@/features/bangumi/bangumiConcurrency";
import {
  saveLibraryPersons,
  type CharacterPersonLinkInput,
  type GamePersonLinkInput,
  type SaveLibraryPersonInput,
} from "@/features/person";
import { mapPool } from "@/utils/mapPool";
import {
  listLibraryGameCharacters,
  saveLibraryGameCharacters,
} from "./characterStore";
import type { LibraryCharacter, SaveLibraryCharacterInput } from "./types";
import { characterRelationRank } from "./characterRelationSort";
import { personRelationRank } from "@/features/person/personRelationSort";

async function fetchPersonInputs(
  personIds: number[],
): Promise<SaveLibraryPersonInput[]> {
  return mapPool(personIds, getBangumiMaxConcurrent(), async (personId) => {
    const detail = await getPersonById(personId);
    return {
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
    };
  });
}

export async function syncLibraryGameCharacters(
  gameId: number,
  bangumiId: number,
): Promise<LibraryCharacter[]> {
  const [relatedCharacters, relatedPersons] = await Promise.all([
    getSubjectCharacters(bangumiId),
    getSubjectPersons(bangumiId),
  ]);

  const orderedCharacters: typeof relatedCharacters = [];
  const groups = new Map<number, typeof relatedCharacters>();
  for (const item of relatedCharacters) {
    const rank = characterRelationRank(item.relation);
    const group = groups.get(rank) ?? [];
    group.push(item);
    groups.set(rank, group);
  }
  for (const rank of [...groups.keys()].sort((a, b) => a - b)) {
    orderedCharacters.push(...(groups.get(rank) ?? []));
  }

  const characterInputs: SaveLibraryCharacterInput[] = await mapPool(
    orderedCharacters,
    getBangumiMaxConcurrent(),
    async (item, index) => {
      const detail = await getCharacterById(item.id);
      return {
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
        relation: item.relation ?? "",
        actors: item.actors ?? [],
        sortOrder: index,
      };
    },
  );

  const saved = await saveLibraryGameCharacters(
    gameId,
    characterInputs,
    true,
  );

  const personIdSet = new Set<number>();
  const characterLinks: CharacterPersonLinkInput[] = [];
  const gameLinks: GamePersonLinkInput[] = [];
  const replaceCharacterIds = orderedCharacters.map((item) => item.id);

  for (const item of relatedCharacters) {
    for (const actor of item.actors ?? []) {
      if (!actor?.id) continue;
      personIdSet.add(actor.id);
      characterLinks.push({
        characterId: item.id,
        personId: actor.id,
      });
    }
  }

  const orderedPersons: typeof relatedPersons = [];
  const personGroups = new Map<string, typeof relatedPersons>();
  for (const item of relatedPersons) {
    if (!item?.id) continue;
    const relation = item.relation?.trim() ?? "";
    const group = personGroups.get(relation) ?? [];
    group.push(item);
    personGroups.set(relation, group);
  }
  const personRelationKeys = [...personGroups.keys()].sort((a, b) => {
    const rank = personRelationRank(a) - personRelationRank(b);
    if (rank !== 0) return rank;
    return a.localeCompare(b, "zh");
  });
  for (const key of personRelationKeys) {
    orderedPersons.push(...(personGroups.get(key) ?? []));
  }

  orderedPersons.forEach((person, index) => {
    if (!person?.id) return;
    personIdSet.add(person.id);
    const relation = person.relation?.trim() ?? "";
    const existing = gameLinks.find((link) => link.personId === person.id);
    if (existing) {
      const current = existing.relation?.trim() ?? "";
      let relations: string[] = [];
      try {
        const parsed = JSON.parse(current) as unknown;
        if (Array.isArray(parsed)) {
          relations = parsed
            .map((item) => String(item ?? "").trim())
            .filter(Boolean);
        }
      } catch {
        // keep empty relations when stored JSON is invalid
      }
      if (relation && !relations.includes(relation)) {
        relations.push(relation);
      }
      existing.relation = JSON.stringify(relations);
      if (index < (existing.sortOrder ?? Number.POSITIVE_INFINITY)) {
        existing.sortOrder = index;
      }
      return;
    }
    gameLinks.push({
      gameId,
      personId: person.id,
      relation: relation ? JSON.stringify([relation]) : "[]",
      sortOrder: index,
    });
  });

  const persons = await fetchPersonInputs([...personIdSet]);
  await saveLibraryPersons(persons, characterLinks, gameLinks, {
    replaceGameId: gameId,
    replaceCharacterIds,
  });

  return saved;
}

export async function ensureLibraryGameCharacters(
  gameId: number,
  bangumiId: number,
): Promise<LibraryCharacter[]> {
  const existing = await listLibraryGameCharacters(gameId);
  if (existing.length > 0) {
    return existing;
  }
  return syncLibraryGameCharacters(gameId, bangumiId);
}
