# pi-doom

Play DOOM in your terminal with [pi](https://github.com/badlogic/pi-mono).

![DOOM in terminal](https://raw.githubusercontent.com/badlogic/pi-doom/main/screenshot.png)

## Features

- Full DOOM gameplay in your terminal
- Two rendering modes:
  - **Kitty graphics** (kitty, wezterm, ghostty, iTerm2) for smooth image rendering
  - **Half-block characters** (▀) for universal terminal support
- Keyboard controls with WASD/arrow keys
- Works as a pi extension

## Requirements

- [pi](https://github.com/badlogic/pi-mono) (the coding agent)
- DOOM WAD file (shareware `doom1.wad` is freely available)
- For building: [Emscripten](https://emscripten.org/) SDK

## Installation

### Option 1: Clone and register

```bash
git clone https://github.com/badlogic/pi-doom.git
cd pi-doom

# Build the WASM module (requires Emscripten)
./doom/build.sh

# Register with pi (add to ~/.pi/agent/settings.json)
# "extensions": ["/path/to/pi-doom"]
```

### Option 2: Use prebuilt (coming soon)

Prebuilt WASM binaries will be available in releases.

## Building the WASM Module

Install Emscripten:

```bash
# macOS
brew install emscripten

# Or manually
git clone https://github.com/emscripten-core/emsdk.git ~/emsdk
cd ~/emsdk && ./emsdk install latest && ./emsdk activate latest
source ~/emsdk/emsdk_env.sh
```

Build:

```bash
./doom/build.sh
```

This clones [doomgeneric](https://github.com/ozkl/doomgeneric) and compiles it to WebAssembly.

## Usage

Get a WAD file (shareware version is free):

```bash
curl -O https://distro.ibiblio.org/slitaz/sources/packages/d/doom1.wad
```

In pi, run:

```
/doom ./doom1.wad
```

### Options

```
/doom [path/to/doom.wad] [--mode=auto|kitty|halfblock]
```

- `--mode=auto` (default): Detect terminal capabilities
- `--mode=kitty`: Force Kitty graphics protocol
- `--mode=halfblock`: Force half-block character rendering

## Controls

| Action | Keys |
|--------|------|
| Move | WASD or Arrow Keys |
| Fire | Ctrl |
| Use/Open | Space |
| Run | Shift |
| Strafe | A/D |
| Weapons | 1-7 |
| Menu | Escape |
| Map | Tab |
| Quit | Q or Ctrl+C |

## How It Works

```
┌─────────────────┐    ┌──────────────────┐    ┌────────────────┐
│  doomgeneric    │───▶│  pi-doom         │───▶│   Terminal     │
│  (WASM)         │    │  renderer        │    │   Display      │
└─────────────────┘    └──────────────────┘    └────────────────┘
         ▲                      │
         │                      │
         └──────────────────────┘
              Key Events
```

1. DOOM runs as WebAssembly (compiled via Emscripten)
2. Each frame, DOOM renders to a framebuffer
3. pi-doom converts the framebuffer to either:
   - Kitty graphics protocol (PNG encoded)
   - Half-block characters with true color
4. Keyboard input is mapped to DOOM key codes

## Resolution

Default resolution is 640x400. You can change it at build time:

```bash
DOOM_RESX=320 DOOM_RESY=200 ./doom/build.sh
```

Lower resolution = faster rendering, especially for half-block mode.

## Credits

- [id Software](https://github.com/id-Software/DOOM) for the original DOOM
- [doomgeneric](https://github.com/ozkl/doomgeneric) for the portable DOOM implementation
- [opentui-doom](https://github.com/muhammedaksam/opentui-doom) for the inspiration

## License

GPL-2.0 (DOOM source code license)
