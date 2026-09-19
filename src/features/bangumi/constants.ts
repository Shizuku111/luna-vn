export const BANGUMI_API_BASE = "https://api.bgm.tv";
export const BANGUMI_OAUTH_BASE = "https://bgm.tv";
export const BANGUMI_TOKEN_CREATE_URL =
  "https://next.bgm.tv/demo/access-token/create";
import packageJson from "../../../package.json";

export const BANGUMI_USER_AGENT = `luna-vn/${packageJson.version}`;
export const BANGUMI_MAX_CONCURRENT = 5;
export const BANGUMI_SUBJECT_TYPE_GAME = 4;

export function bangumiSubjectUrl(subjectId: number) {
  return `${BANGUMI_OAUTH_BASE}/subject/${subjectId}`;
}

export function bangumiCharacterUrl(characterId: number) {
  return `${BANGUMI_OAUTH_BASE}/character/${characterId}`;
}

export function bangumiPersonUrl(personId: number) {
  return `${BANGUMI_OAUTH_BASE}/person/${personId}`;
}

export function bangumiGameTagUrl(tag: string) {
  return `${BANGUMI_OAUTH_BASE}/game/tag/${encodeURIComponent(tag.trim())}`;
}
