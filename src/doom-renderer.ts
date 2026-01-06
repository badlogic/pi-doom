/**
 * DOOM terminal renderer
 *
 * Supports two modes:
 * - Kitty graphics protocol (for kitty, wezterm, ghostty, iterm2)
 * - Half-block characters (universal fallback)
 */

export type RenderMode = "kitty" | "halfblock" | "auto";

/**
 * Detect if terminal supports kitty graphics protocol
 */
export function detectImageSupport(): "kitty" | "iterm2" | null {
  const termProgram = process.env.TERM_PROGRAM?.toLowerCase() || "";
  const term = process.env.TERM?.toLowerCase() || "";

  if (process.env.KITTY_WINDOW_ID || termProgram === "kitty") {
    return "kitty";
  }
  if (termProgram === "ghostty" || term.includes("ghostty") || process.env.GHOSTTY_RESOURCES_DIR) {
    return "kitty";
  }
  if (process.env.WEZTERM_PANE || termProgram === "wezterm") {
    return "kitty";
  }
  if (process.env.ITERM_SESSION_ID || termProgram === "iterm.app") {
    return "iterm2";
  }

  return null;
}

/**
 * Encode RGBA data as PNG (minimal implementation)
 */
function encodePNG(rgba: Uint8Array, width: number, height: number): Uint8Array {
  // We'll use raw RGBA with zlib compression
  // This is a simplified PNG encoder

  const { deflateSync } = require("node:zlib");

  // PNG signature
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // CRC32 table
  const crcTable: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c;
  }

  function crc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
      crc = crcTable[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type: string, data: Uint8Array): Uint8Array {
    const chunk = new Uint8Array(4 + 4 + data.length + 4);
    const view = new DataView(chunk.buffer);

    // Length
    view.setUint32(0, data.length, false);

    // Type
    for (let i = 0; i < 4; i++) {
      chunk[4 + i] = type.charCodeAt(i);
    }

    // Data
    chunk.set(data, 8);

    // CRC (over type + data)
    const crcData = new Uint8Array(4 + data.length);
    for (let i = 0; i < 4; i++) {
      crcData[i] = type.charCodeAt(i);
    }
    crcData.set(data, 4);
    view.setUint32(8 + data.length, crc32(crcData), false);

    return chunk;
  }

  // IHDR chunk
  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width, false);
  ihdrView.setUint32(4, height, false);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type (RGBA)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT chunk - raw image data with filter bytes
  const rawData = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // filter type: none
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = y * (1 + width * 4) + 1 + x * 4;
      rawData[dstIdx + 0] = rgba[srcIdx + 0]!;
      rawData[dstIdx + 1] = rgba[srcIdx + 1]!;
      rawData[dstIdx + 2] = rgba[srcIdx + 2]!;
      rawData[dstIdx + 3] = rgba[srcIdx + 3]!;
    }
  }

  const compressed = deflateSync(rawData, { level: 1 }); // Fast compression

  // IEND chunk
  const iend = new Uint8Array(0);

  // Combine all chunks
  const ihdrChunk = makeChunk("IHDR", ihdr);
  const idatChunk = makeChunk("IDAT", compressed);
  const iendChunk = makeChunk("IEND", iend);

  const png = new Uint8Array(
    signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length
  );
  let offset = 0;
  png.set(signature, offset);
  offset += signature.length;
  png.set(ihdrChunk, offset);
  offset += ihdrChunk.length;
  png.set(idatChunk, offset);
  offset += idatChunk.length;
  png.set(iendChunk, offset);

  return png;
}

/**
 * Render frame using Kitty graphics protocol
 */
export function renderKitty(
  rgba: Uint8Array,
  width: number,
  height: number,
  targetCols: number,
  targetRows: number
): string {
  // Scale down if needed
  const { scaledRgba, scaledWidth, scaledHeight } = scaleDown(
    rgba,
    width,
    height,
    targetCols * 10, // Approximate pixels per cell
    targetRows * 20
  );

  const png = encodePNG(scaledRgba, scaledWidth, scaledHeight);
  const base64 = Buffer.from(png).toString("base64");

  // Kitty graphics protocol
  const CHUNK_SIZE = 4096;
  const chunks: string[] = [];

  // First chunk with parameters
  // a=T (transmit), f=100 (PNG), q=2 (quiet), c=cols, r=rows
  const params = `a=T,f=100,q=2,c=${targetCols},r=${targetRows}`;

  if (base64.length <= CHUNK_SIZE) {
    return `\x1b_G${params};${base64}\x1b\\`;
  }

  let offset = 0;
  let isFirst = true;

  while (offset < base64.length) {
    const chunk = base64.slice(offset, offset + CHUNK_SIZE);
    const isLast = offset + CHUNK_SIZE >= base64.length;

    if (isFirst) {
      chunks.push(`\x1b_G${params},m=1;${chunk}\x1b\\`);
      isFirst = false;
    } else if (isLast) {
      chunks.push(`\x1b_Gm=0;${chunk}\x1b\\`);
    } else {
      chunks.push(`\x1b_Gm=1;${chunk}\x1b\\`);
    }

    offset += CHUNK_SIZE;
  }

  return chunks.join("");
}

/**
 * Render frame using half-block characters
 * Each terminal cell = 2 vertical pixels using ▀ character
 * Foreground = top pixel, background = bottom pixel
 */
export function renderHalfBlock(
  rgba: Uint8Array,
  width: number,
  height: number,
  targetCols: number,
  targetRows: number
): string[] {
  const lines: string[] = [];

  // Scale factors
  const scaleX = width / targetCols;
  const scaleY = height / (targetRows * 2); // *2 because each cell = 2 pixels vertically

  for (let row = 0; row < targetRows; row++) {
    let line = "";
    const srcY1 = Math.floor(row * 2 * scaleY);
    const srcY2 = Math.floor((row * 2 + 1) * scaleY);

    for (let col = 0; col < targetCols; col++) {
      const srcX = Math.floor(col * scaleX);

      // Top pixel (foreground)
      const idx1 = (srcY1 * width + srcX) * 4;
      const r1 = rgba[idx1] ?? 0;
      const g1 = rgba[idx1 + 1] ?? 0;
      const b1 = rgba[idx1 + 2] ?? 0;

      // Bottom pixel (background)
      const idx2 = (srcY2 * width + srcX) * 4;
      const r2 = rgba[idx2] ?? 0;
      const g2 = rgba[idx2 + 1] ?? 0;
      const b2 = rgba[idx2 + 2] ?? 0;

      // ANSI true color: \x1b[38;2;R;G;Bm for foreground, \x1b[48;2;R;G;Bm for background
      line += `\x1b[38;2;${r1};${g1};${b1}m\x1b[48;2;${r2};${g2};${b2}m▀`;
    }

    line += "\x1b[0m"; // Reset colors
    lines.push(line);
  }

  return lines;
}

/**
 * Simple nearest-neighbor downscale
 */
function scaleDown(
  rgba: Uint8Array,
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number
): { scaledRgba: Uint8Array; scaledWidth: number; scaledHeight: number } {
  if (width <= maxWidth && height <= maxHeight) {
    return { scaledRgba: rgba, scaledWidth: width, scaledHeight: height };
  }

  const scale = Math.min(maxWidth / width, maxHeight / height);
  const newWidth = Math.floor(width * scale);
  const newHeight = Math.floor(height * scale);

  const scaled = new Uint8Array(newWidth * newHeight * 4);

  for (let y = 0; y < newHeight; y++) {
    const srcY = Math.floor(y / scale);
    for (let x = 0; x < newWidth; x++) {
      const srcX = Math.floor(x / scale);
      const srcIdx = (srcY * width + srcX) * 4;
      const dstIdx = (y * newWidth + x) * 4;
      scaled[dstIdx] = rgba[srcIdx]!;
      scaled[dstIdx + 1] = rgba[srcIdx + 1]!;
      scaled[dstIdx + 2] = rgba[srcIdx + 2]!;
      scaled[dstIdx + 3] = rgba[srcIdx + 3]!;
    }
  }

  return { scaledRgba: scaled, scaledWidth: newWidth, scaledHeight: newHeight };
}
