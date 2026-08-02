import { useEffect, useRef, useState, useTransition } from "react";
import { DropZone } from "../components/DropZone";
import { Seo } from "../components/Seo";
import { ToolShell } from "../components/ToolShell";
import { usePasteImage } from "../hooks/usePasteImage";
import { useRmbgHistory } from "../hooks/useRmbgHistory";
import { applyColorOverlay, downloadDataUrl, validateImageFile } from "../lib/image";
import { RMBG_HISTORY_MAX, type ColorMode } from "../lib/rmbgHistory";
import type { BgRemoveProgress } from "../lib/rmbg/removeBackground";
import {
  removeBgFaqJsonLd,
  removeBgSeo,
  softwareAppJsonLd,
} from "../lib/seo";

type Status = "idle" | "processing" | "ready" | "error";

const COLOR_PRESETS: {
  id: Exclude<ColorMode, "custom">;
  label: string;
}[] = [
  { id: "original", label: "Original" },
  { id: "black", label: "Black" },
  { id: "white", label: "White" },
];

function progressLabel(p: BgRemoveProgress | null): string {
  if (!p) return "Processing…";
  if (p.phase === "download") {
    return typeof p.percent === "number"
      ? `${p.message} (${Math.round(p.percent)}%)`
      : p.message;
  }
  return p.message;
}

export function RemoveBg() {
  const history = useRmbgHistory();
  const [pendingSourceUrl, setPendingSourceUrl] = useState<string | null>(null);
  const pendingObjectUrlRef = useRef<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<BgRemoveProgress | null>(null);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const runIdRef = useRef(0);

  const active = history.active;
  const colorMode = active?.colorMode ?? "original";
  const customColor = active?.customColor ?? "#00a894";
  const sourceUrl = pendingSourceUrl ?? active?.sourceUrl ?? null;
  const cutoutUrl = pendingSourceUrl ? null : (active?.cutoutUrl ?? null);

  usePasteImage({
    onFile: (file) => void ingestFile(file),
    onSrc: (src) => void ingestSrc(src),
    onError: (message) => {
      setError(message);
      setStatus("error");
    },
  });

  useEffect(() => {
    return () => {
      if (pendingObjectUrlRef.current) {
        URL.revokeObjectURL(pendingObjectUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!cutoutUrl) {
      setDisplayUrl(null);
      return;
    }
    if (colorMode === "original") {
      setDisplayUrl(cutoutUrl);
      return;
    }
    const hex =
      colorMode === "black"
        ? "#000000"
        : colorMode === "white"
          ? "#ffffff"
          : customColor;
    let cancelled = false;
    applyColorOverlay(cutoutUrl, hex)
      .then((out) => {
        if (!cancelled) setDisplayUrl(out);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Color overlay failed");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [cutoutUrl, colorMode, customColor]);

  function clearPendingSource() {
    if (pendingObjectUrlRef.current) {
      URL.revokeObjectURL(pendingObjectUrlRef.current);
      pendingObjectUrlRef.current = null;
    }
    setPendingSourceUrl(null);
  }

  function run(
    src: string,
    mode: "create" | "replace",
  ) {
    const runId = ++runIdRef.current;
    setStatus("processing");
    setError(null);
    setProgress(null);
    setDisplayUrl(null);

    startTransition(async () => {
      try {
        const { removeImageBackground } = await import(
          "../lib/rmbg/removeBackground"
        );
        const out = await removeImageBackground(src, (p) => {
          if (runId === runIdRef.current) setProgress(p);
        });
        if (runId !== runIdRef.current) return;

        if (mode === "replace" && history.activeId) {
          await history.replaceActiveCutout(out);
        } else {
          await history.addEntry({
            sourceSrc: src,
            cutoutSrc: out,
            colorMode: "original",
            customColor: "#00a894",
          });
        }
        clearPendingSource();
        setStatus("ready");
        setProgress(null);
      } catch (err) {
        if (runId !== runIdRef.current) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Removal failed");
        setProgress(null);
      }
    });
  }

  async function ingestFile(file: File) {
    const validation = validateImageFile(file);
    if (validation) {
      setError(validation);
      setStatus("error");
      return;
    }
    clearPendingSource();
    const url = URL.createObjectURL(file);
    pendingObjectUrlRef.current = url;
    setPendingSourceUrl(url);
    run(url, "create");
  }

  async function ingestSrc(src: string) {
    clearPendingSource();
    setPendingSourceUrl(src);
    run(src, "create");
  }

  function onSelect(id: string) {
    if (status === "processing") return;
    clearPendingSource();
    history.select(id);
    setStatus("ready");
    setError(null);
  }

  const busy = status === "processing" || isPending;
  const downloadUrl = displayUrl ?? cutoutUrl;

  return (
    <ToolShell
      title="Remove image background"
      subtitle="Free local AI background remover. Cut out photos, logos, and people in your browser, then recolor the cutout. History stays on this device across refresh."
      actions={
        <button
          type="button"
          className="btn btn--primary"
          disabled={!downloadUrl}
          onClick={() =>
            downloadUrl && downloadDataUrl(downloadUrl, "cutout.png")
          }
        >
          Download PNG
        </button>
      }
    >
      <Seo
        page={removeBgSeo}
        jsonLd={[softwareAppJsonLd(removeBgSeo), removeBgFaqJsonLd()]}
      />
      <div className="workspace">
        <aside className="workspace__side">
          <DropZone
            label="Drop a photo"
            hint="or Ctrl/Cmd+V an image or image link"
            onFile={(file) => void ingestFile(file)}
          />

          <div className="control-block">
            <div className="history-head">
              <p className="control-label">History</p>
              <span className="history-count">
                {history.entries.length}/{RMBG_HISTORY_MAX}
              </span>
            </div>
            {!history.hydrated && (
              <p className="fineprint">Loading saved cutouts…</p>
            )}
            {history.hydrated && history.entries.length === 0 && (
              <p className="fineprint">
                Pasted and processed images show up here (kept locally).
              </p>
            )}
            {history.entries.length > 0 && (
              <ul className="history-list">
                {history.entries.map((entry, index) => {
                  const selected =
                    !pendingSourceUrl && entry.id === history.activeId;
                  return (
                    <li key={entry.id}>
                      <button
                        type="button"
                        className={`history-item ${selected ? "is-active" : ""}`}
                        disabled={busy}
                        onClick={() => onSelect(entry.id)}
                      >
                        <img
                          src={entry.cutoutUrl}
                          alt=""
                          className="history-item__thumb history-item__thumb--checker"
                        />
                        <span className="history-item__meta">
                          <span className="history-item__title">
                            Cutout {history.entries.length - index}
                          </span>
                          <span className="history-item__time">
                            {new Date(entry.createdAt).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="history-item__remove"
                        aria-label="Remove from history"
                        disabled={busy}
                        onClick={() => void history.remove(entry.id)}
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {sourceUrl && (
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy || !sourceUrl}
              onClick={() => {
                if (!sourceUrl) return;
                if (pendingSourceUrl) run(sourceUrl, "create");
                else run(sourceUrl, "replace");
              }}
            >
              {busy ? "Working…" : "Run again"}
            </button>
          )}

          <div className="control-block">
            <p className="control-label">Color overlay</p>
            <div className="chip-row">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`chip ${colorMode === preset.id ? "is-active" : ""}`}
                  disabled={!cutoutUrl || busy}
                  onClick={() =>
                    history.setActiveColors(preset.id, customColor)
                  }
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                className={`chip ${colorMode === "custom" ? "is-active" : ""}`}
                disabled={!cutoutUrl || busy}
                onClick={() => history.setActiveColors("custom", customColor)}
              >
                Custom
              </button>
            </div>
            <label className="color-picker-row">
              <input
                type="color"
                value={customColor}
                disabled={!cutoutUrl || busy}
                onChange={(e) =>
                  history.setActiveColors("custom", e.target.value)
                }
              />
              <span>{customColor}</span>
            </label>
            <p className="fineprint">
              Recolors the cutout silhouette. Alpha stays; RGB becomes the fill.
            </p>
          </div>

          {busy && (
            <p className="status-line" role="status">
              {progressLabel(progress)}
            </p>
          )}
          {error && (
            <p className="status-line status-line--error" role="alert">
              {error}
            </p>
          )}
          <p className="fineprint">
            Model: <code>briaai/RMBG-1.4</code>. History is stored in this
            browser only (IndexedDB).
          </p>
        </aside>

        <div className="workspace__stage">
          {!sourceUrl && !cutoutUrl && (
            <div className="stage-empty">
              Drop, paste an image, or paste an image link to knock out the
              background.
            </div>
          )}
          {(sourceUrl || cutoutUrl) && (
            <div className="compare">
              {sourceUrl && (
                <figure className="compare__panel">
                  <figcaption>Original</figcaption>
                  <div className="compare__frame">
                    <img src={sourceUrl} alt="Original upload" />
                  </div>
                </figure>
              )}
              <figure className="compare__panel">
                <figcaption>
                  Cutout
                  {cutoutUrl && colorMode !== "original" ? " · recolored" : ""}
                </figcaption>
                <div className="compare__frame compare__frame--checker">
                  {displayUrl ? (
                    <img src={displayUrl} alt="Background removed" />
                  ) : (
                    <div className="stage-empty stage-empty--inset">
                      {busy ? progressLabel(progress) : "Result appears here"}
                    </div>
                  )}
                </div>
              </figure>
            </div>
          )}
        </div>
      </div>

      <section className="seo-panel" aria-labelledby="rmbg-faq-heading">
        <h2 id="rmbg-faq-heading">Free background remover FAQ</h2>
        <dl className="faq-list">
          <div>
            <dt>Is this background remover free?</dt>
            <dd>
              Yes. Remove image background for free with this open-source tool.
              No account and no paid tier for the core cutout flow.
            </dd>
          </div>
          <div>
            <dt>Do my images get uploaded?</dt>
            <dd>
              No. The AI model runs locally in your browser. Your photos stay on
              your device; recent cutouts are saved in IndexedDB for history.
            </dd>
          </div>
          <div>
            <dt>How do I remove a logo or photo background?</dt>
            <dd>
              Drop or paste an image (Ctrl/Cmd+V works for screenshots and image
              links), wait for the cutout, optionally recolor it black or white,
              then download a transparent PNG.
            </dd>
          </div>
          <div>
            <dt>What model removes the background?</dt>
            <dd>
              <code>briaai/RMBG-1.4</code> via Transformers.js. The first run
              downloads the model from Hugging Face; afterward it is cached.
            </dd>
          </div>
        </dl>
      </section>
    </ToolShell>
  );
}
