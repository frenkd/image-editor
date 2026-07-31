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

export type OverlayLayer = {
  x: number;
  y: number;
  scale: number;
  opacity: number;
};

export function composeOverlayToDataUrl(
  base: HTMLImageElement,
  overlay: HTMLImageElement,
  layer: OverlayLayer,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = base.naturalWidth;
  canvas.height = base.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");

  ctx.drawImage(base, 0, 0);
  const ow = overlay.naturalWidth * layer.scale;
  const oh = overlay.naturalHeight * layer.scale;
  ctx.globalAlpha = Math.min(1, Math.max(0, layer.opacity));
  ctx.drawImage(overlay, layer.x, layer.y, ow, oh);
  ctx.globalAlpha = 1;

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
