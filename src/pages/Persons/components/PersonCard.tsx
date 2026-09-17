import { memo } from "react";
import { EntityCard, type EntityOpenOrigin } from "@/components/EntityCard";
import type { LibraryPerson } from "@/features/person";

type PersonCardProps = {
  person: LibraryPerson;
  onOpen?: (person: LibraryPerson, origin?: EntityOpenOrigin) => void;
  onDelete?: (person: LibraryPerson) => void;
  onFavoriteChange?: (person: LibraryPerson, favorite: boolean) => void;
};

export const PersonCard = memo(function PersonCard({
  person,
  onOpen,
  onDelete,
  onFavoriteChange,
}: PersonCardProps) {
  return (
    <EntityCard
      entity={person}
      imageKind="person"
      deleteLabel="删除人物"
      onOpen={onOpen}
      onDelete={onDelete}
      onFavoriteChange={onFavoriteChange}
    />
  );
});
