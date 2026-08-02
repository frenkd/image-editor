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

export function clampRect(r: Rect, iw: number, ih: number): Rect {
  let { x, y, width, height } = r;
  width = Math.max(MIN, Math.min(width, iw));
  height = Math.max(MIN, Math.min(height, ih));
  x = Math.max(0, Math.min(x, iw - width));
  y = Math.max(0, Math.min(y, ih - height));
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

  left = Math.max(0, left);
  top = Math.max(0, top);
  right = Math.min(iw, right);
  bottom = Math.min(ih, bottom);

  if (right - left < MIN) {
    if (handle.includes("w")) left = Math.max(0, right - MIN);
    else right = Math.min(iw, left + MIN);
  }
  if (bottom - top < MIN) {
    if (handle.includes("n")) top = Math.max(0, bottom - MIN);
    else bottom = Math.min(ih, top + MIN);
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
  const cx = origin.x + origin.width / 2;
  const cy = origin.y + origin.height / 2;

  // Fixed corner opposite the dragged handle.
  const fixX = handle.includes("w") ? origin.x + origin.width : origin.x;
  const fixY = handle.includes("n") ? origin.y + origin.height : origin.y;

  if (handle === "e" || handle === "w") {
    let width = handle === "e" ? origin.width + dx : origin.width - dx;
    width = Math.max(MIN, width);
    let height = width / ratio;

    if (width > iw) {
      width = iw;
      height = width / ratio;
    }
    if (height > ih) {
      height = ih;
      width = height * ratio;
    }

    let x = handle === "e" ? origin.x : origin.x + origin.width - width;
    let y = cy - height / 2;
    x = Math.max(0, Math.min(x, iw - width));
    y = Math.max(0, Math.min(y, ih - height));
    return { x, y, width, height };
  }

  if (handle === "n" || handle === "s") {
    let height = handle === "s" ? origin.height + dy : origin.height - dy;
    height = Math.max(MIN, height);
    let width = height * ratio;

    if (height > ih) {
      height = ih;
      width = height * ratio;
    }
    if (width > iw) {
      width = iw;
      height = width / ratio;
    }

    let y = handle === "s" ? origin.y : origin.y + origin.height - height;
    let x = cx - width / 2;
    x = Math.max(0, Math.min(x, iw - width));
    y = Math.max(0, Math.min(y, ih - height));
    return { x, y, width, height };
  }

  // Corners: size from pointer vs fixed corner, keep ratio pinned to that corner.
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

  const maxW = handle.includes("e") ? iw - fixX : fixX;
  const maxH = handle.includes("s") ? ih - fixY : fixY;
  const maxWidth = Math.max(MIN, Math.min(maxW, maxH * ratio));
  if (width > maxWidth) {
    width = maxWidth;
    height = width / ratio;
  }

  const x = handle.includes("w") ? fixX - width : fixX;
  const y = handle.includes("n") ? fixY - height : fixY;

  return {
    x: Math.max(0, Math.min(x, iw - width)),
    y: Math.max(0, Math.min(y, ih - height)),
    width,
    height,
  };
}
