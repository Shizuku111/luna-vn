import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { MessagePlugin } from "@/components/Message";
import { getShowNsfw } from "@/features/settings";
import { formatTimestampToDateTime } from "@/utils/format";
import { openExternalUrl } from "@/utils/externalUrl";
import {
  getMe,
  getSubjectById,
  getTokenStatus,
  searchSubjects as searchSubjectsApi,
} from "./api";
import { BangumiContext, type BangumiControllerValue } from "./bangumiContext";
import { BANGUMI_TOKEN_CREATE_URL } from "./constants";
import { isSubjectIdKeyword } from "./filterSearchSubjects";
import {
  deleteStoredToken,
  getStoredToken,
  setStoredToken,
} from "./storage/tokenStorage";
import {
  clearCachedSession,
  getCachedTokenExpires,
  getCachedUser,
  setCachedTokenExpires,
  setCachedUser,
} from "./storage/userCache";
import { BangumiApiError, type BangumiUser } from "./types";

function resolveErrorMessage(err: unknown) {
  if (err instanceof BangumiApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "请求失败";
}

function useBangumiControllerState(): BangumiControllerValue {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<BangumiUser | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const syncSession = useCallback(async () => {
    const [me, status] = await Promise.all([getMe(), getTokenStatus()]);

    setUser(me);
    setTokenExpiresAt(formatTimestampToDateTime(status.expires));
    await Promise.all([
      setCachedUser(me),
      setCachedTokenExpires(status.expires),
    ]);
    return me;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const [storedToken, cachedUser, cachedExpires] = await Promise.all([
          getStoredToken(),
          getCachedUser(),
          getCachedTokenExpires(),
        ]);

        if (cancelled) return;

        if (storedToken) {
          setToken(storedToken);
        }
        if (cachedUser) {
          setUser(cachedUser);
        }
        if (cachedExpires) {
          setTokenExpiresAt(formatTimestampToDateTime(cachedExpires));
        }

        if (storedToken) {
          setLoading(true);
          setError(null);
          try {
            await syncSession();
            if (cancelled) return;
          } catch (err) {
            if (cancelled) return;
            const message = resolveErrorMessage(err);
            setError(message);
            setUser(null);
            setTokenExpiresAt(null);
            await clearCachedSession();
            MessagePlugin.error(message);
          } finally {
            if (!cancelled) {
              setLoading(false);
            }
          }
        }
      } finally {
        if (!cancelled) {
          setHydrating(false);
        }
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [syncSession]);

  const openTokenCreatePage = useCallback(async () => {
    await openExternalUrl(BANGUMI_TOKEN_CREATE_URL);
  }, []);

  const logout = useCallback(async () => {
    setToken("");
    setUser(null);
    setTokenExpiresAt(null);
    setError(null);
    await deleteStoredToken();
    await clearCachedSession();
  }, []);

  const fetchSession = useCallback(async () => {
    const trimmed = token.trim() || (await getStoredToken())?.trim() || "";
    if (!trimmed) {
      setError("请先填写 Access Token");
      setUser(null);
      setTokenExpiresAt(null);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const me = await syncSession();
      MessagePlugin.success("Bangumi 登录成功");
      return me;
    } catch (err) {
      const message = resolveErrorMessage(err);
      setError(message);
      setUser(null);
      setTokenExpiresAt(null);
      await clearCachedSession();
      MessagePlugin.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [syncSession, token]);

  const saveToken = useCallback(
    async (nextToken = token) => {
      const trimmed = nextToken.trim();
      setToken(trimmed);
      setError(null);

      if (!trimmed) {
        await logout();
        return null;
      }

      await setStoredToken(trimmed);
      return fetchSession();
    },
    [fetchSession, logout, token],
  );

  const searchSubjects = useCallback(async (keyword: string) => {
    const trimmed = keyword.trim();

    if (isSubjectIdKeyword(trimmed)) {
      try {
        const subject = await getSubjectById(Number(trimmed));
        return [subject];
      } catch (err) {
        if (err instanceof BangumiApiError && err.status === 404) {
          return [];
        }
        throw err;
      }
    }

    const nsfw = await getShowNsfw();
    const result = await searchSubjectsApi({
      keyword: trimmed.replace(/\s+/g, ""),
      filter: { nsfw, type: [4] },
    });
    return result.data ?? [];
  }, []);

  return useMemo(
    () => ({
      token,
      setToken,
      user,
      tokenExpiresAt,
      loading,
      hydrating,
      error,
      isLoggedIn: Boolean(user),
      openTokenCreatePage,
      saveToken,
      fetchMe: fetchSession,
      logout,
      searchSubjects,
    }),
    [
      token,
      user,
      tokenExpiresAt,
      loading,
      hydrating,
      error,
      openTokenCreatePage,
      saveToken,
      fetchSession,
      logout,
      searchSubjects,
    ],
  );
}

export function BangumiProvider({ content }: { content: ReactNode }) {
  const value = useBangumiControllerState();
  return (
    <BangumiContext.Provider value={value}>{content}</BangumiContext.Provider>
  );
}
