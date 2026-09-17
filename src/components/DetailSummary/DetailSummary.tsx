import { useLayoutEffect, useRef, useState } from "react";
import { Dialog } from "@/components/Dialog";
import "./DetailSummary.css";

const SUMMARY_COLLAPSE_MAX_HEIGHT = 120;
const EMPTY_SUMMARY_LABEL = "暂无简介";

type DetailSummaryProps = {
  summary?: string | null;
  className?: string;
  fillHeight?: boolean;
};

export function DetailSummary({
  summary,
  className,
  fillHeight = false,
}: DetailSummaryProps) {
  const text = summary?.trim() ?? "";
  const isEmpty = text.length === 0;
  const textRef = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    setOpen(false);
  }, [text]);

  useLayoutEffect(() => {
    const textEl = textRef.current;
    if (!textEl || isEmpty) {
      setOverflows(false);
      return;
    }

    const body = textEl.parentElement;

    function measure() {
      if (!textRef.current) return;
      if (fillHeight && body) {
        setOverflows(textRef.current.scrollHeight > body.clientHeight + 1);
        return;
      }
      setOverflows(
        textRef.current.scrollHeight > SUMMARY_COLLAPSE_MAX_HEIGHT + 1,
      );
    }

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(textEl);
    if (body) observer.observe(body);
    return () => observer.disconnect();
  }, [text, isEmpty, fillHeight]);

  const collapsed = !isEmpty && (fillHeight || overflows);

  return (
    <div
      className={[
        "detail-summary",
        isEmpty ? "is-empty" : "",
        fillHeight ? "is-fill" : "",
        overflows ? "has-toggle" : "",
        collapsed ? "is-collapsed" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="detail-summary-body">
        <p ref={textRef} className="detail-summary-text">
          {isEmpty ? EMPTY_SUMMARY_LABEL : text}
        </p>
      </div>
      {overflows ? (
        <button
          type="button"
          className="detail-summary-toggle"
          onClick={() => setOpen(true)}
        >
          <span className="detail-summary-toggle-label">more</span>
        </button>
      ) : null}

      <Dialog
        open={open}
        title="简介"
        className="detail-summary-dialog"
        content={<p className="detail-summary-dialog-text">{text}</p>}
        footer={null}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
