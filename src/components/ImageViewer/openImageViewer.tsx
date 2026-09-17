import { useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ImageViewer as ImageViewerView } from "./ImageViewer";

export type ImageViewerOptions = {
  src: string;
  alt?: string;
  onClose?: () => void;
};

type ImperativeViewerProps = ImageViewerOptions & {
  onSettle: () => void;
};

function ImperativeImageViewer({
  src,
  alt,
  onClose,
  onSettle,
}: ImperativeViewerProps) {
  const [open, setOpen] = useState(true);

  function handleClose() {
    setOpen(false);
    onClose?.();
    onSettle();
  }

  return (
    <ImageViewerView open={open} src={src} alt={alt} onClose={handleClose} />
  );
}

export function openImageViewer(options: ImageViewerOptions): Promise<void> {
  const src = options.src?.trim();
  if (!src || typeof document === "undefined") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.className = "ui-image-viewer-host";
    document.body.appendChild(host);

    const root: Root = createRoot(host);
    let settled = false;

    function cleanup() {
      if (settled) return;
      settled = true;
      resolve();
      window.setTimeout(() => {
        root.unmount();
        host.remove();
      }, 0);
    }

    root.render(
      <ImperativeImageViewer
        src={src}
        alt={options.alt}
        onClose={options.onClose}
        onSettle={cleanup}
      />,
    );
  });
}
