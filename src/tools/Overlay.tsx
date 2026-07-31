import { useEffect, useRef, useState } from "react";
import { DropZone } from "../components/DropZone";
import { ToolShell } from "../components/ToolShell";
import { useObjectUrl } from "../hooks/useObjectUrl";
import {
  composeOverlayToDataUrl,
  downloadDataUrl,
  loadImage,
  type OverlayLayer,
} from "../lib/image";

export function Overlay() {
  const base = useObjectUrl();
  const overlay = useObjectUrl();
  const [layer, setLayer] = useState<OverlayLayer>({
    x: 40,
    y: 40,
    scale: 0.4,
    opacity: 1,
  });
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [overlayNatural, setOverlayNatural] = useState<{
    w: number;
    h: number;
  } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const baseImgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    if (!base.url) {
      setNatural(null);
      return;
    }
    loadImage(base.url).then((img) =>
      setNatural({ w: img.naturalWidth, h: img.naturalHeight }),
    );
  }, [base.url]);

  useEffect(() => {
    if (!overlay.url) {
      setOverlayNatural(null);
      return;
    }
    loadImage(overlay.url).then((img) => {
      setOverlayNatural({ w: img.naturalWidth, h: img.naturalHeight });
      if (natural) {
        const fit = Math.min(
          (natural.w * 0.45) / img.naturalWidth,
          (natural.h * 0.45) / img.naturalHeight,
        );
        setLayer((l) => ({
          ...l,
          scale: Math.max(0.05, fit),
          x: natural.w * 0.1,
          y: natural.h * 0.1,
        }));
      }
    });
  }, [overlay.url, natural]);

  function displayScale(): number {
    const el = baseImgRef.current;
    if (!el || !natural) return 1;
    return el.clientWidth / natural.w;
  }

  function exportPng() {
    if (!base.url || !overlay.url) return;
    Promise.all([loadImage(base.url), loadImage(overlay.url)]).then(
      ([b, o]) => {
        downloadDataUrl(composeOverlayToDataUrl(b, o, layer), "overlay.png");
      },
    );
  }

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: layer.x,
      originY: layer.y,
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const scale = displayScale();
    setLayer((l) => ({
      ...l,
      x: drag.originX + (e.clientX - drag.startX) / scale,
      y: drag.originY + (e.clientY - drag.startY) / scale,
    }));
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  const scale = natural && baseImgRef.current ? displayScale() : 1;
  const overlayBox =
    overlayNatural && overlay.url
      ? {
          left: layer.x * scale,
          top: layer.y * scale,
          width: overlayNatural.w * layer.scale * scale,
          height: overlayNatural.h * layer.scale * scale,
          opacity: layer.opacity,
        }
      : null;

  return (
    <ToolShell
      title="Overlay"
      subtitle="Place a cutout or sticker on a base image. Drag to position, tune scale and opacity, export PNG."
      actions={
        <button
          type="button"
          className="btn btn--primary"
          disabled={!base.url || !overlay.url}
          onClick={exportPng}
        >
          Download PNG
        </button>
      }
    >
      <div className="workspace">
        <aside className="workspace__side">
          <div className="control-block">
            <p className="control-label">Base image</p>
            {base.url ? (
              <div className="thumb-row">
                <img src={base.url} alt="Base" className="thumb" />
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => base.clear()}
                >
                  Replace
                </button>
              </div>
            ) : (
              <DropZone
                compact
                label="Drop base"
                hint="background / screenshot"
                onFile={(f) => base.setFile(f)}
              />
            )}
          </div>

          <div className="control-block">
            <p className="control-label">Overlay</p>
            {overlay.url ? (
              <div className="thumb-row">
                <img
                  src={overlay.url}
                  alt="Overlay"
                  className="thumb thumb--checker"
                />
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => overlay.clear()}
                >
                  Replace
                </button>
              </div>
            ) : (
              <DropZone
                compact
                label="Drop overlay"
                hint="cutout / sticker PNG"
                onFile={(f) => overlay.setFile(f)}
              />
            )}
          </div>

          <div className="control-block">
            <label className="control-label" htmlFor="scale">
              Scale · {Math.round(layer.scale * 100)}%
            </label>
            <input
              id="scale"
              type="range"
              min={0.05}
              max={2}
              step={0.01}
              value={layer.scale}
              disabled={!overlay.url}
              onChange={(e) =>
                setLayer((l) => ({ ...l, scale: Number(e.target.value) }))
              }
            />
          </div>

          <div className="control-block">
            <label className="control-label" htmlFor="opacity">
              Opacity · {Math.round(layer.opacity * 100)}%
            </label>
            <input
              id="opacity"
              type="range"
              min={0.05}
              max={1}
              step={0.01}
              value={layer.opacity}
              disabled={!overlay.url}
              onChange={(e) =>
                setLayer((l) => ({ ...l, opacity: Number(e.target.value) }))
              }
            />
          </div>

          <p className="fineprint">
            Tip: remove a background first, download the cutout, then overlay it
            here.
          </p>
          {(base.error || overlay.error) && (
            <p className="status-line status-line--error">
              {base.error || overlay.error}
            </p>
          )}
        </aside>

        <div className="workspace__stage">
          {!base.url && (
            <div className="stage-empty">
              Add a base image to start composing.
            </div>
          )}
          {base.url && (
            <div
              className="overlay-stage"
              ref={stageRef}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <img
                ref={baseImgRef}
                src={base.url}
                alt="Base"
                className="overlay-stage__base"
                draggable={false}
                onLoad={() => setLayer((l) => ({ ...l }))}
              />
              {overlay.url && overlayBox && (
                <img
                  src={overlay.url}
                  alt="Overlay layer"
                  className="overlay-stage__layer"
                  style={overlayBox}
                  draggable={false}
                  onPointerDown={onPointerDown}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </ToolShell>
  );
}
