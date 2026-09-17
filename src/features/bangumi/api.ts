import { api } from "@/utils/request";
import { BANGUMI_OAUTH_BASE } from "./constants";
import {
  BangumiApiError,
  type BangumiSearchSubject,
  type BangumiSearchSubjectsFilter,
  type BangumiSearchSubjectsResult,
  type BangumiSearchSubjectsSort,
  type BangumiRelatedCharacter,
  type BangumiRelatedPerson,
  type BangumiRelatedSubject,
  type BangumiSubjectRelation,
  type BangumiPersonCharacter,
  type BangumiCharacter,
  type BangumiPerson,
  type BangumiSubject,
  type BangumiTokenStatus,
  type BangumiUser,
} from "./types";

export async function getMe(): Promise<BangumiUser> {
  return api.get<BangumiUser>({
    url: "/v0/me",
    errorMessage: "获取用户信息失败",
  });
}

export async function getTokenStatus(): Promise<BangumiTokenStatus> {
  const data = await api.post<
    BangumiTokenStatus & {
      error?: string;
      error_description?: string;
    }
  >({
    url: `${BANGUMI_OAUTH_BASE}/oauth/token_status`,
    withToken: false,
    authQuery: true,
    errorMessage: "获取令牌状态失败",
  });

  if (!data.expires) {
    throw new BangumiApiError(
      data.error_description || data.error || "令牌无效或已过期",
      401,
    );
  }

  return data;
}

export type SearchSubjectsOptions = {
  keyword: string;
  sort?: BangumiSearchSubjectsSort;
  filter?: BangumiSearchSubjectsFilter;
  limit?: number;
  offset?: number;
};

function toSearchSubject(subject: BangumiSubject): BangumiSearchSubject {
  return {
    id: subject.id,
    type: subject.type,
    name: subject.name,
    name_cn: subject.name_cn,
    summary: subject.summary,
    date: subject.date ?? subject.air_date,
    image:
      subject.image ||
      subject.images?.large ||
      subject.images?.common ||
      subject.images?.medium,
    images: subject.images
      ? {
          large: subject.images.large ?? "",
          medium: subject.images.medium ?? "",
          small: subject.images.small ?? "",
        }
      : undefined,
    score: subject.score,
    rank: subject.rank,
    tags: subject.tags,
    nsfw: subject.nsfw,
    infobox: subject.infobox,
  };
}

export async function getSubjectById(id: number): Promise<BangumiSearchSubject> {
  const subject = await api.get<BangumiSubject>({
    url: `/v0/subjects/${id}`,
    errorMessage: "获取条目失败",
  });
  return toSearchSubject(subject);
}

export async function getSubjectCharacters(
  subjectId: number,
): Promise<BangumiRelatedCharacter[]> {
  return api.get<BangumiRelatedCharacter[]>({
    url: `/v0/subjects/${subjectId}/characters`,
    errorMessage: "获取角色信息失败",
  });
}

export async function getSubjectPersons(
  subjectId: number,
): Promise<BangumiRelatedPerson[]> {
  return api.get<BangumiRelatedPerson[]>({
    url: `/v0/subjects/${subjectId}/persons`,
    errorMessage: "获取人物信息失败",
  });
}

export async function getSubjectSubjects(
  subjectId: number,
): Promise<BangumiSubjectRelation[]> {
  return api.get<BangumiSubjectRelation[]>({
    url: `/v0/subjects/${subjectId}/subjects`,
    errorMessage: "获取关联条目失败",
  });
}

export async function getCharacterSubjects(
  characterId: number,
): Promise<BangumiRelatedSubject[]> {
  return api.get<BangumiRelatedSubject[]>({
    url: `/v0/characters/${characterId}/subjects`,
    errorMessage: "获取角色关联条目失败",
  });
}

export async function getPersonSubjects(
  personId: number,
): Promise<BangumiRelatedSubject[]> {
  return api.get<BangumiRelatedSubject[]>({
    url: `/v0/persons/${personId}/subjects`,
    errorMessage: "获取人物关联条目失败",
  });
}

export async function getPersonCharacters(
  personId: number,
): Promise<BangumiPersonCharacter[]> {
  return api.get<BangumiPersonCharacter[]>({
    url: `/v0/persons/${personId}/characters`,
    errorMessage: "获取人物关联角色失败",
  });
}

export async function getCharacterById(
  characterId: number,
): Promise<BangumiCharacter> {
  const data = await api.get<BangumiCharacter & { locked?: unknown; stat?: unknown }>({
    url: `/v0/characters/${characterId}`,
    errorMessage: "获取角色详情失败",
  });

  return {
    id: data.id,
    name: data.name,
    type: data.type,
    images: data.images ?? null,
    summary: data.summary ?? "",
    infobox: data.infobox ?? null,
    gender: data.gender ?? null,
    blood_type: data.blood_type ?? null,
    birth_year: data.birth_year ?? null,
    birth_mon: data.birth_mon ?? null,
    birth_day: data.birth_day ?? null,
    nsfw: data.nsfw ?? false,
  };
}

export async function getPersonById(
  personId: number,
): Promise<BangumiPerson> {
  const data = await api.get<
    BangumiPerson & {
      locked?: unknown;
      last_modified?: unknown;
      stat?: unknown;
    }
  >({
    url: `/v0/persons/${personId}`,
    errorMessage: "获取人物详情失败",
  });

  return {
    id: data.id,
    name: data.name,
    type: data.type,
    career: Array.isArray(data.career) ? data.career : [],
    images: data.images ?? null,
    summary: data.summary ?? "",
    infobox: data.infobox ?? null,
    gender: data.gender ?? null,
    blood_type: data.blood_type ?? null,
    birth_year: data.birth_year ?? null,
    birth_mon: data.birth_mon ?? null,
    birth_day: data.birth_day ?? null,
  };
}

export async function searchSubjects({
  keyword,
  sort = "match",
  filter,
  limit = 10,
  offset = 0,
}: SearchSubjectsOptions): Promise<BangumiSearchSubjectsResult> {
  return api.post<BangumiSearchSubjectsResult>({
    url: "/v0/search/subjects",
    params: { limit, offset },
    data: {
      keyword,
      sort,
      filter: filter ?? {},
    },
    errorMessage: "搜索条目失败",
  });
}
