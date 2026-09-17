export function toErrorMessage(err: unknown, fallback = "操作失败"): string {
  if (typeof err === "string" && err.trim()) return err;
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}
