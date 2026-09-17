import { createPortal } from "react-dom";
import type { MouseEvent } from "react";
import { CloseIcon } from "@/components/icons";
import { openImageViewer, type ImageViewerOptions } from "./openImageViewer";
import "./ImageViewer.css";

export type ImageViewerProps = {
  open: boolean;
  src: string | null | undefined;
  alt?: string;
  onClose?: () => void;
};

function ImageViewerComponent({
  open,
  src,
  alt = "",
  onClose,
}: ImageViewerProps) {
  if (!open || !src?.trim() || typeof document === "undefined") {
    return null;
  }

  function handleClose() {
    onClose?.();
  }

  function handleCloseClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    handleClose();
  }

  function handleImageClick(event: MouseEvent<HTMLImageElement>) {
    event.stopPropagation();
  }

  return createPortal(
    <div className="ui-image-viewer-root" role="presentation">
      <button
        type="button"
        className="ui-image-viewer-mask"
        aria-label="关闭图片查看器"
        onClick={handleClose}
      />
      <div
        className="ui-image-viewer"
        role="dialog"
        aria-modal="true"
        aria-label="图片查看"
        onClick={handleClose}
      >
        <button
          type="button"
          className="ui-image-viewer-close"
          aria-label="关闭"
          onClick={handleCloseClick}
        >
          <CloseIcon aria-hidden />
        </button>
        <div className="ui-image-viewer-stage">
          <img
            className="ui-image-viewer-image"
            src={src}
            alt={alt}
            referrerPolicy="no-referrer"
            draggable={false}
            onClick={handleImageClick}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

type ImageViewerFn = typeof ImageViewerComponent & {
  open: (options: ImageViewerOptions) => Promise<void>;
};

export const ImageViewer: ImageViewerFn = Object.assign(ImageViewerComponent, {
  open: openImageViewer,
});
