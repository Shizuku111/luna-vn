import { useEffect, useRef, useState } from "react";
import { MessagePlugin } from "@/components/Message";
import { useRefreshSeq } from "@/hooks/useRefreshSeq";
import { toErrorMessage } from "@/utils/errorMessage";

export function useEntityListState<T>({
  refreshToken = 0,
  load,
  loadErrorMessage,
}: {
  refreshToken?: number;
  load: () => Promise<T[]>;
  loadErrorMessage: string;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const refreshSeq = useRefreshSeq();
  const loadRef = useRef(load);
  loadRef.current = load;
  const errorMessageRef = useRef(loadErrorMessage);
  errorMessageRef.current = loadErrorMessage;

  useEffect(() => {
    const seq = refreshSeq.begin();
    void (async () => {
      try {
        const next = await loadRef.current();
        if (!refreshSeq.isCurrent(seq)) return;
        setItems(next);
      } catch (err) {
        if (!refreshSeq.isCurrent(seq)) return;
        MessagePlugin.error(
          toErrorMessage(err, errorMessageRef.current),
        );
      } finally {
        if (refreshSeq.isCurrent(seq)) setLoading(false);
      }
    })();
  }, [refreshToken, refreshSeq]);

  return { items, setItems, loading };
}
