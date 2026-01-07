import { existsSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_WAD_PATHS = [
  "./doom1.wad",
  "./DOOM1.WAD",
  "~/doom1.wad",
  "~/.doom/doom1.wad",
];

export function findWadFile(customPath?: string): string | null {
  if (customPath) {
    const resolved = resolve(customPath.replace(/^~/, process.env.HOME || ""));
    if (existsSync(resolved)) return resolved;
    return null;
  }

  for (const p of DEFAULT_WAD_PATHS) {
    const resolved = resolve(p.replace(/^~/, process.env.HOME || ""));
    if (existsSync(resolved)) return resolved;
  }

  return null;
}
