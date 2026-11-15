/** Resolve a file in public/ under the current deployment base path. */
export function publicAsset(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

export const lumiLogo = {
  src: publicAsset("assets/figma-new/new_logo.svg"),
  width: 211,
  height: 153,
};
