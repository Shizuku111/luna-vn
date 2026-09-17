import { memo, useMemo, useRef, useState, type MouseEvent } from "react";
import { DetailsIcon, HeartIcon, TrashIcon } from "@/components/icons";
import { ContextMenu } from "@/components/ContextMenu";
import {
  NAME_CN_KEYS,
  asInfobox,
  findInfoboxValue,
} from "@/features/bangumi";
import {
  useCachedEntityImage,
  type EntityImageKind,
} from "@/features/entityImage";
import "./EntityCard.css";

export type EntityCardImages = {
  large?: string;
  medium?: string;
  small?: string;
  grid?: string;
};

export type EntityCardData = {
  id: number;
  name: string;
  images?: EntityCardImages | null;
  infobox?: unknown;
  gender?: string | null;
  birthYear?: number | null;
  birthMon?: number | null;
  birthDay?: number | null;
  favorite?: boolean;
};

export type EntityOpenOrigin = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type EntityCardProps<T extends EntityCardData> = {
  entity: T;
  imageKind: EntityImageKind;
  deleteLabel: string;
  onOpen?: (entity: T, origin?: EntityOpenOrigin) => void;
  onDelete?: (entity: T) => void;
  onFavoriteChange?: (entity: T, favorite: boolean) => void;
};

const GENDER_KEYS = ["性别"] as const;
const BIRTHDAY_KEYS = ["生日", "出生日期"] as const;

function formatBirthFromFields(entity: EntityCardData): string {
  const year = entity.birthYear ?? null;
  const month = entity.birthMon ?? null;
  const day = entity.birthDay ?? null;
  if (year == null && month == null && day == null) return "";

  const parts: string[] = [];
  if (year != null) parts.push(`${year}年`);
  if (month != null) parts.push(`${month}月`);
  if (day != null) parts.push(`${day}日`);
  return parts.join("");
}

function resolveEntityDisplay(entity: EntityCardData) {
  const infobox = asInfobox(entity.infobox);
  const nameCn = findInfoboxValue(infobox, NAME_CN_KEYS);
  const gender =
    findInfoboxValue(infobox, GENDER_KEYS) || entity.gender?.trim() || "";
  const birthday =
    findInfoboxValue(infobox, BIRTHDAY_KEYS) || formatBirthFromFields(entity);

  return {
    nameCn: nameCn && nameCn !== entity.name ? nameCn : "",
    gender,
    birthday,
  };
}

function getOpenOrigin(card: HTMLElement | null): EntityOpenOrigin | undefined {
  if (!card) return undefined;
  const avatar = card.querySelector(".entity-card-avatar");
  const target = avatar instanceof HTMLElement ? avatar : card;
  const rect = target.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function EntityCardInner<T extends EntityCardData>({
  entity,
  imageKind,
  deleteLabel,
  onOpen,
  onDelete,
  onFavoriteChange,
}: EntityCardProps<T>) {
  const cardRef = useRef<HTMLLIElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const { nameCn, gender, birthday } = resolveEntityDisplay(entity);
  const favorited = Boolean(entity.favorite);
  const imageUrl = useCachedEntityImage({
    kind: imageKind,
    id: entity.id,
    images: entity.images,
  });
  const detailParts: string[] = [];
  if (gender) detailParts.push(gender);
  if (birthday) detailParts.push(birthday);
  const detailTitle = detailParts.join(" · ");

  const menuItems = useMemo(
    () => [
      {
        key: "details",
        label: "打开详情页",
        icon: <DetailsIcon aria-hidden />,
        onSelect: () => onOpen?.(entity, getOpenOrigin(cardRef.current)),
      },
      {
        key: "favorite",
        label: favorited ? "取消喜欢" : "设为喜欢",
        className: favorited ? "entity-favorite-active" : undefined,
        icon: (
          <HeartIcon
            aria-hidden
            className={
              favorited
                ? "library-favorite-icon is-favorite"
                : "library-favorite-icon"
            }
          />
        ),
        onSelect: () => onFavoriteChange?.(entity, !favorited),
      },
      {
        key: "delete",
        label: deleteLabel,
        icon: <TrashIcon aria-hidden />,
        danger: true,
        onSelect: () => onDelete?.(entity),
      },
    ],
    [entity, deleteLabel, favorited, onOpen, onDelete, onFavoriteChange],
  );

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY });
  }

  function handleCloseMenu() {
    setMenu(null);
  }

  function handleClick() {
    onOpen?.(entity, getOpenOrigin(cardRef.current));
  }

  return (
    <>
      <li
        ref={cardRef}
        className="entity-card"
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <div className="entity-card-avatar">
          {imageUrl ? (
            <img src={imageUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="entity-card-avatar-empty" aria-hidden />
          )}
          {favorited ? (
            <span className="entity-card-favorite-badge" aria-label="喜欢">
              <HeartIcon
                aria-hidden
                className="library-favorite-icon is-favorite"
              />
            </span>
          ) : null}
        </div>

        <div className="entity-card-meta">
          <p className="entity-card-name" title={entity.name}>
            {entity.name}
          </p>
          {nameCn ? (
            <p className="entity-card-name-cn" title={nameCn}>
              {nameCn}
            </p>
          ) : null}

          {detailParts.length > 0 ? (
            <p className="entity-card-details" title={detailTitle}>
              {detailParts.map((part, index) => (
                <span key={part}>
                  {index > 0 ? (
                    <span className="entity-card-details-sep" aria-hidden>
                      ·
                    </span>
                  ) : null}
                  {part}
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </li>

      <ContextMenu
        open={menu != null}
        x={menu?.x ?? 0}
        y={menu?.y ?? 0}
        items={menuItems}
        onClose={handleCloseMenu}
      />
    </>
  );
}

export const EntityCard = memo(EntityCardInner) as typeof EntityCardInner;
