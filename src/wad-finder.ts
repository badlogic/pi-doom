import { existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Get the bundled WAD path (relative to this module)
const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLED_WAD = join(__dirname, "..", "doom1.wad");

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

  // Check bundled WAD first
  if (existsSync(BUNDLED_WAD)) {
    return BUNDLED_WAD;
  }

  // Fall back to default paths
  for (const p of DEFAULT_WAD_PATHS) {
    const resolved = resolve(p.replace(/^~/, process.env.HOME || ""));
    if (existsSync(resolved)) return resolved;
  }

  return null;
}
