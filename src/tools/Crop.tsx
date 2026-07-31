import { useEffect, useRef, useState } from "react";
import { DropZone } from "../components/DropZone";
import { ToolShell } from "../components/ToolShell";
import { useObjectUrl } from "../hooks/useObjectUrl";
import { usePasteImage } from "../hooks/usePasteImage";
import { cropImageToDataUrl, downloadDataUrl, loadImage } from "../lib/image";

type Aspect = "free" | "1:1" | "16:9" | "4:3" | "3:2" | "9:16";

type Rect = { x: number; y: number; width: number; height: number };

const ASPECTS: { id: Aspect; label: string; ratio: number | null }[] = [
  { id: "free", label: "Free", ratio: null },
  { id: "1:1", label: "1:1", ratio: 1 },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "4:3", label: "4:3", ratio: 4 / 3 },
  { id: "3:2", label: "3:2", ratio: 3 / 2 },
  { id: "9:16", label: "9:16", ratio: 9 / 16 },
];

function clampRect(r: Rect, iw: number, ih: number): Rect {
  let { x, y, width, height } = r;
  width = Math.max(8, Math.min(width, iw));
  height = Math.max(8, Math.min(height, ih));
  x = Math.max(0, Math.min(x, iw - width));
  y = Math.max(0, Math.min(y, ih - height));
  return { x, y, width, height };
}

function defaultCrop(iw: number, ih: number, ratio: number | null): Rect {
  if (!ratio) {
    const m = Math.min(iw, ih) * 0.08;
    return clampRect(
      { x: m, y: m, width: iw - m * 2, height: ih - m * 2 },
      iw,
      ih,
    );
  }
  let width = iw * 0.85;
  let height = width / ratio;
  if (height > ih * 0.85) {
    height = ih * 0.85;
    width = height * ratio;
  }
  return clampRect(
    { x: (iw - width) / 2, y: (ih - height) / 2, width, height },
    iw,
    ih,
  );
}

type DragMode =
  | "move"
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw"
  | null;

export function Crop() {
  const source = useObjectUrl();
  const [aspect, setAspect] = useState<Aspect>("free");
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [crop, setCrop] = useState<Rect | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    origin: Rect;
  } | null>(null);

  usePasteImage((file) => onFile(file));

  useEffect(() => {
    if (!source.url) {
      setNatural(null);
      setCrop(null);
      setPreview(null);
      return;
    }
    let cancelled = false;
    loadImage(source.url).then((img) => {
      if (cancelled) return;
      const ratio = ASPECTS.find((a) => a.id === aspect)?.ratio ?? null;
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
      setCrop(defaultCrop(img.naturalWidth, img.naturalHeight, ratio));
    });
    return () => {
      cancelled = true;
    };
  }, [source.url]);

  useEffect(() => {
    if (!natural || !crop) return;
    const ratio = ASPECTS.find((a) => a.id === aspect)?.ratio ?? null;
    setCrop(defaultCrop(natural.w, natural.h, ratio));
    // Only re-fit when aspect changes, not when crop moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect]);

  function onFile(file: File) {
    source.setFile(file);
    setPreview(null);
  }

  function displayScale(): number {
    const el = imgRef.current;
    if (!el || !natural) return 1;
    return el.clientWidth / natural.w;
  }

  function applyCrop() {
    if (!source.url || !crop) return;
    loadImage(source.url).then((img) => {
      const out = cropImageToDataUrl(img, crop);
      setPreview(out);
    });
  }

  function onPointerDown(
    e: React.PointerEvent,
    mode: Exclude<DragMode, null>,
  ) {
    if (!crop) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origin: { ...crop },
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || !natural || !crop) return;
    const scale = displayScale();
    const dx = (e.clientX - drag.startX) / scale;
    const dy = (e.clientY - drag.startY) / scale;
    const ratio = ASPECTS.find((a) => a.id === aspect)?.ratio ?? null;
    let next = { ...drag.origin };

    const mode = drag.mode;
    if (!mode) return;

    if (mode === "move") {
      next.x = drag.origin.x + dx;
      next.y = drag.origin.y + dy;
    } else {
      if (mode.includes("e")) next.width = drag.origin.width + dx;
      if (mode.includes("s")) next.height = drag.origin.height + dy;
      if (mode.includes("w")) {
        next.x = drag.origin.x + dx;
        next.width = drag.origin.width - dx;
      }
      if (mode.includes("n")) {
        next.y = drag.origin.y + dy;
        next.height = drag.origin.height - dy;
      }
      if (ratio) {
        if (mode === "e" || mode === "w") {
          next.height = next.width / ratio;
        } else if (mode === "n" || mode === "s") {
          next.width = next.height * ratio;
        } else {
          next.height = next.width / ratio;
        }
      }
    }

    setCrop(clampRect(next, natural.w, natural.h));
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  const scale = natural && imgRef.current ? displayScale() : 1;
  const box = crop
    ? {
        left: crop.x * scale,
        top: crop.y * scale,
        width: crop.width * scale,
        height: crop.height * scale,
      }
    : null;

  return (
    <ToolShell
      title="Crop"
      subtitle="Trim screenshots and photos. Lock an aspect ratio or crop freeform, then export."
      actions={
        <>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={!crop}
            onClick={applyCrop}
          >
            Preview
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!preview && !crop}
            onClick={() => {
              if (preview) {
                downloadDataUrl(preview, "crop.png");
                return;
              }
              if (!source.url || !crop) return;
              loadImage(source.url).then((img) => {
                downloadDataUrl(cropImageToDataUrl(img, crop), "crop.png");
              });
            }}
          >
            Download PNG
          </button>
        </>
      }
    >
      <div className="workspace">
        <aside className="workspace__side">
          <DropZone
            label="Drop a screenshot"
            hint="or any image to crop"
            onFile={onFile}
          />
          <div className="control-block">
            <p className="control-label">Aspect ratio</p>
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
          </div>
          {crop && natural && (
            <p className="fineprint">
              {Math.round(crop.width)} × {Math.round(crop.height)} px · source{" "}
              {natural.w} × {natural.h}
            </p>
          )}
          {source.error && (
            <p className="status-line status-line--error">{source.error}</p>
          )}
        </aside>

        <div className="workspace__stage">
          {!source.url && (
            <div className="stage-empty">
              Drop or paste a screenshot to start cropping.
            </div>
          )}
          {source.url && (
            <div
              className="crop-stage"
              ref={stageRef}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <img
                ref={imgRef}
                src={source.url}
                alt="Crop source"
                className="crop-stage__img"
                draggable={false}
                onLoad={() => {
                  // force re-render for scale
                  setCrop((c) => (c ? { ...c } : c));
                }}
              />
              {box && (
                <div
                  className="crop-box"
                  style={box}
                  onPointerDown={(e) => onPointerDown(e, "move")}
                >
                  {(["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const).map(
                    (h) => (
                      <span
                        key={h}
                        className={`crop-handle crop-handle--${h}`}
                        onPointerDown={(e) => onPointerDown(e, h)}
                      />
                    ),
                  )}
                </div>
              )}
            </div>
          )}
          {preview && (
            <figure className="compare__panel" style={{ marginTop: "1rem" }}>
              <figcaption>Preview</figcaption>
              <div className="compare__frame compare__frame--checker">
                <img src={preview} alt="Crop preview" />
              </div>
            </figure>
          )}
        </div>
      </div>
    </ToolShell>
  );
}
