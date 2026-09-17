import { memo } from "react";
import { EntityCard, type EntityOpenOrigin } from "@/components/EntityCard";
import type { LibraryCharacter } from "@/features/character";

type CharacterCardProps = {
  character: LibraryCharacter;
  onOpen?: (character: LibraryCharacter, origin?: EntityOpenOrigin) => void;
  onDelete?: (character: LibraryCharacter) => void;
  onFavoriteChange?: (character: LibraryCharacter, favorite: boolean) => void;
};

export const CharacterCard = memo(function CharacterCard({
  character,
  onOpen,
  onDelete,
  onFavoriteChange,
}: CharacterCardProps) {
  return (
    <EntityCard
      entity={character}
      imageKind="character"
      deleteLabel="删除角色"
      onOpen={onOpen}
      onDelete={onDelete}
      onFavoriteChange={onFavoriteChange}
    />
  );
});
