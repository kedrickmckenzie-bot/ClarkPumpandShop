import type { StoredFile } from "@/lib/ops/types";
export function FileLinks({ file, href }: { file: StoredFile; href: string }) {
  if (file.status !== "available") return <span>{file.originalName} · File unavailable</span>;
  return <><a href={href} target="_blank" rel="noopener noreferrer">{file.originalName}</a> · <a href={`${href}${href.includes("?") ? "&" : "?"}download=1`}>Download</a></>;
}
