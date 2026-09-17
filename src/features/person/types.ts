export type LibraryPersonImages = {
  large?: string;
  medium?: string;
  small?: string;
  grid?: string;
};

export type LibraryPerson = {
  id: number;
  name: string;
  type: number;
  career: string[];
  summary?: string | null;
  images?: LibraryPersonImages | null;
  infobox?: unknown;
  gender?: string | null;
  bloodType?: number | null;
  birthYear?: number | null;
  birthMon?: number | null;
  birthDay?: number | null;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LibraryGamePerson = LibraryPerson & {
  relation: string;
  sortOrder: number;
};

export type PersonCharacterGame = {
  id: number;
  bangumiId: number;
  name: string;
  nameCn: string;
  image?: string | null;
  relation: string;
  date?: string | null;
};

export type PersonCharacterAppearance = {
  id: number;
  name: string;
  nameCn?: string | null;
  images?: LibraryPersonImages | null;
  relation: string;
  games: PersonCharacterGame[];
};

export type PersonGameParticipation = {
  id: number;
  bangumiId: number;
  name: string;
  nameCn: string;
  image?: string | null;
  date?: string | null;
  relations: string[];
};

export type SaveLibraryPersonInput = {
  id: number;
  name: string;
  type: number;
  career?: string[] | null;
  summary?: string | null;
  images?: LibraryPersonImages | null;
  infobox?: unknown;
  gender?: string | null;
  bloodType?: number | null;
  birthYear?: number | null;
  birthMon?: number | null;
  birthDay?: number | null;
};

export type SaveLibraryPersonDetailInput = SaveLibraryPersonInput;

export type CharacterPersonLinkInput = {
  characterId: number;
  personId: number;
};

export type GamePersonLinkInput = {
  gameId: number;
  personId: number;
  relation?: string | null;
  sortOrder?: number | null;
};
