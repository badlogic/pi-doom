#!/usr/bin/env node
/**
 * pi-doom standalone runner
 *
 * Usage: npx tsx src/standalone.ts [path/to/doom1.wad]
 */

import { TUI, ProcessTerminal } from "@mariozechner/pi-tui";
import { DoomEngine } from "./doom-engine.js";
import { DoomComponent } from "./doom-component.js";
import { findWadFile } from "./wad-finder.js";

async function main() {
  const args = process.argv.slice(2);
  let wadPath: string | undefined;

  for (const arg of args) {
    if (!arg.startsWith("-")) {
      wadPath = arg;
    }
  }

  const wad = findWadFile(wadPath);
  if (!wad) {
    console.error(wadPath ? `WAD file not found: ${wadPath}` : "No WAD file found.");
    console.error("Download from: https://distro.ibiblio.org/slitaz/sources/packages/d/doom1.wad");
    process.exit(1);
  }

  console.log(`Loading DOOM from ${wad}...`);

  const engine = new DoomEngine(wad);
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
