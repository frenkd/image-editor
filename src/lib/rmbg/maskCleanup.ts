/**
 * Optional post-process for RMBG alpha masks:
 * - removeSpeckles: drop small opaque islands (BG trash)
 * - fillHoles: fill transparent regions enclosed by the subject
 */

export type MaskCleanupOptions = {
  removeSpeckles: boolean;
  fillHoles: boolean;
};

export const DEFAULT_MASK_CLEANUP: MaskCleanupOptions = {
  removeSpeckles: false,
  fillHoles: false,
};

/** Alpha at/above this counts as solid for connectivity. */
const SOLID_ALPHA = 56;

/** Keep blobs at least this fraction of the largest (hair / parts). */
const MIN_BLOB_FRACTION = 0.04;

const MIN_BLOB_AREA = 96;

/**
 * Max area (px) for a hole we will fill. Arm/torso gaps are far larger;
 * this only closes pinholes and tiny mask tears inside the subject.
 */
const MAX_HOLE_AREA = 320;

export function cleanupEnabled(opts: MaskCleanupOptions): boolean {
  return opts.removeSpeckles || opts.fillHoles;
}

/** Mutates `alpha` (length w*h) in place. */
export function cleanAlphaMask(
  alpha: Uint8ClampedArray | Uint8Array,
  w: number,
  h: number,
  opts: MaskCleanupOptions,
): void {
  if (!cleanupEnabled(opts)) return;
  if (opts.removeSpeckles) removeSpeckles(alpha, w, h);
  if (opts.fillHoles) fillHoles(alpha, w, h);
}

/** Load a cutout PNG, clean its alpha, return a new PNG data URL. */
export async function cleanCutoutDataUrl(
  cutoutSrc: string,
  opts: MaskCleanupOptions,
): Promise<string> {
  if (!cleanupEnabled(opts)) return cutoutSrc;

  const img = await loadImage(cutoutSrc);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) throw new Error("Cutout has zero dimensions.");

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  ctx.drawImage(img, 0, 0);
  const image = ctx.getImageData(0, 0, w, h);
  const { data } = image;

  const alpha = new Uint8ClampedArray(w * h);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3]!;

  cleanAlphaMask(alpha, w, h, opts);

  for (let i = 0; i < alpha.length; i++) data[i * 4 + 3] = alpha[i]!;
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load cutout for cleanup."));
    img.src = src;
  });
}

function removeSpeckles(
  alpha: Uint8ClampedArray | Uint8Array,
  w: number,
  h: number,
): void {
  const n = w * h;
  const solid = new Uint8Array(n);
  let solidCount = 0;
  for (let i = 0; i < n; i++) {
    if (alpha[i]! >= SOLID_ALPHA) {
      solid[i] = 1;
      solidCount++;
    }
  }
  if (solidCount === 0) return;

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

  let maxArea = 0;
  for (let L = 1; L < nextLabel; L++) {
    if (areas[L]! > maxArea) maxArea = areas[L]!;
  }
  const minKeep = Math.max(
    MIN_BLOB_AREA,
    Math.floor(maxArea * MIN_BLOB_FRACTION),
  );

  for (let i = 0; i < n; i++) {
    const L = labels[i]!;
    if (L && areas[L]! < minKeep) alpha[i] = 0;
  }
}

/**
 * Fill only tiny enclosed transparent blobs (pinholes / mask tears).
 * Larger enclosed gaps (arms akimbo, legs, handles) stay transparent.
 */
function fillHoles(
  alpha: Uint8ClampedArray | Uint8Array,
  w: number,
  h: number,
): void {
  const n = w * h;
  const empty = new Uint8Array(n);
  let emptyCount = 0;
  for (let i = 0; i < n; i++) {
    if (alpha[i]! < SOLID_ALPHA) {
      empty[i] = 1;
      emptyCount++;
    }
  }
  if (emptyCount === 0) return;

  const exterior = new Uint8Array(n);
  const stack = new Int32Array(emptyCount);
  let stackLen = 0;

  const pushExterior = (i: number) => {
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
    const p = stack[--stackLen]!;
    const x = p % w;
    const y = (p / w) | 0;
    if (x > 0) pushExterior(p - 1);
    if (x + 1 < w) pushExterior(p + 1);
    if (y > 0) pushExterior(p - w);
    if (y + 1 < h) pushExterior(p + w);
  }

  // Label each enclosed hole; only fill components ≤ MAX_HOLE_AREA.
  const labels = new Int32Array(n);
  const areas: number[] = [0];
  let nextLabel = 1;

  for (let i = 0; i < n; i++) {
    if (!empty[i] || exterior[i] || labels[i]) continue;
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

      const tryPush = (ni: number) => {
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

  for (let i = 0; i < n; i++) {
    const L = labels[i]!;
    if (L && areas[L]! <= MAX_HOLE_AREA) alpha[i] = 255;
  }
}
