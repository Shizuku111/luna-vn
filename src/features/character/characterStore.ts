import { invoke } from "@tauri-apps/api/core";
import { getShowNsfw } from "@/features/settings";
import type {
  CharacterGameAppearance,
  LibraryCharacter,
  SaveLibraryCharacterDetailInput,
  SaveLibraryCharacterInput,
} from "./types";

export async function deleteLibraryCharacter(id: number): Promise<void> {
  await invoke("delete_library_character", { id });
}

export async function getLibraryCharacter(id: number): Promise<LibraryCharacter> {
  return invoke<LibraryCharacter>("get_library_character", { id });
}

export async function listCharacterGames(
  characterId: number,
): Promise<CharacterGameAppearance[]> {
  return invoke<CharacterGameAppearance[]>("list_character_games", {
    characterId,
  });
}

export async function listLibraryGameCharacters(
  gameId: number,
): Promise<LibraryCharacter[]> {
  return invoke<LibraryCharacter[]>("list_library_game_characters", { gameId });
}

export async function listLibraryCharacters(): Promise<LibraryCharacter[]> {
  const [characters, showNsfw] = await Promise.all([
    invoke<LibraryCharacter[]>("list_library_characters"),
    getShowNsfw(),
  ]);
  if (showNsfw) return characters;
  return characters.filter((character) => !character.nsfw);
}

export async function saveLibraryGameCharacters(
  gameId: number,
  characters: SaveLibraryCharacterInput[],
  replace = false,
): Promise<LibraryCharacter[]> {
  return invoke<LibraryCharacter[]>("save_library_game_characters", {
    gameId,
    characters,
    replace,
  });
}

export async function upsertLibraryCharacter(
  character: SaveLibraryCharacterDetailInput,
): Promise<LibraryCharacter> {
  return invoke<LibraryCharacter>("upsert_library_character", { character });
}

export type CharacterGameBangumiLinkInput = {
  bangumiId: number;
  relation?: string | null;
};

export async function linkCharacterGamesByBangumi(
  characterId: number,
  links: CharacterGameBangumiLinkInput[],
): Promise<number> {
  return invoke<number>("link_character_games_by_bangumi", {
    characterId,
    links,
  });
}

export async function updateLibraryCharacterFavorite(
  id: number,
  favorite: boolean,
): Promise<LibraryCharacter> {
  return invoke<LibraryCharacter>("update_library_character_favorite", {
    id,
    favorite,
  });
}
