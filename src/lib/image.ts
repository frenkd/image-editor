export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export function cropImageToDataUrl(
  image: HTMLImageElement,
  crop: { x: number; y: number; width: number; height: number },
): string {
  const canvas = document.createElement("canvas");
  const w = Math.max(1, Math.round(crop.width));
  const h = Math.max(1, Math.round(crop.height));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    w,
    h,
  );
  return canvas.toDataURL("image/png");
}

/** Parse `#rgb` / `#rrggbb` into 0–255 channels. */
export function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const raw = hex.trim().replace(/^#/, "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error("Invalid color");
  }
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/**
 * Recolor opaque pixels of a cutout PNG while keeping the alpha mask.
 * Useful for logos: knock out the background, then force black / white / any color.
 */
export async function applyColorOverlay(
  cutoutSrc: string,
  hex: string,
): Promise<string> {
  const image = await loadImage(cutoutSrc);
  const { r, g, b } = parseHexColor(hex);
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, w, h);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! === 0) continue;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas.toDataURL("image/png");
}

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "Please drop an image file.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "Image too large (max 20MB).";
  }
  return null;
}
