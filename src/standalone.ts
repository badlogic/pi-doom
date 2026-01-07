#!/usr/bin/env node
/**
 * pi-doom standalone runner
 *
 * Usage: npx tsx src/standalone.ts [path/to/doom1.wad] [--mode=auto|kitty|halfblock]
 */

import { TUI, ProcessTerminal, isKeyRelease } from "@mariozechner/pi-tui";
import type { Component } from "@mariozechner/pi-tui";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { mapKeyToDoom } from "./doom-keys.js";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// DOOM Engine
// ============================================================================

interface DoomModule {
  _doomgeneric_Create: (argc: number, argv: number) => void;
  _doomgeneric_Tick: () => void;
  _DG_GetFrameBuffer: () => number;
  _DG_GetScreenWidth: () => number;
  _DG_GetScreenHeight: () => number;
  _DG_PushKeyEvent: (pressed: number, key: number) => void;
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
  FS_createDataFile: (parent: string, name: string, data: number[], canRead: boolean, canWrite: boolean) => void;
  FS_createPath: (parent: string, path: string, canRead: boolean, canWrite: boolean) => string;
  setValue: (ptr: number, value: number, type: string) => void;
  getValue: (ptr: number, type: string) => number;
}

class DoomEngine {
  private module: DoomModule | null = null;
  private frameBufferPtr = 0;
  private initialized = false;
  private wadPath: string;
  private _width = 640;
  private _height = 400;

  constructor(wadPath: string) {
    this.wadPath = wadPath;
  }

  get width() { return this._width; }
  get height() { return this._height; }

  async init(): Promise<void> {
    const buildDir = join(__dirname, "..", "doom", "build");
    const doomJsPath = join(buildDir, "doom.js");

    if (!existsSync(doomJsPath)) {
      throw new Error(`WASM not found. Run ./doom/build.sh first`);
    }

    const wadData = readFileSync(this.wadPath);
    const wadArray = Array.from(new Uint8Array(wadData));

    const createDoomModule = require(doomJsPath);

    const moduleConfig = {
      locateFile: (path: string) => path.endsWith(".wasm") ? join(buildDir, path) : path,
      print: () => {},
      printErr: () => {},
      preRun: [(module: DoomModule) => {
        module.FS_createPath("/", "doom", true, true);
        module.FS_createDataFile("/doom", "doom1.wad", wadArray, true, false);
      }],
    };

    this.module = await createDoomModule(moduleConfig);
    if (!this.module) throw new Error("Failed to initialize DOOM module");

    // Initialize DOOM
    const args = ["doom", "-iwad", "/doom/doom1.wad"];
    const argPtrs: number[] = [];
    for (const arg of args) {
      const ptr = this.module._malloc(arg.length + 1);
      for (let i = 0; i < arg.length; i++) {
        this.module.setValue(ptr + i, arg.charCodeAt(i), "i8");
      }
      this.module.setValue(ptr + arg.length, 0, "i8");
      argPtrs.push(ptr);
    }
    const argvPtr = this.module._malloc(argPtrs.length * 4);
    for (let i = 0; i < argPtrs.length; i++) {
      this.module.setValue(argvPtr + i * 4, argPtrs[i]!, "i32");
    }
    this.module._doomgeneric_Create(args.length, argvPtr);
    for (const ptr of argPtrs) this.module._free(ptr);
    this.module._free(argvPtr);

    this.frameBufferPtr = this.module._DG_GetFrameBuffer();
    this._width = this.module._DG_GetScreenWidth();
    this._height = this.module._DG_GetScreenHeight();
    this.initialized = true;
  }

  tick(): void {
    if (this.module && this.initialized) this.module._doomgeneric_Tick();
  }

  getFrameRGBA(): Uint8Array {
    if (!this.module || !this.initialized) {
      return new Uint8Array(this._width * this._height * 4);
    }
    const pixels = this._width * this._height;
    const buffer = new Uint8Array(pixels * 4);
    for (let i = 0; i < pixels; i++) {
      const argb = this.module.getValue(this.frameBufferPtr + i * 4, "i32");
      const offset = i * 4;
      buffer[offset] = (argb >> 16) & 0xff;
      buffer[offset + 1] = (argb >> 8) & 0xff;
      buffer[offset + 2] = argb & 0xff;
      buffer[offset + 3] = 255;
    }
    return buffer;
  }

  pushKey(pressed: boolean, key: number): void {
    if (this.module && this.initialized) {
      this.module._DG_PushKeyEvent(pressed ? 1 : 0, key);
    }
  }
}

// ============================================================================
// Renderer
// ============================================================================

type RenderMode = "kitty" | "halfblock" | "auto";

function detectImageSupport(): "kitty" | "iterm2" | null {
  const termProgram = process.env.TERM_PROGRAM?.toLowerCase() || "";
  const term = process.env.TERM?.toLowerCase() || "";
  if (process.env.KITTY_WINDOW_ID || termProgram === "kitty") return "kitty";
  if (termProgram === "ghostty" || term.includes("ghostty") || process.env.GHOSTTY_RESOURCES_DIR) return "kitty";
  if (process.env.WEZTERM_PANE || termProgram === "wezterm") return "kitty";
  if (process.env.ITERM_SESSION_ID || termProgram === "iterm.app") return "iterm2";
  return null;
}

function renderHalfBlock(rgba: Uint8Array, width: number, height: number, targetCols: number, targetRows: number): string[] {
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

// ============================================================================
// DOOM Component
// ============================================================================

class DoomComponent implements Component {
  private engine: DoomEngine;
  private tui: TUI;
  private interval: ReturnType<typeof setInterval> | null = null;
  private onExit: () => void;

  constructor(tui: TUI, engine: DoomEngine, onExit: () => void) {
    this.tui = tui;
    this.engine = engine;
    this.onExit = onExit;
    this.startGameLoop();
  }

  private startGameLoop(): void {
    this.interval = setInterval(() => {
      try {
        this.engine.tick();
        this.tui.requestRender();
      } catch (e) {
        // WASM error (e.g., exit via DOOM menu) - treat as quit
        this.dispose();
        this.onExit();
      }
    }, 1000 / 35);
  }

  handleInput(data: string): void {
    // Q to quit (but not on release)
    if (!isKeyRelease(data) && (data === "q" || data === "Q")) {
      this.dispose();
      this.onExit();
      return;
    }

    const doomKeys = mapKeyToDoom(data);
    if (doomKeys.length === 0) return;

    const released = isKeyRelease(data);
    
    // Simple: press = key down, release = key up
    for (const key of doomKeys) {
      this.engine.pushKey(!released, key);
    }
  }

  render(width: number): string[] {
    const height = this.tui.terminal.rows - 1;
    const rgba = this.engine.getFrameRGBA();
    const lines = renderHalfBlock(rgba, this.engine.width, this.engine.height, width, height);

    // Footer
    lines.push("\x1b[2m DOOM | Q=Quit | WASD/Arrows=Move | Shift+WASD=Run | Space=Use | F=Fire | 1-7=Weapons\x1b[0m");

    return lines;
  }

  invalidate(): void {}

  dispose(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  let wadPath = "./doom1.wad";

  for (const arg of args) {
    if (!arg.startsWith("-")) {
      wadPath = arg;
    }
  }

  const resolvedWad = resolve(wadPath.replace(/^~/, process.env.HOME || ""));
  if (!existsSync(resolvedWad)) {
    console.error(`WAD file not found: ${resolvedWad}`);
    console.error("Download from: https://distro.ibiblio.org/slitaz/sources/packages/d/doom1.wad");
    process.exit(1);
  }

  console.log(`Loading DOOM from ${resolvedWad}...`);

  const engine = new DoomEngine(resolvedWad);
  await engine.init();

  console.log(`DOOM initialized (${engine.width}x${engine.height})`);

  const terminal = new ProcessTerminal();
  const tui = new TUI(terminal);

  const doomComponent = new DoomComponent(tui, engine, () => {
    tui.stop();
    process.exit(0);
  });

  tui.addChild(doomComponent);
  tui.setFocus(doomComponent);
  tui.start();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
