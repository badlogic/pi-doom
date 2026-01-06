/**
 * DOOM key codes (from doomkeys.h)
 */
export const DoomKeys = {
  KEY_RIGHTARROW: 0xae,
  KEY_LEFTARROW: 0xac,
  KEY_UPARROW: 0xad,
  KEY_DOWNARROW: 0xaf,
  KEY_STRAFE_L: 0xa0,
  KEY_STRAFE_R: 0xa1,
  KEY_USE: 0xa2,
  KEY_FIRE: 0xa3,
  KEY_ESCAPE: 27,
  KEY_ENTER: 13,
  KEY_TAB: 9,
  KEY_F1: 0x80 + 0x3b,
  KEY_F2: 0x80 + 0x3c,
  KEY_F3: 0x80 + 0x3d,
  KEY_F4: 0x80 + 0x3e,
  KEY_F5: 0x80 + 0x3f,
  KEY_F6: 0x80 + 0x40,
  KEY_F7: 0x80 + 0x41,
  KEY_F8: 0x80 + 0x42,
  KEY_F9: 0x80 + 0x43,
  KEY_F10: 0x80 + 0x44,
  KEY_F11: 0x80 + 0x57,
  KEY_F12: 0x80 + 0x58,
  KEY_BACKSPACE: 127,
  KEY_PAUSE: 0xff,
  KEY_EQUALS: 0x3d,
  KEY_MINUS: 0x2d,
  KEY_RSHIFT: 0x80 + 0x36,
  KEY_RCTRL: 0x80 + 0x1d,
  KEY_RALT: 0x80 + 0x38,
} as const;

/**
 * Map terminal key input to DOOM key codes
 */
export function mapKeyToDoom(data: string, name?: string): number[] {
  const keyName = name?.toLowerCase() ?? "";

  // Arrow keys (escape sequences)
  if (data === "\x1b[A" || keyName === "up") return [DoomKeys.KEY_UPARROW];
  if (data === "\x1b[B" || keyName === "down") return [DoomKeys.KEY_DOWNARROW];
  if (data === "\x1b[C" || keyName === "right") return [DoomKeys.KEY_RIGHTARROW];
  if (data === "\x1b[D" || keyName === "left") return [DoomKeys.KEY_LEFTARROW];

  // WASD
  if (data === "w" || data === "W") return [DoomKeys.KEY_UPARROW];
  if (data === "s" || data === "S") return [DoomKeys.KEY_DOWNARROW];
  if (data === "a" || data === "A") return [DoomKeys.KEY_STRAFE_L];
  if (data === "d" || data === "D") return [DoomKeys.KEY_STRAFE_R];

  // Action keys
  if (data === " ") return [DoomKeys.KEY_USE];
  if (data === "\r" || data === "\n" || keyName === "return") return [DoomKeys.KEY_ENTER];
  if (data === "\x1b" || keyName === "escape") return [DoomKeys.KEY_ESCAPE];
  if (data === "\t" || keyName === "tab") return [DoomKeys.KEY_TAB];
  if (data === "\x7f" || keyName === "backspace") return [DoomKeys.KEY_BACKSPACE];

  // Ctrl = Fire (but not Ctrl+C)
  if (data.charCodeAt(0) < 32 && data !== "\x03") return [DoomKeys.KEY_FIRE];

  // Weapon selection
  if (data >= "0" && data <= "9") return [data.charCodeAt(0)];

  // Plus/minus
  if (data === "+" || data === "=") return [DoomKeys.KEY_EQUALS];
  if (data === "-") return [DoomKeys.KEY_MINUS];

  // Y/N for prompts
  if (data === "y" || data === "Y") return ["y".charCodeAt(0)];
  if (data === "n" || data === "N") return ["n".charCodeAt(0)];

  // Other printable characters (for cheats)
  if (data.length === 1 && data.charCodeAt(0) >= 32) {
    return [data.toLowerCase().charCodeAt(0)];
  }

  return [];
}
