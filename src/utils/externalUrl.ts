import { openUrl } from "@tauri-apps/plugin-opener";

const PLAIN_URL_RE = /^https?:\/\/\S+$/i;
const WIKI_LINK_RE = /^\[(https?:\/\/[^\s\]]+)(?:\s+([^\]]*))?\]$/i;
const LABELED_URL_RE = /^(.+?)[：:](https?:\/\/\S+)$/i;

type ResolvedExternalUrl = {
  href: string;
  label: string;
};

function isHttpUrl(href: string) {
  try {
    const parsed = new URL(href);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function resolveExternalLink(raw: string): ResolvedExternalUrl | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const wiki = trimmed.match(WIKI_LINK_RE);
  if (wiki) {
    const href = wiki[1];
    if (!isHttpUrl(href)) return null;
    const label = wiki[2]?.trim();
    return { href, label: label || href };
  }

  if (PLAIN_URL_RE.test(trimmed) && isHttpUrl(trimmed)) {
    return { href: trimmed, label: trimmed };
  }

  const labeled = trimmed.match(LABELED_URL_RE);
  if (labeled) {
    const href = labeled[2];
    if (!isHttpUrl(href)) return null;
    return { href, label: labeled[1].trim() || href };
  }

  return null;
}

export function isExternalUrl(value: string): boolean {
  return resolveExternalLink(value) != null;
}

export async function openExternalUrl(url: string): Promise<void> {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error("链接为空");
  }

  const resolved = resolveExternalLink(trimmed);
  if (!resolved) {
    throw new Error("仅支持 http/https 链接");
  }
  await openUrl(resolved.href);
}
