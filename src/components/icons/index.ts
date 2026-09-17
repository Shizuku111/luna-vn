import type { ComponentType, SVGProps } from "react";
import ActivitySvg from "@/assets/svg/activity.svg?react";
import CheckSvg from "@/assets/svg/check.svg?react";
import ChevronDownSvg from "@/assets/svg/chevron-down.svg?react";
import ChevronRightSvg from "@/assets/svg/chevron-right.svg?react";
import CloseSvg from "@/assets/svg/close.svg?react";
import DetailsSvg from "@/assets/svg/details.svg?react";
import EditSvg from "@/assets/svg/edit.svg?react";
import FolderSvg from "@/assets/svg/folder.svg?react";
import FilterSortSvg from "@/assets/svg/filter-sort.svg?react";
import HeartSvg from "@/assets/svg/heart.svg?react";
import HeartBrokenSvg from "@/assets/svg/heart-broken.svg?react";
import HistorySvg from "@/assets/svg/history.svg?react";
import BookmarkSvg from "@/assets/svg/bookmark.svg?react";
import HourglassSvg from "@/assets/svg/hourglass.svg?react";
import InfoSvg from "@/assets/svg/info.svg?react";
import LoadingSvg from "@/assets/svg/loading.svg?react";
import MatchSvg from "@/assets/svg/match.svg?react";
import MoreVerticalSvg from "@/assets/svg/more-vertical.svg?react";
import PlaySvg from "@/assets/svg/play.svg?react";
import PlusSvg from "@/assets/svg/plus.svg?react";
import SearchSvg from "@/assets/svg/search.svg?react";
import SelectAppSvg from "@/assets/svg/select-app.svg?react";
import SettingsSvg from "@/assets/svg/settings.svg?react";
import SortAscSvg from "@/assets/svg/sort-asc.svg?react";
import SortDescSvg from "@/assets/svg/sort-desc.svg?react";
import CirclePauseSvg from "@/assets/svg/circle-pause.svg?react";
import CircleSlashSvg from "@/assets/svg/circle-slash.svg?react";
import CalendarSvg from "@/assets/svg/calendar.svg?react";
import TagSvg from "@/assets/svg/tag.svg?react";
import TaskCheckedSvg from "@/assets/svg/task-checked.svg?react";
import TrashSvg from "@/assets/svg/trash.svg?react";
import WindowCloseSvg from "@/assets/svg/window-close.svg?react";
import WindowMaximizeSvg from "@/assets/svg/window-maximize.svg?react";
import WindowMinimizeSvg from "@/assets/svg/window-minimize.svg?react";
import { createIcon } from "./createIcon";

export type { IconProps, IconSize } from "./createIcon";
export { createIcon } from "./createIcon";

type SvgComponent = ComponentType<SVGProps<SVGSVGElement>>;

export const ActivityIcon = createIcon(
  ActivitySvg as SvgComponent,
  "ActivityIcon",
);
export const CheckIcon = createIcon(CheckSvg as SvgComponent, "CheckIcon");
export const ChevronDownIcon = createIcon(
  ChevronDownSvg as SvgComponent,
  "ChevronDownIcon",
);
export const ChevronRightIcon = createIcon(
  ChevronRightSvg as SvgComponent,
  "ChevronRightIcon",
);
export const CloseIcon = createIcon(CloseSvg as SvgComponent, "CloseIcon");
export const DetailsIcon = createIcon(
  DetailsSvg as SvgComponent,
  "DetailsIcon",
);
export const EditIcon = createIcon(EditSvg as SvgComponent, "EditIcon");
export const FolderIcon = createIcon(FolderSvg as SvgComponent, "FolderIcon");
export const FilterSortIcon = createIcon(
  FilterSortSvg as SvgComponent,
  "FilterSortIcon",
);
export const HeartIcon = createIcon(HeartSvg as SvgComponent, "HeartIcon");
export const HeartBrokenIcon = createIcon(
  HeartBrokenSvg as SvgComponent,
  "HeartBrokenIcon",
);
export const HistoryIcon = createIcon(
  HistorySvg as SvgComponent,
  "HistoryIcon",
);
export const BookmarkIcon = createIcon(
  BookmarkSvg as SvgComponent,
  "BookmarkIcon",
);
export const HourglassIcon = createIcon(
  HourglassSvg as SvgComponent,
  "HourglassIcon",
);
export const InfoIcon = createIcon(InfoSvg as SvgComponent, "InfoIcon");
export const PlayIcon = createIcon(PlaySvg as SvgComponent, "PlayIcon");
export const PlusIcon = createIcon(PlusSvg as SvgComponent, "PlusIcon");
export const LoadingIcon = createIcon(
  LoadingSvg as SvgComponent,
  "LoadingIcon",
);
export const MatchIcon = createIcon(MatchSvg as SvgComponent, "MatchIcon");
export const MoreVerticalIcon = createIcon(
  MoreVerticalSvg as SvgComponent,
  "MoreVerticalIcon",
);
export const SearchIcon = createIcon(SearchSvg as SvgComponent, "SearchIcon");
export const SelectAppIcon = createIcon(
  SelectAppSvg as SvgComponent,
  "SelectAppIcon",
);
export const SettingsIcon = createIcon(
  SettingsSvg as SvgComponent,
  "SettingsIcon",
);
export const SortAscIcon = createIcon(SortAscSvg as SvgComponent, "SortAscIcon");
export const SortDescIcon = createIcon(
  SortDescSvg as SvgComponent,
  "SortDescIcon",
);
export const CirclePauseIcon = createIcon(
  CirclePauseSvg as SvgComponent,
  "CirclePauseIcon",
);
export const CircleSlashIcon = createIcon(
  CircleSlashSvg as SvgComponent,
  "CircleSlashIcon",
);
export const CalendarIcon = createIcon(
  CalendarSvg as SvgComponent,
  "CalendarIcon",
);
export const TagIcon = createIcon(TagSvg as SvgComponent, "TagIcon");
export const TaskCheckedIcon = createIcon(
  TaskCheckedSvg as SvgComponent,
  "TaskCheckedIcon",
);
export const TrashIcon = createIcon(TrashSvg as SvgComponent, "TrashIcon");
export const WindowCloseIcon = createIcon(
  WindowCloseSvg as SvgComponent,
  "WindowCloseIcon",
);
export const WindowMaximizeIcon = createIcon(
  WindowMaximizeSvg as SvgComponent,
  "WindowMaximizeIcon",
);
export const WindowMinimizeIcon = createIcon(
  WindowMinimizeSvg as SvgComponent,
  "WindowMinimizeIcon",
);
