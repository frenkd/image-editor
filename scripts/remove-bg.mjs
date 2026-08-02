#!/usr/bin/env node
/**
 * Agent-friendly CLI: remove image background with RMBG-1.4 (local).
 *
 * Usage:
 *   npm run remove-bg -- <input> [output.png] [options]
 *
 * Options:
 *   --color #rrggbb          Solid-fill opaque pixels (logo recolor)
 *   --remove-speckles        Drop small opaque BG islands
 *   --fill-holes             Fill tiny enclosed mask holes (default cap)
 *   --fill-holes=all         Fill every enclosed hole (logos / letter counters)
 *   --solid                  Hard 0/255 alpha + dilate (seal hairline gaps)
 *   --mode ink               Luminance ink cutout (logos on paper; skips model)
 *   --ink-max 96             Max luminance treated as ink for --mode ink
 *   --advanced               --remove-speckles + --fill-holes
 *   --crop auto              Tight crop to solid content (+ pad)
 *   --crop x,y,w,h           Manual crop in pixels
 *   --pad 0.03               Auto-crop padding as fraction of image (default 0.03)
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";
import { pipeline, RawImage, env } from "@huggingface/transformers";

const MODEL_ID = "briaai/RMBG-1.4";
const SOLID_ALPHA = 56;
const MIN_BLOB_FRACTION = 0.04;
const MIN_BLOB_AREA = 96;
const MAX_TINY_HOLE_AREA = 320;

function usage(code = 1) {
  console.error(`Usage: npm run remove-bg -- <input> [output.png] [options]

Options:
  --color #rrggbb         Recolor all opaque pixels
  --remove-speckles       Drop small leftover BG bits
  --fill-holes            Fill tiny enclosed holes
  --fill-holes=all        Fill all enclosed holes (logo counters)
  --solid                 Hard mask + dilate (seal hairline gaps)
  --mode ink              Ink cutout by luminance (good for logos)
  --ink-max 96            Dark threshold for --mode ink (0-255)
  --advanced              Speckles + tiny holes
  --crop auto             Crop to content bounds
  --crop x,y,w,h          Crop rect in pixels
  --pad 0.03              Padding for --crop auto

Examples:
  npm run remove-bg -- ./photo.jpg
  npm run remove-bg -- https://example.com/car.jpg ./car.png --crop auto --advanced
  npm run remove-bg -- ./logo.jpg ./logo.png --mode ink --color #00a894 --crop auto
`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let color = null;
  let removeSpeckles = false;
  let fillHoles = false;
  let fillHolesAll = false;
  let solid = false;
  let mode = "rmbg"; // rmbg | ink
  let inkMax = 96;
  let crop = null; // 'auto' | {x,y,width,height}
  let pad = 0.03;
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
    if (a === "--remove-speckles") {
      removeSpeckles = true;
      continue;
    }
    if (a === "--fill-holes") {
      fillHoles = true;
      continue;
    }
    if (a === "--fill-holes=all" || a === "--fill-holes=All") {
      fillHoles = true;
      fillHolesAll = true;
      continue;
    }
    if (a.startsWith("--fill-holes=")) {
      fillHoles = true;
      fillHolesAll = a.slice("--fill-holes=".length).toLowerCase() === "all";
      continue;
    }
    if (a === "--solid") {
      solid = true;
      continue;
    }
    if (a === "--mode") {
      mode = String(args[++i] ?? "").toLowerCase();
      continue;
    }
    if (a.startsWith("--mode=")) {
      mode = a.slice("--mode=".length).toLowerCase();
      continue;
    }
    if (a === "--ink-max") {
      inkMax = Number(args[++i]);
      continue;
    }
    if (a.startsWith("--ink-max=")) {
      inkMax = Number(a.slice("--ink-max=".length));
      continue;
    }
    if (a === "--advanced") {
      removeSpeckles = true;
      fillHoles = true;
      continue;
    }
    if (a === "--crop") {
      const v = args[++i];
      if (!v) usage(1);
      crop = parseCrop(v);
      continue;
    }
    if (a.startsWith("--crop=")) {
      crop = parseCrop(a.slice("--crop=".length));
      continue;
    }
    if (a === "--pad") {
      pad = Number(args[++i]);
      continue;
    }
    if (a.startsWith("--pad=")) {
      pad = Number(a.slice("--pad=".length));
      continue;
    }
    if (a.startsWith("-")) {
      console.error(`Unknown option: ${a}`);
      usage(1);
    }
    positional.push(a);
  }

  if (!Number.isFinite(pad) || pad < 0 || pad > 0.5) {
    throw new Error(`Invalid --pad: ${pad}`);
  }
  if (mode !== "rmbg" && mode !== "ink") {
    throw new Error(`Invalid --mode (rmbg|ink): ${mode}`);
  }
  if (!Number.isFinite(inkMax) || inkMax < 0 || inkMax > 255) {
    throw new Error(`Invalid --ink-max: ${inkMax}`);
  }

  const input = positional[0];
  if (!input) usage(1);
  const output = positional[1] ?? defaultOutputPath(input, color);
  return {
    input,
    output,
    color,
    removeSpeckles,
    fillHoles,
    fillHolesAll,
    solid,
    mode,
    inkMax,
    crop,
    pad,
  };
}

function parseCrop(v) {
  if (v === "auto") return "auto";
  const parts = v.split(",").map((n) => Number(n.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`Invalid --crop (use auto or x,y,w,h): ${v}`);
  }
  return {
    x: parts[0],
    y: parts[1],
    width: parts[2],
    height: parts[3],
  };
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
  return RawImage.read(path.resolve(input));
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

function removeSpeckles(alpha, w, h) {
  const n = w * h;
  const solid = new Uint8Array(n);
  let solidCount = 0;
  for (let i = 0; i < n; i++) {
    if (alpha[i] >= SOLID_ALPHA) {
      solid[i] = 1;
      solidCount++;
    }
  }
  if (solidCount === 0) return;

  const labels = new Int32Array(n);
  const areas = [0];
  let nextLabel = 1;
  const stack = new Int32Array(solidCount);
  let stackLen = 0;

  for (let i = 0; i < n; i++) {
    if (!solid[i] || labels[i]) continue;
    const label = nextLabel++;
    areas[label] = 0;
    stackLen = 0;
    stack[stackLen++] = i;
    labels[i] = label;
    while (stackLen > 0) {
      const p = stack[--stackLen];
      areas[label]++;
      const x = p % w;
      const y = (p / w) | 0;
      const tryPush = (ni) => {
        if (solid[ni] && !labels[ni]) {
          labels[ni] = label;
          stack[stackLen++] = ni;
        }
      };
      if (x > 0) tryPush(p - 1);
      if (x + 1 < w) tryPush(p + 1);
      if (y > 0) tryPush(p - w);
      if (y + 1 < h) tryPush(p + w);
    }
  }

  let maxArea = 0;
  for (let L = 1; L < nextLabel; L++) {
    if (areas[L] > maxArea) maxArea = areas[L];
  }
  const minKeep = Math.max(MIN_BLOB_AREA, Math.floor(maxArea * MIN_BLOB_FRACTION));
  for (let i = 0; i < n; i++) {
    const L = labels[i];
    if (L && areas[L] < minKeep) alpha[i] = 0;
  }
}

/** Binarize soft alpha, then dilate once to seal hairline gaps (no erode). */
function solidifyMask(alpha, w, h) {
  const n = w * h;
  for (let i = 0; i < n; i++) alpha[i] = alpha[i] >= SOLID_ALPHA ? 255 : 0;

  const dilate = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let on = alpha[y * w + x] === 255 ? 1 : 0;
      if (!on) {
        for (let dy = -1; dy <= 1 && !on; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            if (alpha[ny * w + nx] === 255) {
              on = 1;
              break;
            }
          }
        }
      }
      dilate[y * w + x] = on ? 255 : 0;
    }
  }
  alpha.set(dilate);
}

function fillHoles(alpha, w, h, maxHoleArea) {
  const n = w * h;
  const empty = new Uint8Array(n);
  let emptyCount = 0;
  for (let i = 0; i < n; i++) {
    if (alpha[i] < SOLID_ALPHA) {
      empty[i] = 1;
      emptyCount++;
    }
  }
  if (emptyCount === 0) return;

  const exterior = new Uint8Array(n);
  const stack = new Int32Array(emptyCount);
  let stackLen = 0;
  const pushExterior = (i) => {
    if (empty[i] && !exterior[i]) {
      exterior[i] = 1;
      stack[stackLen++] = i;
    }
  };

  for (let x = 0; x < w; x++) {
    pushExterior(x);
    pushExterior((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    pushExterior(y * w);
    pushExterior(y * w + (w - 1));
  }

  while (stackLen > 0) {
    const p = stack[--stackLen];
    const x = p % w;
    const y = (p / w) | 0;
    if (x > 0) pushExterior(p - 1);
    if (x + 1 < w) pushExterior(p + 1);
    if (y > 0) pushExterior(p - w);
    if (y + 1 < h) pushExterior(p + w);
  }

  const labels = new Int32Array(n);
  const areas = [0];
  let nextLabel = 1;

  for (let i = 0; i < n; i++) {
    if (!empty[i] || exterior[i] || labels[i]) continue;
    const label = nextLabel++;
    areas[label] = 0;
    stackLen = 0;
    stack[stackLen++] = i;
    labels[i] = label;
    while (stackLen > 0) {
      const p = stack[--stackLen];
      areas[label]++;
      const x = p % w;
      const y = (p / w) | 0;
      const tryPush = (ni) => {
        if (empty[ni] && !exterior[ni] && !labels[ni]) {
          labels[ni] = label;
          stack[stackLen++] = ni;
        }
      };
      if (x > 0) tryPush(p - 1);
      if (x + 1 < w) tryPush(p + 1);
      if (y > 0) tryPush(p - w);
      if (y + 1 < h) tryPush(p + w);
    }
  }

  const cap = maxHoleArea ?? Infinity;
  for (let i = 0; i < n; i++) {
    const L = labels[i];
    if (L && areas[L] <= cap) alpha[i] = 255;
  }
}

function contentBounds(alpha, w, h) {
  let left = w;
  let top = h;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] < SOLID_ALPHA) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < left || bottom < top) return null;
  return { left, top, right, bottom };
}

function cropRgba(rgba, w, h, rect) {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(w, Math.ceil(rect.x + rect.width));
  const y1 = Math.min(h, Math.ceil(rect.y + rect.height));
  const cw = Math.max(1, x1 - x0);
  const ch = Math.max(1, y1 - y0);
  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = ((y0 + y) * w + (x0 + x)) * 4;
      const oi = (y * cw + x) * 4;
      out[oi] = rgba[si];
      out[oi + 1] = rgba[si + 1];
      out[oi + 2] = rgba[si + 2];
      out[oi + 3] = rgba[si + 3];
    }
  }
  return { rgba: out, width: cw, height: ch };
}

async function writePngRgba(filePath, rgba, width, height) {
  try {
    const sharp = (await import("sharp")).default;
    await mkdir(path.dirname(path.resolve(filePath)), { recursive: true });
    await sharp(Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength), {
      raw: { width, height, channels: 4 },
    })
      .png()
      .toFile(filePath);
    return;
  } catch {
    /* fall through */
  }
  const png = encodePngRgba(rgba, width, height);
  await mkdir(path.dirname(path.resolve(filePath)), { recursive: true });
  await writeFile(filePath, png);
}

function encodePngRgba(rgba, width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
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

function inkAlphaFromImage(image, inkMax) {
  const w = image.width;
  const h = image.height;
  const ch = image.channels;
  const alpha = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    const si = i * ch;
    const lum = (image.data[si] + image.data[si + 1] + image.data[si + 2]) / 3;
    alpha[i] = lum <= inkMax ? 255 : 0;
  }
  return alpha;
}

async function main() {
  const opts = parseArgs(process.argv);
  const fill = opts.color ? parseHex(opts.color) : null;

  console.error(`[remove-bg] reading ${opts.input}`);
  const image = await loadImage(opts.input);
  let w = image.width;
  let h = image.height;
  console.error(`[remove-bg] ${w}×${h}, mode=${opts.mode}`);

  let alpha;
  if (opts.mode === "ink") {
    console.error(`[remove-bg] ink threshold ≤ ${opts.inkMax}`);
    alpha = inkAlphaFromImage(image, opts.inkMax);
  } else {
    env.allowLocalModels = false;
    env.allowRemoteModels = true;
    console.error(`[remove-bg] loading model ${MODEL_ID}…`);
    const segmentator = await pipeline("image-segmentation", MODEL_ID, {
      dtype: "q8",
    });
    const outputs = await segmentator(image, {
      threshold: 0.5,
      mask_threshold: 0.5,
    });
    const mask = outputs?.[0]?.mask;
    if (!mask) throw new Error("No mask returned from model.");
    alpha =
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
  }

  if (opts.solid) {
    console.error("[remove-bg] solidify mask…");
    solidifyMask(alpha, w, h);
  }
  if (opts.removeSpeckles) {
    console.error("[remove-bg] remove speckles…");
    removeSpeckles(alpha, w, h);
  }
  if (opts.fillHoles || (opts.solid && opts.mode !== "ink")) {
    const cap =
      opts.fillHolesAll || opts.solid ? null : MAX_TINY_HOLE_AREA;
    console.error(
      `[remove-bg] fill holes (${cap == null ? "all" : "tiny"})…`,
    );
    fillHoles(alpha, w, h, cap);
  }

  let rgba = new Uint8ClampedArray(w * h * 4);
  const ch = image.channels;
  for (let i = 0; i < w * h; i++) {
    const si = i * ch;
    const oi = i * 4;
    const a = alpha[i];
    if (fill) {
      rgba[oi] = fill.r;
      rgba[oi + 1] = fill.g;
      rgba[oi + 2] = fill.b;
      rgba[oi + 3] = a;
    } else {
      rgba[oi] = image.data[si];
      rgba[oi + 1] = image.data[si + 1];
      rgba[oi + 2] = image.data[si + 2];
      rgba[oi + 3] = a;
    }
  }

  if (opts.crop) {
    let rect = opts.crop;
    if (rect === "auto") {
      const bounds = contentBounds(alpha, w, h);
      if (!bounds) throw new Error("Auto-crop found no solid content.");
      const padX = Math.round(Math.max(2, w * opts.pad));
      const padY = Math.round(Math.max(2, h * opts.pad));
      rect = {
        x: bounds.left - padX,
        y: bounds.top - padY,
        width: bounds.right - bounds.left + 1 + padX * 2,
        height: bounds.bottom - bounds.top + 1 + padY * 2,
      };
      console.error(
        `[remove-bg] crop auto → ${Math.round(rect.x)},${Math.round(rect.y)} ${Math.round(rect.width)}×${Math.round(rect.height)}`,
      );
    } else {
      console.error(
        `[remove-bg] crop ${rect.x},${rect.y} ${rect.width}×${rect.height}`,
      );
    }
    const cropped = cropRgba(rgba, w, h, rect);
    rgba = cropped.rgba;
    w = cropped.width;
    h = cropped.height;
  }

  const outPath = path.resolve(opts.output);
  await writePngRgba(outPath, rgba, w, h);
  console.error(`[remove-bg] wrote ${outPath}`);
  console.log(pathToFileURL(outPath).href);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
