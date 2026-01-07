/**
 * pi-doom - Play DOOM in your terminal
 *
 * Usage: /doom [path/to/doom1.wad]
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { DoomEngine } from "./doom-engine.js";
import { DoomComponent } from "./doom-component.js";
import { findWadFile } from "./wad-finder.js";

// Persistent engine instance - survives between /doom invocations
let activeEngine: DoomEngine | null = null;
let activeWadPath: string | null = null;

export default function (pi: ExtensionAPI) {
  pi.registerCommand("doom", {
    description: "Play DOOM in your terminal. Usage: /doom [path/to/doom1.wad]",

    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("DOOM requires interactive mode", "error");
        return;
      }

      const requestedWad = args?.trim() || undefined;
      const wad = findWadFile(requestedWad);
      
      if (!wad) {
        ctx.ui.notify(
          requestedWad
            ? `WAD file not found: ${requestedWad}`
            : "No WAD file found. Download doom1.wad from https://distro.ibiblio.org/slitaz/sources/packages/d/doom1.wad",
          "error"
        );
        return;
      }

      try {
        // Reuse existing engine if same WAD, otherwise create new
        let isResume = false;
        if (activeEngine && activeWadPath === wad) {
          ctx.ui.notify("Resuming DOOM...", "info");
          isResume = true;
        } else {
          ctx.ui.notify(`Loading DOOM from ${wad}...`, "info");
          activeEngine = new DoomEngine(wad);
          await activeEngine.init();
          activeWadPath = wad;
        }

        await ctx.ui.custom((tui, _theme, done) => {
          return new DoomComponent(tui, activeEngine!, () => done(undefined), isResume);
        });
      } catch (error) {
        ctx.ui.notify(`Failed to load DOOM: ${error}`, "error");
        activeEngine = null;
        activeWadPath = null;
      }
    },
  });
}
