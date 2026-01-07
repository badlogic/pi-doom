/**
 * pi-doom - Play DOOM in your terminal
 *
 * Usage: /doom [path/to/doom1.wad]
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { DoomEngine } from "./doom-engine.js";
import { DoomComponent } from "./doom-component.js";
import { findWadFile } from "./wad-finder.js";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("doom", {
    description: "Play DOOM in your terminal. Usage: /doom [path/to/doom1.wad]",

    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("DOOM requires interactive mode", "error");
        return;
      }

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
