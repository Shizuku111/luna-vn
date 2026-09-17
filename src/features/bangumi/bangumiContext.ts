import { createContext } from "react";
import type { BangumiSearchSubject, BangumiUser } from "./types";

export type BangumiControllerValue = {
  token: string;
  setToken: (token: string) => void;
  user: BangumiUser | null;
  tokenExpiresAt: string | null;
  loading: boolean;
  hydrating: boolean;
  error: string | null;
  isLoggedIn: boolean;
  openTokenCreatePage: () => Promise<void>;
  saveToken: (nextToken?: string) => Promise<BangumiUser | null>;
  fetchMe: () => Promise<BangumiUser | null>;
  logout: () => Promise<void>;
  searchSubjects: (keyword: string) => Promise<BangumiSearchSubject[]>;
};

export const BangumiContext = createContext<BangumiControllerValue | null>(null);
