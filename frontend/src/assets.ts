/** Resolve a file in public/ under the current deployment base path. */
export function publicAsset(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}
