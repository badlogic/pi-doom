/**
 * pi-doom - Play DOOM in your terminal
 *
 * Usage: /doom [path/to/doom1.wad]
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { isKeyRelease, TUI } from "@mariozechner/pi-tui";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { DoomEngine } from "./doom-engine.js";
import { mapKeyToDoom } from "./doom-keys.js";

const TICK_MS = 1000 / 35; // DOOM runs at 35 fps
const DEFAULT_WAD_PATHS = [
  "./doom1.wad",
  "./DOOM1.WAD",
  "~/doom1.wad",
  "~/.doom/doom1.wad",
];

function renderHalfBlock(
  rgba: Uint8Array,
  width: number,
  height: number,
  targetCols: number,
  targetRows: number
): string[] {
  const lines: string[] = [];
  const scaleX = width / targetCols;
  const scaleY = height / (targetRows * 2);

  for (let row = 0; row < targetRows; row++) {
    let line = "";
    const srcY1 = Math.floor(row * 2 * scaleY);
    const srcY2 = Math.floor((row * 2 + 1) * scaleY);

    for (let col = 0; col < targetCols; col++) {
      const srcX = Math.floor(col * scaleX);
      const idx1 = (srcY1 * width + srcX) * 4;
      const idx2 = (srcY2 * width + srcX) * 4;
      const r1 = rgba[idx1] ?? 0, g1 = rgba[idx1 + 1] ?? 0, b1 = rgba[idx1 + 2] ?? 0;
      const r2 = rgba[idx2] ?? 0, g2 = rgba[idx2 + 1] ?? 0, b2 = rgba[idx2 + 2] ?? 0;
      line += `\x1b[38;2;${r1};${g1};${b1}m\x1b[48;2;${r2};${g2};${b2}m▀`;
    }
    line += "\x1b[0m";
    lines.push(line);
  }
  return lines;
}

class DoomComponent {
  private engine: DoomEngine;
  private interval: ReturnType<typeof setInterval> | null = null;
  private onClose: () => void;
  private tui: TUI;
  private cachedLines: string[] = [];
  private cachedWidth = 0;
  private cachedHeight = 0;
  private version = 0;
  private cachedVersion = -1;

  constructor(
    tui: TUI,
    engine: DoomEngine,
    onClose: () => void
  ) {
    this.tui = tui;
    this.engine = engine;
    this.onClose = onClose;
    this.startGameLoop();
  }

  private startGameLoop(): void {
    this.interval = setInterval(() => {
      try {
        this.engine.tick();
        this.version++;
        this.tui.requestRender();
      } catch (e) {
        // WASM error (e.g., exit via DOOM menu) - treat as quit
        this.dispose();
        this.onClose();
      }
    }, TICK_MS);
  }

  handleInput(data: string): void {
    // Q to quit (but not on release)
    if (!isKeyRelease(data) && (data === "q" || data === "Q")) {
      this.dispose();
      this.onClose();
      return;
    }

    const doomKeys = mapKeyToDoom(data);
    if (doomKeys.length === 0) return;

    const released = isKeyRelease(data);
    
    for (const key of doomKeys) {
      this.engine.pushKey(!released, key);
    }
  }

  invalidate(): void {
    this.cachedWidth = 0;
    this.cachedHeight = 0;
  }

  render(width: number): string[] {
    const height = this.tui.terminal.rows - 1;

    if (
      width === this.cachedWidth &&
      height === this.cachedHeight &&
      this.cachedVersion === this.version
    ) {
      return this.cachedLines;
    }

    const rgba = this.engine.getFrameRGBA();
    const lines = renderHalfBlock(rgba, this.engine.width, this.engine.height, width, height);

    // Footer
    lines.push("\x1b[2m DOOM | Q=Quit | WASD/Arrows=Move | Shift+WASD=Run | Space=Use | F=Fire | 1-7=Weapons\x1b[0m");

    this.cachedLines = lines;
    this.cachedWidth = width;
    this.cachedHeight = height;
    this.cachedVersion = this.version;

    return lines;
  }

  dispose(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

function findWadFile(customPath?: string): string | null {
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

export default function (pi: ExtensionAPI) {
  pi.registerCommand("doom", {
    description: "Play DOOM in your terminal. Usage: /doom [path/to/doom1.wad]",

    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("DOOM requires interactive mode", "error");
        return;
      }

      // Find WAD file
      const wad = findWadFile(args?.trim() || undefined);
      if (!wad) {
        ctx.ui.notify(
          args
            ? `WAD file not found: ${args}`
            : "No WAD file found. Download doom1.wad from https://distro.ibiblio.org/slitaz/sources/packages/d/doom1.wad",
          "error"
        );
        return;
      }

      ctx.ui.notify(`Loading DOOM from ${wad}...`, "info");

      try {
        const engine = new DoomEngine(wad);
        await engine.init();

        await ctx.ui.custom((tui, _theme, done) => {
          return new DoomComponent(tui, engine, () => done(undefined));
        });
      } catch (error) {
        ctx.ui.notify(`Failed to load DOOM: ${error}`, "error");
      }
    },
  });
}
