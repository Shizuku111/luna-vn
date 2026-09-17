export type LibraryCharacterImages = {
  large?: string;
  medium?: string;
  small?: string;
  grid?: string;
};

export type LibraryCharacterActor = {
  id: number;
  name: string;
  nameCn?: string | null;
  type?: number;
  images?: LibraryCharacterImages | null;
  relation?: string | null;
};

export type LibraryCharacter = {
  id: number;
  name: string;
  type: number;
  summary?: string | null;
  images?: LibraryCharacterImages | null;
  infobox?: unknown;
  gender?: string | null;
  bloodType?: number | null;
  birthYear?: number | null;
  birthMon?: number | null;
  birthDay?: number | null;
  nsfw: boolean;
  favorite: boolean;
  relation: string;
  actors: LibraryCharacterActor[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type SaveLibraryCharacterInput = {
  id: number;
  name: string;
  type: number;
  summary?: string | null;
  images?: LibraryCharacterImages | null;
  infobox?: unknown;
  gender?: string | null;
  bloodType?: number | null;
  birthYear?: number | null;
  birthMon?: number | null;
  birthDay?: number | null;
  nsfw?: boolean | null;
  relation: string;
  actors?: LibraryCharacterActor[] | null;
  sortOrder: number;
};

export type SaveLibraryCharacterDetailInput = {
  id: number;
  name: string;
  type: number;
  summary?: string | null;
  images?: LibraryCharacterImages | null;
  infobox?: unknown;
  gender?: string | null;
  bloodType?: number | null;
  birthYear?: number | null;
  birthMon?: number | null;
  birthDay?: number | null;
  nsfw?: boolean | null;
};

export type CharacterGameAppearance = {
  id: number;
  bangumiId: number;
  name: string;
  nameCn: string;
  image?: string | null;
  relation: string;
  actors: LibraryCharacterActor[];
  createdAt: string;
};
