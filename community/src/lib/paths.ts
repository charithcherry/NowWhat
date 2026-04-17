/** Prefix for same-origin URLs when the app uses Next.js `basePath` (e.g. /community). */
export function withBasePath(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

/** Browser fetch to this app's API routes (works with basePath). */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return withBasePath(p);
}

/** Public folder assets (img src, etc.) when basePath is set. */
export function publicAsset(path: string): string {
  return withBasePath(path.startsWith("/") ? path : `/${path}`);
}
