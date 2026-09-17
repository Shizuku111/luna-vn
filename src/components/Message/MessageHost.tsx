import { useSyncExternalStore, type CSSProperties } from "react";
import { MessageItem } from "./MessageItem";
import {
  MESSAGE_DEFAULT_OFFSET,
  MESSAGE_GAP,
  getMessageSnapshot,
  subscribeMessages,
} from "./store";
import "./Message.css";

export function MessageHost() {
  const messages = useSyncExternalStore(
    subscribeMessages,
    getMessageSnapshot,
    getMessageSnapshot,
  );

  if (messages.length === 0) {
    return null;
  }

  const top = messages[0]?.offset ?? MESSAGE_DEFAULT_OFFSET;

  return (
    <div
      className="ui-message-host"
      style={
        {
          top,
          "--message-gap": `${MESSAGE_GAP}px`,
        } as CSSProperties
      }
      aria-live="polite"
    >
      {messages.map((item) => (
        <MessageItem key={item.id} message={item} />
      ))}
    </div>
  );
}
