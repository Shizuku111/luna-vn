import { useMemo, useRef } from "react";

export function useRefreshSeq() {
  const seqRef = useRef(0);

  return useMemo(
    () => ({
      begin() {
        seqRef.current += 1;
        return seqRef.current;
      },
      isCurrent(seq: number) {
        return seq === seqRef.current;
      },
    }),
    [],
  );
}
