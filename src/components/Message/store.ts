import type { ReactNode } from "react";

export const TITLEBAR_HEIGHT = 56;
export const MESSAGE_DEFAULT_OFFSET = TITLEBAR_HEIGHT + 10;
export const MESSAGE_DEFAULT_DURATION = 3000;
export const MESSAGE_MAX_COUNT = 5;
export const MESSAGE_GAP = 10;

export type MessageTheme = "info" | "success" | "error" | "warning" | "loading";

export type MessageOptions = {
  content: ReactNode;
  theme?: MessageTheme;
  duration?: number;
  offset?: number;
  showIcon?: boolean;
};

export type MessageRecord = {
  id: string;
  content: ReactNode;
  theme: MessageTheme;
  duration: number;
  offset: number;
  showIcon: boolean;
  leaving?: boolean;
};

let messages: MessageRecord[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeMessages(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getMessageSnapshot() {
  return messages;
}

export function openMessage(options: MessageOptions) {
  const record: MessageRecord = {
    id: crypto.randomUUID(),
    content: options.content,
    theme: options.theme ?? "info",
    duration: options.duration ?? MESSAGE_DEFAULT_DURATION,
    offset: options.offset ?? MESSAGE_DEFAULT_OFFSET,
    showIcon: options.showIcon ?? true,
  };

  messages = [record, ...messages].slice(0, MESSAGE_MAX_COUNT);
  emit();
  return record.id;
}

export function closeMessage(id: string) {
  const target = messages.find((item) => item.id === id);
  if (!target || target.leaving) return;
  messages = messages.map((item) =>
    item.id === id ? { ...item, leaving: true } : item,
  );
  emit();
}

export function removeMessage(id: string) {
  const next = messages.filter((item) => item.id !== id);
  if (next.length === messages.length) return;
  messages = next;
  emit();
}

export function clearMessages() {
  if (messages.length === 0) return;
  if (messages.every((item) => item.leaving)) {
    messages = [];
    emit();
    return;
  }
  messages = messages.map((item) =>
    item.leaving ? item : { ...item, leaving: true },
  );
  emit();
}
