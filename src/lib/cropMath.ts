export type Rect = { x: number; y: number; width: number; height: number };

export type CropHandle =
  | "move"
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw";

const MIN = 16;

/**
 * Crop may overhang each image edge by at most this fraction of the image.
 * (Breathing room only - not a way to blow up the canvas.)
 */
export const CROP_OVERSCAN = 0.03;

function overscan(iw: number, ih: number) {
  return { padX: iw * CROP_OVERSCAN, padY: ih * CROP_OVERSCAN };
}

export function clampRect(r: Rect, iw: number, ih: number): Rect {
  const { padX, padY } = overscan(iw, ih);
  const maxW = iw + 2 * padX;
  const maxH = ih + 2 * padY;
  let { x, y, width, height } = r;
  width = Math.max(MIN, Math.min(width, maxW));
  height = Math.max(MIN, Math.min(height, maxH));
  x = Math.max(-padX, Math.min(x, iw + padX - width));
  y = Math.max(-padY, Math.min(y, ih + padY - height));
  return { x, y, width, height };
}

/** Fallback crop when no alpha content is found (optionally aspect-locked). */
export function defaultCrop(iw: number, ih: number, ratio: number | null): Rect {
  if (!ratio) {
    const m = Math.min(iw, ih) * 0.08;
    return clampRect(
      { x: m, y: m, width: iw - m * 2, height: ih - m * 2 },
      iw,
      ih,
    );
  }

  let width = iw * 0.86;
  let height = width / ratio;
  if (height > ih * 0.86) {
    height = ih * 0.86;
    width = height * ratio;
  }
  return clampRect(
    {
      x: (iw - width) / 2,
      y: (ih - height) / 2,
      width,
      height,
    },
    iw,
    ih,
  );
}

/** Apply a drag delta to a crop rect, optionally locking aspect ratio. */
export function applyCropDrag(
  origin: Rect,
  handle: CropHandle,
  dx: number,
  dy: number,
  ratio: number | null,
  iw: number,
  ih: number,
): Rect {
  if (handle === "move") {
    return clampRect(
      {
        x: origin.x + dx,
        y: origin.y + dy,
        width: origin.width,
        height: origin.height,
      },
      iw,
      ih,
    );
  }

  if (!ratio) {
    return resizeFree(origin, handle, dx, dy, iw, ih);
  }

  return resizeLocked(origin, handle, dx, dy, ratio, iw, ih);
}

function resizeFree(
  origin: Rect,
  handle: Exclude<CropHandle, "move">,
  dx: number,
  dy: number,
  iw: number,
  ih: number,
): Rect {
  const { padX, padY } = overscan(iw, ih);
  let left = origin.x;
  let top = origin.y;
  let right = origin.x + origin.width;
  let bottom = origin.y + origin.height;

  if (handle.includes("e")) right = origin.x + origin.width + dx;
  if (handle.includes("w")) left = origin.x + dx;
  if (handle.includes("s")) bottom = origin.y + origin.height + dy;
  if (handle.includes("n")) top = origin.y + dy;

  if (right - left < MIN) {
    if (handle.includes("w")) left = right - MIN;
    else right = left + MIN;
  }
  if (bottom - top < MIN) {
    if (handle.includes("n")) top = bottom - MIN;
    else bottom = top + MIN;
  }

  left = Math.max(-padX, left);
  top = Math.max(-padY, top);
  right = Math.min(iw + padX, right);
  bottom = Math.min(ih + padY, bottom);

  if (right - left < MIN) {
    if (handle.includes("w")) left = Math.max(-padX, right - MIN);
    else right = Math.min(iw + padX, left + MIN);
  }
  if (bottom - top < MIN) {
    if (handle.includes("n")) top = Math.max(-padY, bottom - MIN);
    else bottom = Math.min(ih + padY, top + MIN);
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function resizeLocked(
  origin: Rect,
  handle: Exclude<CropHandle, "move">,
  dx: number,
  dy: number,
  ratio: number,
  iw: number,
  ih: number,
): Rect {
  const { padX, padY } = overscan(iw, ih);
  const maxW = iw + 2 * padX;
  const maxH = ih + 2 * padY;
  const cx = origin.x + origin.width / 2;
  const cy = origin.y + origin.height / 2;

  const fixX = handle.includes("w") ? origin.x + origin.width : origin.x;
  const fixY = handle.includes("n") ? origin.y + origin.height : origin.y;

  if (handle === "e" || handle === "w") {
    let width = handle === "e" ? origin.width + dx : origin.width - dx;
    width = Math.max(MIN, Math.min(width, maxW));
    let height = width / ratio;
    if (height > maxH) {
      height = maxH;
      width = height * ratio;
    }

    let x = handle === "e" ? origin.x : origin.x + origin.width - width;
    let y = cy - height / 2;
    return clampRect({ x, y, width, height }, iw, ih);
  }

  if (handle === "n" || handle === "s") {
    let height = handle === "s" ? origin.height + dy : origin.height - dy;
    height = Math.max(MIN, Math.min(height, maxH));
    let width = height * ratio;
    if (width > maxW) {
      width = maxW;
      height = width / ratio;
    }

    let y = handle === "s" ? origin.y : origin.y + origin.height - height;
    let x = cx - width / 2;
    return clampRect({ x, y, width, height }, iw, ih);
  }

  const pointerX =
    (handle.includes("e") ? origin.x + origin.width : origin.x) + dx;
  const pointerY =
    (handle.includes("s") ? origin.y + origin.height : origin.y) + dy;

  let width = Math.abs(pointerX - fixX);
  let height = Math.abs(pointerY - fixY);

  if (width / ratio > height) {
    height = width / ratio;
  } else {
    width = height * ratio;
  }

  width = Math.max(MIN, width);
  height = width / ratio;

  const maxWidthFromFix = handle.includes("e")
    ? iw + padX - fixX
    : fixX - -padX;
  const maxHeightFromFix = handle.includes("s")
    ? ih + padY - fixY
    : fixY - -padY;
  const maxWidth = Math.max(
    MIN,
    Math.min(maxWidthFromFix, maxHeightFromFix * ratio, maxW),
  );
  if (width > maxWidth) {
    width = maxWidth;
    height = width / ratio;
  }

  const x = handle.includes("w") ? fixX - width : fixX;
  const y = handle.includes("n") ? fixY - height : fixY;

  return clampRect({ x, y, width, height }, iw, ih);
}
