import { useEffect, type AnimationEvent, type ReactNode } from "react";
import {
  CheckIcon,
  CloseIcon,
  InfoIcon,
  LoadingIcon,
} from "@/components/icons";
import {
  closeMessage,
  removeMessage,
  type MessageRecord,
  type MessageTheme,
} from "./store";
import "./Message.css";

type MessageItemProps = {
  message: MessageRecord;
};

function resolveThemeIcon(theme: MessageTheme): ReactNode {
  switch (theme) {
    case "success":
      return <CheckIcon aria-hidden />;
    case "error":
      return <CloseIcon aria-hidden />;
    case "loading":
      return <LoadingIcon aria-hidden />;
    case "info":
    case "warning":
    default:
      return <InfoIcon aria-hidden />;
  }
}

export function MessageItem({ message }: MessageItemProps) {
  useEffect(() => {
    if (message.duration <= 0 || message.leaving) return;

    const timer = window.setTimeout(() => {
      closeMessage(message.id);
    }, message.duration);

    return () => {
      window.clearTimeout(timer);
    };
  }, [message.duration, message.id, message.leaving]);

  function handleAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (!message.leaving) return;
    removeMessage(message.id);
  }

  return (
    <div
      className={[
        "ui-message",
        `ui-message--${message.theme}`,
        message.leaving ? "is-leaving" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="status"
      onAnimationEnd={handleAnimationEnd}
    >
      {message.showIcon ? (
        <span
          className={[
            "ui-message-icon",
            message.theme === "loading" ? "is-spinning" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden
        >
          {resolveThemeIcon(message.theme)}
        </span>
      ) : null}
      <div className="ui-message-content">{message.content}</div>
    </div>
  );
}
