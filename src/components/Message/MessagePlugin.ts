import { createRoot, type Root } from "react-dom/client";
import type { ReactNode } from "react";
import { createElement } from "react";
import { MessageHost } from "./MessageHost";
import {
  clearMessages,
  closeMessage,
  openMessage,
  type MessageOptions,
  type MessageTheme,
} from "./store";

type MessagePluginContent = ReactNode | MessageOptions;

let hostRoot: Root | null = null;
let hostNode: HTMLDivElement | null = null;

function ensureHost() {
  if (typeof document === "undefined") return;

  if (!hostNode) {
    hostNode = document.createElement("div");
    hostNode.id = "ui-message-root";
    document.body.appendChild(hostNode);
  }

  if (!hostRoot) {
    hostRoot = createRoot(hostNode);
    hostRoot.render(createElement(MessageHost));
  }
}

function normalizeOptions(
  contentOrOptions: MessagePluginContent,
  theme?: MessageTheme,
): MessageOptions {
  if (
    contentOrOptions !== null &&
    typeof contentOrOptions === "object" &&
    !Array.isArray(contentOrOptions) &&
    "content" in contentOrOptions
  ) {
    return {
      ...contentOrOptions,
      theme: contentOrOptions.theme ?? theme ?? "info",
    };
  }

  return {
    content: contentOrOptions,
    theme: theme ?? "info",
  };
}

function show(contentOrOptions: MessagePluginContent, theme?: MessageTheme) {
  ensureHost();
  return openMessage(normalizeOptions(contentOrOptions, theme));
}

type MessagePluginFn = {
  (options: MessageOptions): string;
  (content: ReactNode, options?: Omit<MessageOptions, "content">): string;
  info: (contentOrOptions: MessagePluginContent) => string;
  success: (contentOrOptions: MessagePluginContent) => string;
  error: (contentOrOptions: MessagePluginContent) => string;
  warning: (contentOrOptions: MessagePluginContent) => string;
  loading: (contentOrOptions: MessagePluginContent) => string;
  close: (id: string) => void;
  clear: () => void;
};

function messagePlugin(
  contentOrOptions: MessagePluginContent,
  maybeOptions?: Omit<MessageOptions, "content">,
) {
  if (
    contentOrOptions !== null &&
    typeof contentOrOptions === "object" &&
    !Array.isArray(contentOrOptions) &&
    "content" in contentOrOptions
  ) {
    return show(contentOrOptions);
  }

  return show({
    content: contentOrOptions,
    ...maybeOptions,
  });
}

export const MessagePlugin: MessagePluginFn = Object.assign(messagePlugin, {
  info(contentOrOptions: MessagePluginContent) {
    return show(contentOrOptions, "info");
  },
  success(contentOrOptions: MessagePluginContent) {
    return show(contentOrOptions, "success");
  },
  error(contentOrOptions: MessagePluginContent) {
    return show(contentOrOptions, "error");
  },
  warning(contentOrOptions: MessagePluginContent) {
    return show(contentOrOptions, "warning");
  },
  loading(contentOrOptions: MessagePluginContent) {
    const options =
      contentOrOptions !== null &&
      typeof contentOrOptions === "object" &&
      !Array.isArray(contentOrOptions) &&
      "content" in contentOrOptions
        ? contentOrOptions
        : { content: contentOrOptions };
    return show({ duration: 0, ...options }, "loading");
  },
  close(id: string) {
    closeMessage(id);
  },
  clear() {
    clearMessages();
  },
});
