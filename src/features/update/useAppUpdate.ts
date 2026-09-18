import { useContext } from "react";
import { AppUpdateContext, type AppUpdateContextValue } from "./appUpdateContext";

export function useAppUpdate(): AppUpdateContextValue {
  const value = useContext(AppUpdateContext);
  if (!value) {
    throw new Error("useAppUpdate must be used within AppUpdateProvider");
  }
  return value;
}
