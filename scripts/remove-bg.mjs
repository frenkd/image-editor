#!/usr/bin/env node
/**
 * Agent-friendly CLI: remove image background with RMBG-1.4 (local).
 *
 * Usage:
 *   npm run remove-bg -- <input> [output.png] [--color #rrggbb]
 *
 * <input> may be a local path or http(s) image URL.
 * Writes a PNG with alpha (optionally filled with --color).
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";
import { pipeline, RawImage, env } from "@huggingface/transformers";

const MODEL_ID = "briaai/RMBG-1.4";

function usage(code = 1) {
  console.error(`Usage: npm run remove-bg -- <input> [output.png] [--color #rrggbb]

Examples:
  npm run remove-bg -- ./photo.jpg
  npm run remove-bg -- https://example.com/car.jpg ./car-cutout.png
  npm run remove-bg -- ./logo.jpg ./logo.png --color #00a894
`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let color = null;
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--help" || a === "-h") usage(0);
    if (a === "--color") {
      color = args[++i] ?? null;
      continue;
    }
    if (a.startsWith("--color=")) {
      color = a.slice("--color=".length);
      continue;
    }
    positional.push(a);
  }
  const input = positional[0];
  if (!input) usage(1);
  const output =
    positional[1] ??
    defaultOutputPath(input, color);
  return { input, output, color };
}

function defaultOutputPath(input, color) {
  try {
    const u = new URL(input);
    if (u.protocol === "http:" || u.protocol === "https:") {
      const base = path.basename(u.pathname) || "cutout";
      const stem = base.replace(/\.[^.]+$/, "") || "cutout";
      return `${stem}${color ? "-colored" : ""}-cutout.png`;
    }
  } catch {
    /* local path */
  }
  const parsed = path.parse(input);
  return path.join(
    parsed.dir || ".",
    `${parsed.name}${color ? "-colored" : ""}-cutout.png`,
  );
}

function parseHex(hex) {
  const h = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    throw new Error(`Invalid --color (expected #rrggbb): ${hex}`);
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

async function loadImage(input) {
  if (/^https?:\/\//i.test(input)) {
    return RawImage.fromURL(input);
  }
  const abs = path.resolve(input);
  return RawImage.read(abs);
}

function maskAlphaAt(mask, x, y) {
  const i = y * mask.width + x;
  return mask.channels === 1 ? mask.data[i] : mask.data[i * mask.channels];
}

function resizeMaskNearest(mask, w, h) {
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(mask.height - 1, Math.floor((y / h) * mask.height));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(mask.width - 1, Math.floor((x / w) * mask.width));
      out[y * w + x] = maskAlphaAt(mask, sx, sy);
    }
  }
  return out;
}

/** Encode RGBA to PNG (no deps) via zlib-free uncompressed IDAT-ish is hard;
 * use built-in approach: dynamic import of sharp if present, else canvas-less
 * pure PNG encoder for RGBA. */
async function writePngRgba(filePath, rgba, width, height) {
  try {
    const sharp = (await import("sharp")).default;
    await sharp(Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength), {
      raw: { width, height, channels: 4 },
    })
      .png()
      .toFile(filePath);
    return;
  } catch {
    /* fall through to pure encoder */
  }
  const png = encodePngRgba(rgba, width, height);
  await mkdir(path.dirname(path.resolve(filePath)), { recursive: true });
  await writeFile(filePath, png);
}

/** Minimal PNG encoder (RGBA, no filtering) using node zlib. */
function encodePngRgba(rgba, width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1);
    raw[row] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(
      raw,
      row + 1,
    );
  }
  const compressed = deflateSync(raw);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

async function main() {
  const { input, output, color } = parseArgs(process.argv);
  const fill = color ? parseHex(color) : null;

  env.allowLocalModels = false;
  env.allowRemoteModels = true;

  console.error(`[remove-bg] loading model ${MODEL_ID}…`);
  const segmentator = await pipeline("image-segmentation", MODEL_ID, {
    dtype: "q8",
  });

  console.error(`[remove-bg] reading ${input}`);
  const image = await loadImage(input);
  console.error(`[remove-bg] ${image.width}×${image.height}, running…`);

  const outputs = await segmentator(image, {
    threshold: 0.5,
    mask_threshold: 0.5,
  });
  const mask = outputs?.[0]?.mask;
  if (!mask) throw new Error("No mask returned from model.");

  const w = image.width;
  const h = image.height;
  const alpha =
    mask.width === w && mask.height === h
      ? (() => {
          const a = new Uint8ClampedArray(w * h);
          for (let i = 0; i < w * h; i++) {
            a[i] =
              mask.channels === 1
                ? mask.data[i]
                : mask.data[i * mask.channels];
          }
          return a;
        })()
      : resizeMaskNearest(mask, w, h);

  const rgba = new Uint8ClampedArray(w * h * 4);
  const ch = image.channels;
  for (let i = 0; i < w * h; i++) {
    const si = i * ch;
    const oi = i * 4;
    const a = alpha[i];
    const r = image.data[si];
    const g = image.data[si + 1];
    const b = image.data[si + 2];
    if (fill) {
      // Recolor dark ink; keep light holes (e.g. logo letter counters).
      const lum = (r + g + b) / 3;
      if (lum < 200) {
        rgba[oi] = fill.r;
        rgba[oi + 1] = fill.g;
        rgba[oi + 2] = fill.b;
      } else {
        rgba[oi] = r;
        rgba[oi + 1] = g;
        rgba[oi + 2] = b;
      }
      rgba[oi + 3] = a;
    } else {
      rgba[oi] = r;
      rgba[oi + 1] = g;
      rgba[oi + 2] = b;
      rgba[oi + 3] = a;
    }
  }

  const outPath = path.resolve(output);
  await writePngRgba(outPath, rgba, w, h);
  console.error(`[remove-bg] wrote ${outPath}`);
  // Machine-readable last line for agents.
  console.log(pathToFileURL(outPath).href);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
