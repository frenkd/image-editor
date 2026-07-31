/**
 * In-browser background removal (RMBG-1.4 via Transformers.js).
 * Adapted from sloai-org: `image-segmentation` → mask → PNG with alpha.
 */

import { ensureRmbgPipeline, type RmbgProgress } from "./rmbgModel";

export type BgRemoveProgress = RmbgProgress;

type SegmentationOutput = {
  mask?: {
    width: number;
    height: number;
    channels: number;
    data: Uint8Array | Uint8ClampedArray;
  };
};

type SegmentationPipeline = (
  image: RasterImage,
  options: { threshold: number; mask_threshold: number },
) => Promise<SegmentationOutput[]>;

type RasterImage = {
  width: number;
  height: number;
  channels: number;
  data: Uint8Array | Uint8ClampedArray;
};

function assertBrowser() {
  if (typeof window === "undefined") {
    throw new Error("Background removal is only available in the browser.");
  }
}

async function getSegmentationPipeline(
  onProgress?: (p: BgRemoveProgress) => void,
) {
  assertBrowser();
  return (await ensureRmbgPipeline(onProgress)) as SegmentationPipeline;
}

async function loadRawImage(src: string, RawImage: unknown): Promise<RasterImage> {
  const RI = RawImage as {
    fromURL: (url: string) => Promise<RasterImage>;
    new (
      data: Uint8ClampedArray,
      width: number,
      height: number,
      channels: number,
    ): RasterImage;
  };
  try {
    return await RI.fromURL(src);
  } catch {
    return rawImageFromHtmlImage(src, RI);
  }
}

function rawImageFromHtmlImage(
  src: string,
  RawImage: {
    new (
      data: Uint8ClampedArray,
      width: number,
      height: number,
      channels: number,
    ): RasterImage;
  },
): Promise<RasterImage> {
  return new Promise<RasterImage>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, w, h);
      resolve(new RawImage(data, w, h, 4));
    };
    img.onerror = () =>
      reject(new Error("Failed to load image for background removal"));
    img.src = src;
  });
}

function maskAlphaAt(
  mask: {
    width: number;
    height: number;
    channels: number;
    data: Uint8Array | Uint8ClampedArray;
  },
  x: number,
  y: number,
): number {
  const i = y * mask.width + x;
  return mask.channels === 1 ? mask.data[i]! : mask.data[i * mask.channels]!;
}

function resizeMaskAlpha(
  mask: {
    width: number;
    height: number;
    channels: number;
    data: Uint8Array | Uint8ClampedArray;
  },
  targetW: number,
  targetH: number,
): Uint8ClampedArray {
  if (mask.width === targetW && mask.height === targetH) {
    const out = new Uint8ClampedArray(targetW * targetH);
    for (let y = 0; y < targetH; y++) {
      for (let x = 0; x < targetW; x++) {
        out[y * targetW + x] = maskAlphaAt(mask, x, y);
      }
    }
    return out;
  }

  const mc = document.createElement("canvas");
  mc.width = mask.width;
  mc.height = mask.height;
  const gray = new Uint8ClampedArray(mask.width * mask.height * 4);
  for (let i = 0; i < mask.width * mask.height; i++) {
    const v = mask.channels === 1 ? mask.data[i]! : mask.data[i * mask.channels]!;
    const o = i * 4;
    gray[o] = v;
    gray[o + 1] = v;
    gray[o + 2] = v;
    gray[o + 3] = 255;
  }
  mc.getContext("2d")!.putImageData(new ImageData(gray, mask.width, mask.height), 0, 0);

  const scaled = document.createElement("canvas");
  scaled.width = targetW;
  scaled.height = targetH;
  scaled.getContext("2d")!.drawImage(mc, 0, 0, targetW, targetH);
  const pixels = scaled.getContext("2d")!.getImageData(0, 0, targetW, targetH).data;
  const alpha = new Uint8ClampedArray(targetW * targetH);
  for (let i = 0; i < alpha.length; i++) alpha[i] = pixels[i * 4]!;
  return alpha;
}

function applyMaskToPngDataUrl(
  source: {
    width: number;
    height: number;
    channels: number;
    data: Uint8Array | Uint8ClampedArray;
  },
  mask: {
    width: number;
    height: number;
    channels: number;
    data: Uint8Array | Uint8ClampedArray;
  },
): string {
  const w = source.width;
  const h = source.height;
  const alpha = resizeMaskAlpha(mask, w, h);
  const rgba = new Uint8ClampedArray(w * h * 4);
  const ch = source.channels;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const si = i * ch;
      const oi = i * 4;
      rgba[oi] = source.data[si]!;
      rgba[oi + 1] = source.data[si + 1]!;
      rgba[oi + 2] = source.data[si + 2]!;
      rgba[oi + 3] = alpha[i]!;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  ctx.putImageData(new ImageData(rgba, w, h), 0, 0);
  return canvas.toDataURL("image/png");
}

/** Remove image background; returns a PNG data URL with transparency. */
export async function removeImageBackground(
  imageSrc: string,
  onProgress?: (p: BgRemoveProgress) => void,
): Promise<string> {
  if (!imageSrc.trim()) {
    throw new Error("Upload or select a photo first.");
  }

  const segmentator = await getSegmentationPipeline(onProgress);
  if (!segmentator) {
    throw new Error("Failed to load background removal model.");
  }
  onProgress?.({ phase: "process", message: "Removing background…" });

  const { RawImage } = await import("@huggingface/transformers");
  const image = await loadRawImage(imageSrc, RawImage);

  const outputs = (await segmentator(image, {
    threshold: 0.5,
    mask_threshold: 0.5,
  })) as SegmentationOutput[];

  const seg = outputs[0];
  if (!seg?.mask) {
    throw new Error("Background removal produced no mask.");
  }

  return applyMaskToPngDataUrl(image, seg.mask);
}
