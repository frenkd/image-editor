import { clampRect, type Rect } from "./cropMath";

/**
 * Rule 1 — Outliers: when finding the alpha content box, ignore up to this many
 * content pixels on each edge (row/column projection). Tiny speckles and
 * cutout artefacts outside the subject get trimmed away.
 */
export const EDGE_OUTLIER_BUDGET = 48;

/**
 * Rule 2 — Padding: expand the trimmed content box by this fraction of its
 * width/height on each side (~1.5%, between 1–2%).
 */
export const CONTENT_PADDING_RATIO = 0.015;

/** Alpha at or above this counts as opaque content. */
const CONTENT_ALPHA = 12;

/** Tight content crop from image alpha, with outlier trim + padding. */
export function contentCropRect(image: ImageData): Rect | null {
  const { width: w, height: h, data } = image;
  const colCounts = new Uint32Array(w);
  const rowCounts = new Uint32Array(h);
  let total = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3]! >= CONTENT_ALPHA) {
        colCounts[x]!++;
        rowCounts[y]!++;
        total++;
      }
    }
  }

  if (total === 0) return null;

  // Cap the budget on small cutouts so we don't chew into real content.
  const outlierBudget = Math.min(
    EDGE_OUTLIER_BUDGET,
    Math.max(8, Math.floor(total * 0.001)),
  );

  let top = 0;
  let acc = 0;
  while (top < h && acc + rowCounts[top]! <= outlierBudget) {
    acc += rowCounts[top]!;
    top++;
  }

  let bottom = h - 1;
  acc = 0;
  while (bottom >= top && acc + rowCounts[bottom]! <= outlierBudget) {
    acc += rowCounts[bottom]!;
    bottom--;
  }

  let left = 0;
  acc = 0;
  while (left < w && acc + colCounts[left]! <= outlierBudget) {
    acc += colCounts[left]!;
    left++;
  }

  let right = w - 1;
  acc = 0;
  while (right >= left && acc + colCounts[right]! <= outlierBudget) {
    acc += colCounts[right]!;
    right--;
  }

  if (right < left || bottom < top) return null;

  const boxW = right - left + 1;
  const boxH = bottom - top + 1;
  // Nearly full-frame opacity → not a useful cutout mask; let caller fall back.
  if (boxW >= w * 0.98 && boxH >= h * 0.98 && total >= w * h * 0.95) {
    return null;
  }

  const padX = Math.max(1, Math.round(boxW * CONTENT_PADDING_RATIO));
  const padY = Math.max(1, Math.round(boxH * CONTENT_PADDING_RATIO));

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

  if (width > iw) {
    width = iw;
    height = width / ratio;
  }
  if (height > ih) {
    height = ih;
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
