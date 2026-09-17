import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import "./Tooltip.css";

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

export type TooltipProps = {
  content?: ReactNode;
  children: ReactNode;
  placement?: TooltipPlacement;
  followCursor?: boolean;
  delay?: number;
  disabled?: boolean;
  className?: string;
};

type TooltipCoords = {
  top: number;
  left: number;
};

const VIEWPORT_PADDING = 8;
const GAP = 8;
const CURSOR_OFFSET = 14;

function resolveCoords(
  trigger: DOMRect,
  tip: DOMRect,
  placement: TooltipPlacement,
): TooltipCoords {
  let top = 0;
  let left = 0;

  switch (placement) {
    case "bottom":
      top = trigger.bottom + GAP;
      left = trigger.left + trigger.width / 2 - tip.width / 2;
      break;
    case "left":
      top = trigger.top + trigger.height / 2 - tip.height / 2;
      left = trigger.left - tip.width - GAP;
      break;
    case "right":
      top = trigger.top + trigger.height / 2 - tip.height / 2;
      left = trigger.right + GAP;
      break;
    case "top":
    default:
      top = trigger.top - tip.height - GAP;
      left = trigger.left + trigger.width / 2 - tip.width / 2;
      break;
  }

  return clampCoords(left, top, tip);
}

function resolveCursorCoords(
  clientX: number,
  clientY: number,
  tip: DOMRect,
): TooltipCoords {
  return clampCoords(clientX + CURSOR_OFFSET, clientY + CURSOR_OFFSET, tip);
}

function clampCoords(left: number, top: number, tip: DOMRect): TooltipCoords {
  const maxLeft = window.innerWidth - tip.width - VIEWPORT_PADDING;
  const maxTop = window.innerHeight - tip.height - VIEWPORT_PADDING;
  return {
    left: Math.min(Math.max(VIEWPORT_PADDING, left), Math.max(VIEWPORT_PADDING, maxLeft)),
    top: Math.min(Math.max(VIEWPORT_PADDING, top), Math.max(VIEWPORT_PADDING, maxTop)),
  };
}

export function Tooltip({
  content,
  children,
  placement = "top",
  followCursor = false,
  delay = 200,
  disabled = false,
  className = "",
}: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const showTimerRef = useRef<number | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<TooltipCoords | null>(null);

  const hasContent = content != null && content !== "";
  const canShow = !disabled && hasContent;

  function clearShowTimer() {
    if (showTimerRef.current != null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }

  function show() {
    if (!canShow) return;
    clearShowTimer();
    showTimerRef.current = window.setTimeout(() => {
      setOpen(true);
    }, delay);
  }

  function hide() {
    clearShowTimer();
    setOpen(false);
    setCoords(null);
  }

  function handleMouseEnter(event: MouseEvent<HTMLSpanElement>) {
    pointerRef.current = { x: event.clientX, y: event.clientY };
    show();
  }

  function handleMouseMove(event: MouseEvent<HTMLSpanElement>) {
    pointerRef.current = { x: event.clientX, y: event.clientY };
    if (!followCursor || !open || !tipRef.current) return;
    setCoords(
      resolveCursorCoords(
        event.clientX,
        event.clientY,
        tipRef.current.getBoundingClientRect(),
      ),
    );
  }

  useEffect(() => () => clearShowTimer(), []);

  useLayoutEffect(() => {
    if (!open || !tipRef.current) return;

    function updatePosition() {
      const tip = tipRef.current;
      if (!tip) return;

      if (followCursor) {
        setCoords(
          resolveCursorCoords(
            pointerRef.current.x,
            pointerRef.current.y,
            tip.getBoundingClientRect(),
          ),
        );
        return;
      }

      const trigger = triggerRef.current;
      if (!trigger) return;
      setCoords(
        resolveCoords(
          trigger.getBoundingClientRect(),
          tip.getBoundingClientRect(),
          placement,
        ),
      );
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, placement, content, followCursor]);

  const tipStyle: CSSProperties | undefined = coords
    ? {
        top: coords.top,
        left: coords.left,
      }
    : undefined;

  return (
    <>
      <span
        ref={triggerRef}
        className={[
          "ui-tooltip-trigger",
          followCursor ? "ui-tooltip-trigger--fill" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={hide}
        onMouseMove={followCursor ? handleMouseMove : undefined}
        onFocus={show}
        onBlur={hide}
        aria-describedby={open && canShow ? tipId : undefined}
      >
        {children}
      </span>
      {open && canShow
        ? createPortal(
            <div
              ref={tipRef}
              id={tipId}
              role="tooltip"
              className={[
                "ui-tooltip",
                followCursor ? "ui-tooltip--cursor" : `ui-tooltip--${placement}`,
                coords ? "is-ready" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={tipStyle}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
