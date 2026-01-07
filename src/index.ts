/**
 * pi-doom - Play DOOM in your terminal
 *
 * Usage: /doom [path/to/doom1.wad]
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { matchesKey, isKeyRelease, parseKey } from "@mariozechner/pi-tui";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { DoomEngine } from "./doom-engine.js";
import { mapKeyToDoom } from "./doom-keys.js";
import { detectImageSupport, renderHalfBlock, renderKitty, type RenderMode } from "./doom-renderer.js";

const TICK_MS = 1000 / 35; // DOOM runs at 35 fps
const DEFAULT_WAD_PATHS = [
  "./doom1.wad",
  "./DOOM1.WAD",
  "~/doom1.wad",
  "~/.doom/doom1.wad",
];

class DoomComponent {
  private engine: DoomEngine;
  private interval: ReturnType<typeof setInterval> | null = null;
  private onClose: () => void;
  private tui: { requestRender: () => void; width: number; height: number };
  private renderMode: "kitty" | "halfblock";
  private cachedLines: string[] = [];
  private cachedWidth = 0;
  private cachedHeight = 0;
  private version = 0;
  private cachedVersion = -1;

  constructor(
    tui: { requestRender: () => void; width: number; height: number },
    engine: DoomEngine,
    renderMode: RenderMode,
    onClose: () => void
  ) {
    this.tui = tui;
    this.engine = engine;
    this.onClose = onClose;

    // Determine render mode
    if (renderMode === "auto") {
      const support = detectImageSupport();
      this.renderMode = support ? "kitty" : "halfblock";
    } else {
      this.renderMode = renderMode;
    }

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

    // Map key to DOOM
    const doomKeys = mapKeyToDoom(data);
    if (doomKeys.length === 0) return;

    const released = isKeyRelease(data);
    
    // Simple: press = key down, release = key up
    for (const key of doomKeys) {
      this.engine.pushKey(!released, key);
    }
  }

  invalidate(): void {
    this.cachedWidth = 0;
    this.cachedHeight = 0;
  }

  render(width: number): string[] {
    const height = this.tui.height - 2; // Leave room for header/footer

    if (
      width === this.cachedWidth &&
      height === this.cachedHeight &&
      this.cachedVersion === this.version
    ) {
      return this.cachedLines;
    }

    const rgba = this.engine.getFrameRGBA();
    const doomWidth = this.engine.width;
    const doomHeight = this.engine.height;

    let lines: string[];

    if (this.renderMode === "kitty") {
      // Kitty graphics - single escape sequence
      const seq = renderKitty(rgba, doomWidth, doomHeight, width, height);
      // Output empty lines for height, then move up and render image
      lines = [];
      for (let i = 0; i < height - 1; i++) {
        lines.push("");
      }
      const moveUp = height > 1 ? `\x1b[${height - 1}A` : "";
      lines.push(moveUp + seq);
    } else {
      // Half-block rendering
      lines = renderHalfBlock(rgba, doomWidth, doomHeight, width, height);
    }

    // Add controls footer
    const footer = "\x1b[2m DOOM | Q=Quit | WASD/Arrows=Move | Shift+WASD=Run | Space=Use | F=Fire | 1-7=Weapons\x1b[0m";
    lines.push(footer);

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
    description: "Play DOOM in your terminal. Usage: /doom [path/to/doom1.wad] [--mode=auto|kitty|halfblock]",

    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("DOOM requires interactive mode", "error");
        return;
      }

      // Parse args
      let wadPath: string | undefined;
      let renderMode: RenderMode = "auto";

      const parts = args?.split(/\s+/) || [];
      for (const part of parts) {
        if (part.startsWith("--mode=")) {
          const mode = part.slice(7);
          if (mode === "kitty" || mode === "halfblock" || mode === "auto") {
            renderMode = mode;
          }
        } else if (part && !part.startsWith("-")) {
          wadPath = part;
        }
      }

      // Find WAD file
      const wad = findWadFile(wadPath);
      if (!wad) {
        ctx.ui.notify(
          wadPath
            ? `WAD file not found: ${wadPath}`
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
          return new DoomComponent(
            tui,
            engine,
            renderMode,
            () => done(undefined)
          );
        });
      } catch (error) {
        ctx.ui.notify(`Failed to load DOOM: ${error}`, "error");
      }
    },
  });
}
