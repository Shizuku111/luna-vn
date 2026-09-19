export function parentDirectory(filePath: string): string | undefined {
  const trimmed = filePath.trim().replace(/[\\/]+$/, "");
  const sep = Math.max(trimmed.lastIndexOf("\\"), trimmed.lastIndexOf("/"));
  if (sep < 0) return undefined;

  const parent = trimmed.slice(0, sep);
  if (!parent) return undefined;
  if (/^[a-zA-Z]:$/.test(parent)) return `${parent}\\`;
  return parent;
}
