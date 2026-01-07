# pi-doom

Play DOOM in your terminal with [pi](https://github.com/badlogic/pi-mono).

![DOOM in terminal](https://raw.githubusercontent.com/badlogic/pi-doom/main/screenshot.png)

## Run as pi Extension

```bash
git clone https://github.com/badlogic/pi-doom.git
pi --extensions /path/to/pi-doom
```

Then in pi:

```
/doom
```

Press `Q` to pause and return to pi. Run `/doom` again to resume.

## Run Standalone

```bash
git clone https://github.com/badlogic/pi-doom.git
cd pi-doom
npm install
npm start
```

Press `Q` or `Ctrl+C` to quit.

## Controls

| Action | Keys |
|--------|------|
| Move | WASD or Arrow Keys |
| Run | Shift + WASD |
| Fire | F or Ctrl |
| Use/Open | Space |
| Weapons | 1-7 |
| Map | Tab |
| Menu | Escape |
| Pause/Quit | Q |

## How It Works

DOOM runs as WebAssembly compiled from [doomgeneric](https://github.com/ozkl/doomgeneric). Each frame is rendered using half-block characters (▀) with 24-bit color, where the top pixel is the foreground color and the bottom pixel is the background color.

The WASM module and shareware WAD are bundled in the repo, so there are no external dependencies.

## Credits

- [id Software](https://github.com/id-Software/DOOM) for the original DOOM
- [doomgeneric](https://github.com/ozkl/doomgeneric) for the portable DOOM implementation
- [opentui-doom](https://github.com/muhammedaksam/opentui-doom) for the inspiration

## License

GPL-2.0 (DOOM source code license)
