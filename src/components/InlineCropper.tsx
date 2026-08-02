import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  contentCropRect,
  fitCropToContent,
  imageDataFromElement,
} from "../lib/contentBounds";
import {
  applyCropDrag,
  defaultCrop,
  type CropHandle,
  type Rect,
} from "../lib/cropMath";
import { cropImageToDataUrl, formatImageSize, loadImage } from "../lib/image";

type Aspect = "free" | "1:1" | "16:9" | "4:3" | "3:2" | "9:16";

const ASPECTS: { id: Aspect; label: string; ratio: number | null }[] = [
  { id: "free", label: "Free", ratio: null },
  { id: "1:1", label: "1:1", ratio: 1 },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "4:3", label: "4:3", ratio: 4 / 3 },
  { id: "3:2", label: "3:2", ratio: 3 / 2 },
  { id: "9:16", label: "9:16", ratio: 9 / 16 },
];

const HANDLES: Exclude<CropHandle, "move">[] = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
];

type Props = {
  imageUrl: string;
  onApply: (croppedDataUrl: string) => void;
  onCancel: () => void;
};

export function InlineCropper({ imageUrl, onApply, onCancel }: Props) {
  const [aspect, setAspect] = useState<Aspect>("free");
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [seed, setSeed] = useState<Rect | null>(null);
  const [crop, setCrop] = useState<Rect | null>(null);
  const [scale, setScale] = useState(1);
  const imgRef = useRef<HTMLImageElement>(null);
  const cropRef = useRef<Rect | null>(null);
  const aspectRef = useRef(aspect);
  const naturalRef = useRef(natural);

  cropRef.current = crop;
  aspectRef.current = aspect;
  naturalRef.current = natural;

  useEffect(() => {
    let cancelled = false;
    setSeed(null);
    setCrop(null);
    setNatural(null);

    loadImage(imageUrl).then((img) => {
      if (cancelled) return;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      let nextSeed: Rect;
      try {
        nextSeed =
          contentCropRect(imageDataFromElement(img)) ?? defaultCrop(w, h, null);
      } catch {
        nextSeed = defaultCrop(w, h, null);
      }
      const ratio =
        ASPECTS.find((a) => a.id === aspectRef.current)?.ratio ?? null;
      setNatural({ w, h });
      setSeed(nextSeed);
      setCrop(fitCropToContent(nextSeed, w, h, ratio));
    });

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  useEffect(() => {
    if (!natural || !seed) return;
    const ratio = ASPECTS.find((a) => a.id === aspect)?.ratio ?? null;
    setCrop(fitCropToContent(seed, natural.w, natural.h, ratio));
  }, [aspect, natural, seed]);

  useLayoutEffect(() => {
    const img = imgRef.current;
    if (!img || !natural) return;
    const update = () => {
      if (!img.clientWidth) return;
      setScale(img.clientWidth / natural.w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(img);
    return () => ro.disconnect();
  }, [natural, imageUrl]);

  function beginDrag(e: React.PointerEvent, handle: CropHandle) {
    if (!cropRef.current || !naturalRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const pointerId = e.pointerId;
    const origin = { ...cropRef.current };
    const startX = e.clientX;
    const startY = e.clientY;
    const img = imgRef.current;
    const startScale =
      img && naturalRef.current
        ? img.clientWidth / naturalRef.current.w
        : scale;

    const onMove = (ev: PointerEvent) => {
      const nat = naturalRef.current;
      if (!nat || ev.pointerId !== pointerId) return;
      setCrop(
        applyCropDrag(
          origin,
          handle,
          (ev.clientX - startX) / startScale,
          (ev.clientY - startY) / startScale,
          ASPECTS.find((a) => a.id === aspectRef.current)?.ratio ?? null,
          nat.w,
          nat.h,
        ),
      );
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  const box = crop
    ? {
        left: crop.x * scale,
        top: crop.y * scale,
        width: crop.width * scale,
        height: crop.height * scale,
      }
    : null;

  return (
    <>
      <div className="studio__chrome">
        <div className="chip-row">
          {ASPECTS.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`chip ${aspect === a.id ? "is-active" : ""}`}
              onClick={() => setAspect(a.id)}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div className="inline-crop__actions">
          {crop && natural && (
            <p className="size-meta">
              {Math.round(crop.width)} × {Math.round(crop.height)}
              <span className="size-meta__muted">
                {" "}
                / {formatImageSize(natural)}
              </span>
            </p>
          )}
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary btn--small"
            disabled={!crop}
            onClick={() => {
              if (!crop) return;
              loadImage(imageUrl).then((img) => {
                onApply(cropImageToDataUrl(img, crop));
              });
            }}
          >
            Apply
          </button>
        </div>
      </div>

      <div className="studio__stage studio__stage--crop">
        <div className="crop-stage">
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Crop cutout"
            className="crop-stage__img"
            draggable={false}
          />
          {box && (
            <>
              <div className="crop-veil" aria-hidden>
                <div
                  className="crop-veil__shade crop-veil__shade--top"
                  style={{ height: Math.max(0, box.top) }}
                />
                <div className="crop-veil__mid" style={{ height: box.height }}>
                  <div
                    className="crop-veil__shade"
                    style={{ width: Math.max(0, box.left) }}
                  />
                  <div
                    className="crop-veil__window"
                    style={{ width: box.width }}
                  />
                  <div className="crop-veil__shade crop-veil__shade--flex" />
                </div>
                <div className="crop-veil__shade crop-veil__shade--flex" />
              </div>
              <div
                className="crop-frame"
                style={box}
                onPointerDown={(e) => beginDrag(e, "move")}
              >
                <div className="crop-frame__grid" aria-hidden>
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                {HANDLES.map((h) => (
                  <span
                    key={h}
                    className={`crop-handle crop-handle--${h}`}
                    onPointerDown={(e) => beginDrag(e, h)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
