import { fetch } from "@tauri-apps/plugin-http";
import { getBangumiMaxConcurrent } from "@/features/bangumi/bangumiConcurrency";
import {
  BANGUMI_API_BASE,
  BANGUMI_USER_AGENT,
} from "@/features/bangumi/constants";
import { getStoredToken } from "@/features/bangumi/storage/tokenStorage";
import { BangumiApiError } from "@/features/bangumi/types";

type QueryValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryValue>;

export type ApiRequestOptions = {
  url: string;
  params?: QueryParams;
  data?: unknown;
  errorMessage?: string;
  withToken?: boolean;
  authQuery?: boolean;
};

let activeBangumiRequests = 0;
const bangumiWaiters: Array<() => void> = [];

function acquireBangumiSlot(): Promise<void> {
  if (activeBangumiRequests < getBangumiMaxConcurrent()) {
    activeBangumiRequests += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    bangumiWaiters.push(resolve);
  });
}

function releaseBangumiSlot() {
  const next = bangumiWaiters.shift();
  if (next) {
    next();
    return;
  }
  activeBangumiRequests = Math.max(0, activeBangumiRequests - 1);
}

async function withBangumiConcurrencyLimit<T>(
  run: () => Promise<T>,
): Promise<T> {
  await acquireBangumiSlot();
  try {
    return await run();
  } finally {
    releaseBangumiSlot();
  }
}

function resolveUrl(url: string, params?: QueryParams) {
  const absolute = /^https?:\/\//i.test(url)
    ? url
    : `${BANGUMI_API_BASE}/${url.replace(/^\//, "")}`;
  const resolved = new URL(absolute);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value == null) continue;
      resolved.searchParams.set(key, String(value));
    }
  }

  return resolved.toString();
}

async function request<T>(
  method: "GET" | "POST",
  {
    url,
    params,
    data,
    errorMessage,
    withToken = true,
    authQuery = false,
  }: ApiRequestOptions,
): Promise<T> {
  return withBangumiConcurrencyLimit(async () => {
    const token = (await getStoredToken())?.trim() || null;
    const query: QueryParams = { ...params };

    if (authQuery && token) {
      query.access_token = token;
    }

    const headers: Record<string, string> = {
      "User-Agent": BANGUMI_USER_AGENT,
      Accept: "application/json",
    };

    if (data !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    if (withToken && token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const init: RequestInit = {
      method,
      headers,
    };

    if (data !== undefined) {
      init.body = JSON.stringify(data);
    }

    const response = await fetch(resolveUrl(url, query), init);

    if (!response.ok) {
      throw new BangumiApiError(
        `${errorMessage ?? "请求失败"}（${response.status}）`,
        response.status,
      );
    }

    return (await response.json()) as T;
  });
}

export const api = {
  get<T>(options: Omit<ApiRequestOptions, "data">) {
    return request<T>("GET", options);
  },
  post<T>(options: ApiRequestOptions) {
    return request<T>("POST", options);
  },
};
