import { invoke } from "@tauri-apps/api/core";
import type {
  CharacterPersonLinkInput,
  GamePersonLinkInput,
  LibraryGamePerson,
  LibraryPerson,
  PersonCharacterAppearance,
  PersonGameParticipation,
  SaveLibraryPersonDetailInput,
  SaveLibraryPersonInput,
} from "./types";

export type SaveLibraryPersonsOptions = {
  replaceGameId?: number | null;
  replaceCharacterIds?: number[] | null;
};

export async function listLibraryPersons(): Promise<LibraryPerson[]> {
  return invoke<LibraryPerson[]>("list_library_persons");
}

export async function getLibraryPerson(id: number): Promise<LibraryPerson> {
  return invoke<LibraryPerson>("get_library_person", { id });
}

export async function listPersonCharacters(
  personId: number,
): Promise<PersonCharacterAppearance[]> {
  return invoke<PersonCharacterAppearance[]>("list_person_characters", {
    personId,
  });
}

export async function listPersonParticipations(
  personId: number,
): Promise<PersonGameParticipation[]> {
  return invoke<PersonGameParticipation[]>("list_person_participations", {
    personId,
  });
}

export async function listLibraryGamePersons(
  gameId: number,
): Promise<LibraryGamePerson[]> {
  return invoke<LibraryGamePerson[]>("list_library_game_persons", { gameId });
}

export async function saveLibraryPersons(
  persons: SaveLibraryPersonInput[],
  characterLinks: CharacterPersonLinkInput[] = [],
  gameLinks: GamePersonLinkInput[] = [],
  options: SaveLibraryPersonsOptions = {},
): Promise<LibraryPerson[]> {
  return invoke<LibraryPerson[]>("save_library_persons", {
    persons,
    characterLinks,
    gameLinks,
    replaceGameId: options.replaceGameId ?? null,
    replaceCharacterIds: options.replaceCharacterIds ?? null,
  });
}

export async function upsertLibraryPerson(
  person: SaveLibraryPersonDetailInput,
): Promise<LibraryPerson> {
  return invoke<LibraryPerson>("upsert_library_person", { person });
}

export type PersonGameBangumiLinkInput = {
  bangumiId: number;
  relation?: string | null;
};

export async function linkPersonRelationsByBangumi(
  personId: number,
  gameLinks: PersonGameBangumiLinkInput[] = [],
  characterIds: number[] = [],
): Promise<void> {
  await invoke("link_person_relations_by_bangumi", {
    personId,
    gameLinks,
    characterIds,
  });
}

export async function deleteLibraryPerson(id: number): Promise<void> {
  await invoke("delete_library_person", { id });
}

export async function updateLibraryPersonFavorite(
  id: number,
  favorite: boolean,
): Promise<LibraryPerson> {
  return invoke<LibraryPerson>("update_library_person_favorite", {
    id,
    favorite,
  });
}
