import { useEffect, useState } from "react";
import { getShowOriginalName } from "./storage/settingsStore";

export function useShowOriginalName() {
  const [showOriginalName, setValue] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const value = await getShowOriginalName();
      if (!cancelled) setValue(value);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return showOriginalName;
}
