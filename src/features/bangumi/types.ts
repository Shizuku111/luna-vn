export type BangumiAvatar = {
  large: string;
  medium: string;
  small: string;
};

export type BangumiUser = {
  id: number;
  username: string;
  nickname: string;
  user_group: number;
  avatar: BangumiAvatar;
  sign: string;
  email?: string;
  reg_time?: string;
  time_offset?: number;
};

export type BangumiTokenStatus = {
  access_token: string;
  client_id?: string;
  expires: number;
  scope?: string | null;
  user_id?: number;
};

export type BangumiSearchSubjectsSort = "match" | "heat" | "rank" | "score";

export type BangumiSearchSubjectsFilter = {
  nsfw?: boolean;
  type?: (1 | 2 | 3 | 4 | 6)[];
};

export type BangumiSearchSubjectTag = {
  name: string;
  count: number;
};

export type BangumiInfoboxValueEntry =
  | string
  | {
      k?: string;
      v: string;
    };

export type BangumiInfoboxItem = {
  key: string;
  value: string | BangumiInfoboxValueEntry[];
};

export type BangumiSubjectImages = {
  large?: string;
  common?: string;
  medium?: string;
  small?: string;
  grid?: string;
};

export type BangumiPersonImages = {
  large?: string;
  medium?: string;
  small?: string;
  grid?: string;
};

export type BangumiRelatedActor = {
  id: number;
  name: string;
  type?: number;
  images?: BangumiPersonImages | null;
};

export type BangumiRelatedCharacter = {
  id: number;
  name: string;
  summary?: string;
  type: number;
  images?: BangumiPersonImages | null;
  relation: string;
  actors?: BangumiRelatedActor[];
};

export type BangumiRelatedPerson = {
  id: number;
  name: string;
  type: number;
  career?: string[] | null;
  images?: BangumiPersonImages | null;
  relation?: string;
  eps?: string;
};

export type BangumiSubjectRelation = {
  id: number;
  type: number;
  name: string;
  name_cn?: string;
  images?: BangumiSubjectImages | null;
  relation?: string;
};

export type BangumiRelatedSubject = {
  id: number;
  type: number;
  staff?: string;
  eps?: string;
  name: string;
  name_cn?: string;
  image?: string;
};

export type BangumiPersonCharacter = {
  id: number;
  name: string;
  type: number;
  images?: BangumiPersonImages | null;
  subject_id: number;
  subject_type: number;
  subject_name: string;
  subject_name_cn?: string;
  staff?: string;
};

export type BangumiCharacter = {
  id: number;
  name: string;
  type: number;
  images?: BangumiPersonImages | null;
  summary?: string;
  infobox?: BangumiInfoboxItem[] | null;
  gender?: string | null;
  blood_type?: number | null;
  birth_year?: number | null;
  birth_mon?: number | null;
  birth_day?: number | null;
  nsfw?: boolean;
};

export type BangumiPerson = {
  id: number;
  name: string;
  type: number;
  career?: string[] | null;
  images?: BangumiPersonImages | null;
  summary?: string;
  infobox?: BangumiInfoboxItem[] | null;
  gender?: string | null;
  blood_type?: number | null;
  birth_year?: number | null;
  birth_mon?: number | null;
  birth_day?: number | null;
};

export type BangumiSubject = {
  id: number;
  type: number;
  name: string;
  name_cn: string;
  summary?: string;
  date?: string;
  air_date?: string;
  image?: string;
  images?: BangumiSubjectImages;
  score?: number;
  rank?: number;
  tags?: BangumiSearchSubjectTag[] | null;
  nsfw?: boolean;
  infobox?: BangumiInfoboxItem[] | null;
};

export type BangumiSearchSubject = {
  id: number;
  type: number;
  name: string;
  name_cn: string;
  summary?: string;
  date?: string;
  image?: string;
  images?: BangumiAvatar;
  score?: number;
  rank?: number;
  tags?: BangumiSearchSubjectTag[] | null;
  nsfw?: boolean;
  infobox?: BangumiInfoboxItem[] | null;
};

export type BangumiSearchSubjectsResult = {
  data: BangumiSearchSubject[];
  total: number;
  limit: number;
  offset: number;
};

export class BangumiApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "BangumiApiError";
    this.status = status;
  }
}
