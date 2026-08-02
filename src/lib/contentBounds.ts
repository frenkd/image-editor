import { clampRect, CROP_OVERSCAN, type Rect } from "./cropMath";

/**
 * Rule 1 — Solid content only: alpha below this is empty.
 * Kills soft RMBG ghosts, faint UI chrome, and nearly-transparent speckles.
 */
export const CONTENT_ALPHA = 56;

/**
 * Rule 1b — Blob filter: keep the largest solid connected component, plus any
 * other blobs that are at least this fraction of the largest (usually hair/parts
 * of the same subject). Tiny remote artefacts are dropped.
 */
export const MIN_BLOB_FRACTION = 0.04;

/**
 * Rule 2 — Padding: expand the content box by this fraction of the *original*
 * image size on each side (a little breathing room, not pixel-tight).
 * Hard-capped by CROP_OVERSCAN (~3%) in cropMath.
 */
export const CONTENT_PAD_OF_IMAGE = 0.03;

const MIN_BLOB_AREA = 96;

/** Tight content crop from image alpha, with blob filter + padded overscan. */
export function contentCropRect(image: ImageData): Rect | null {
  const { width: w, height: h, data } = image;
  const bounds = solidBlobBounds(data, w, h);
  if (!bounds) return null;

  const { left, top, right, bottom } = bounds;
  const boxW = right - left + 1;
  const boxH = bottom - top + 1;

  // Nearly full-frame solid → not a useful cutout mask.
  if (boxW >= w * 0.98 && boxH >= h * 0.98) return null;

  const padX = Math.round(
    Math.min(w * CROP_OVERSCAN, Math.max(2, w * CONTENT_PAD_OF_IMAGE)),
  );
  const padY = Math.round(
    Math.min(h * CROP_OVERSCAN, Math.max(2, h * CONTENT_PAD_OF_IMAGE)),
  );

  // Intentionally may extend past the image; clampRect allows ≤5% overscan.
  return clampRect(
    {
      x: left - padX,
      y: top - padY,
      width: boxW + padX * 2,
      height: boxH + padY * 2,
    },
    w,
    h,
  );
}

type Bounds = { left: number; top: number; right: number; bottom: number };

/** Bounding box of the main solid alpha blob(s), ignoring tiny outliers. */
function solidBlobBounds(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): Bounds | null {
  const n = w * h;
  const solid = new Uint8Array(n);
  let solidCount = 0;
  for (let i = 0; i < n; i++) {
    if (data[i * 4 + 3]! >= CONTENT_ALPHA) {
      solid[i] = 1;
      solidCount++;
    }
  }
  if (solidCount === 0) return null;

  const labels = new Int32Array(n);
  const areas: number[] = [0];
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
      const p = stack[--stackLen]!;
      areas[label]!++;
      const x = p % w;
      const y = (p / w) | 0;

      // 4-connected — enough for cutout subjects, cheaper than 8.
      if (x > 0) {
        const ni = p - 1;
        if (solid[ni] && !labels[ni]) {
          labels[ni] = label;
          stack[stackLen++] = ni;
        }
      }
      if (x + 1 < w) {
        const ni = p + 1;
        if (solid[ni] && !labels[ni]) {
          labels[ni] = label;
          stack[stackLen++] = ni;
        }
      }
      if (y > 0) {
        const ni = p - w;
        if (solid[ni] && !labels[ni]) {
          labels[ni] = label;
          stack[stackLen++] = ni;
        }
      }
      if (y + 1 < h) {
        const ni = p + w;
        if (solid[ni] && !labels[ni]) {
          labels[ni] = label;
          stack[stackLen++] = ni;
        }
      }
    }
  }

  if (nextLabel === 1) return null;

  let maxArea = 0;
  for (let L = 1; L < nextLabel; L++) {
    if (areas[L]! > maxArea) maxArea = areas[L]!;
  }
  const minKeep = Math.max(
    MIN_BLOB_AREA,
    Math.floor(maxArea * MIN_BLOB_FRACTION),
  );

  let left = w;
  let right = -1;
  let top = h;
  let bottom = -1;
  for (let i = 0; i < n; i++) {
    const L = labels[i]!;
    if (!L || areas[L]! < minKeep) continue;
    const x = i % w;
    const y = (i / w) | 0;
    if (x < left) left = x;
    if (x > right) right = x;
    if (y < top) top = y;
    if (y > bottom) bottom = y;
  }

  if (right < left || bottom < top) return null;
  return { left, top, right, bottom };
}

/** Grow/shrink a content rect to an aspect ratio, centered on the content. */
export function fitCropToContent(
  content: Rect,
  iw: number,
  ih: number,
  ratio: number | null,
): Rect {
  if (!ratio) return clampRect(content, iw, ih);

  const cx = content.x + content.width / 2;
  const cy = content.y + content.height / 2;
  let width = content.width;
  let height = content.height;

  if (width / height > ratio) {
    height = width / ratio;
  } else {
    width = height * ratio;
  }

  const maxW = iw * (1 + 2 * CROP_OVERSCAN);
  const maxH = ih * (1 + 2 * CROP_OVERSCAN);
  if (width > maxW) {
    width = maxW;
    height = width / ratio;
  }
  if (height > maxH) {
    height = maxH;
    width = height * ratio;
  }

  return clampRect(
    {
      x: cx - width / 2,
      y: cy - height / 2,
      width,
      height,
    },
    iw,
    ih,
  );
}

export function imageDataFromElement(img: HTMLImageElement): ImageData {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D unavailable");
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, w, h);
}
