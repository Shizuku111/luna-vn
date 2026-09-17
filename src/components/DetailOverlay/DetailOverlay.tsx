import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type AnimationEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import "./DetailOverlay.css";

export type DetailOpenOrigin = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type DetailOverlayProps = {
  origin?: DetailOpenOrigin | null;
  animKey: string | number;
  onClose: () => void;
  onClosing?: () => void;
  onEnterReady?: () => void;
  children: ReactNode | ((requestClose: () => void) => ReactNode);
  className?: string;
  style?: CSSProperties;
  chromeActive?: boolean;
};

type Phase = "enter" | "open" | "exit";

const DetailOverlayChromeContext = createContext<HTMLElement | null>(null);
const DetailOverlayAtmosphereContext = createContext<HTMLElement | null>(null);

export function useDetailOverlayChrome() {
  return useContext(DetailOverlayChromeContext);
}

export function useDetailOverlayAtmosphere() {
  return useContext(DetailOverlayAtmosphereContext);
}

export function DetailOverlay({
  origin = null,
  animKey,
  onClose,
  onClosing,
  onEnterReady,
  children,
  className,
  style,
  chromeActive = true,
}: DetailOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const closedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const onClosingRef = useRef(onClosing);
  const onEnterReadyRef = useRef(onEnterReady);
  const chromeActiveRef = useRef(chromeActive);
  const [phase, setPhase] = useState<Phase>("enter");
  const [scrollReady, setScrollReady] = useState(false);
  const [chromeSlot, setChromeSlot] = useState<HTMLDivElement | null>(null);
  const [atmosphereSlot, setAtmosphereSlot] = useState<HTMLDivElement | null>(
    null,
  );

  onCloseRef.current = onClose;
  onClosingRef.current = onClosing;
  onEnterReadyRef.current = onEnterReady;
  chromeActiveRef.current = chromeActive;

  useLayoutEffect(() => {
    const el = overlayRef.current;
    if (!el) return;

    setScrollReady(false);
    el.style.animation = "";
    el.style.opacity = "";
    el.style.transform = "none";
    const dest = el.getBoundingClientRect();
    el.style.transform = "";

    if (origin && origin.width > 0 && origin.height > 0) {
      const originCX = origin.left + origin.width / 2;
      const originCY = origin.top + origin.height / 2;
      const scale = Math.min(
        origin.width / dest.width,
        origin.height / dest.height,
      );

      el.style.setProperty("--detail-origin-x", `${originCX - dest.left}px`);
      el.style.setProperty("--detail-origin-y", `${originCY - dest.top}px`);
      el.style.setProperty("--detail-start-scale", String(Math.max(scale, 0.08)));
    } else {
      el.style.setProperty("--detail-origin-x", "50%");
      el.style.setProperty("--detail-origin-y", "50%");
      el.style.setProperty("--detail-start-scale", "0.92");
    }

    const frame = window.requestAnimationFrame(() => {
      if (chromeActiveRef.current) onEnterReadyRef.current?.();
      setPhase("open");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [origin, animKey]);

  useEffect(() => {
    if (phase !== "open") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) setScrollReady(true);
  }, [phase]);

  useEffect(() => {
    if (!chromeActive) return;

    if (!scrollReady) {
      const shell = document.querySelector(".app-shell");
      if (shell instanceof HTMLElement) {
        delete shell.dataset.overlayScrolled;
      }
      overlayRef.current?.style.setProperty("--detail-atmosphere-y", "0px");
      return;
    }

    const scroller = scrollRef.current;
    const overlay = overlayRef.current;
    const shell = document.querySelector(".app-shell");
    if (!scroller || !(shell instanceof HTMLElement)) return;

    const syncScrollChrome = () => {
      const y = scroller.scrollTop;
      if (y > 1) {
        shell.dataset.overlayScrolled = "true";
      } else {
        delete shell.dataset.overlayScrolled;
      }
      overlay?.style.setProperty("--detail-atmosphere-y", `${-y}px`);
    };

    syncScrollChrome();
    scroller.addEventListener("scroll", syncScrollChrome, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", syncScrollChrome);
      delete shell.dataset.overlayScrolled;
      overlay?.style.setProperty("--detail-atmosphere-y", "0px");
    };
  }, [animKey, scrollReady, chromeActive]);

  function finishClose() {
    if (closedRef.current) return;
    closedRef.current = true;
    onCloseRef.current();
  }

  useEffect(() => {
    if (phase !== "exit") return;
    setScrollReady(false);
    const el = overlayRef.current;
    if (el) {
      el.style.animation = "";
      el.style.opacity = "";
      el.style.transform = "";
    }
    onClosingRef.current?.();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => finishClose(), reduced ? 0 : 320);
    return () => window.clearTimeout(timer);
  }, [phase]);

  function requestClose() {
    setPhase((current) => (current === "exit" ? current : "exit"));
  }

  function handleAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (phase === "open") {
      const el = overlayRef.current;
      if (el) {
        el.style.animation = "none";
        el.style.opacity = "1";
        el.style.transform = "none";
      }
      setScrollReady(true);
      return;
    }
    if (phase === "exit") finishClose();
  }

  return (
    <div
      ref={overlayRef}
      className={[
        "app-content-overlay",
        "detail-overlay",
        `is-${phase}`,
        scrollReady ? "is-scroll-ready" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
      onAnimationEnd={handleAnimationEnd}
    >
      <div className="detail-overlay-chrome">
        <div className="detail-overlay-chrome-slot" ref={setChromeSlot} />
      </div>
      <div
        className="detail-overlay-atmosphere-slot"
        ref={setAtmosphereSlot}
      />
      <div className="detail-overlay-scroll" ref={scrollRef}>
        <DetailOverlayAtmosphereContext.Provider value={atmosphereSlot}>
          <DetailOverlayChromeContext.Provider value={chromeSlot}>
            {typeof children === "function" ? children(requestClose) : children}
          </DetailOverlayChromeContext.Provider>
        </DetailOverlayAtmosphereContext.Provider>
      </div>
    </div>
  );
}
