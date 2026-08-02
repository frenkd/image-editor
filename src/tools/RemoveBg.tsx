import { useEffect, useRef, useState, useTransition } from "react";
import { DropZone } from "../components/DropZone";
import { InlineCropper } from "../components/InlineCropper";
import { Seo } from "../components/Seo";
import { usePasteImage } from "../hooks/usePasteImage";
import { useRmbgHistory } from "../hooks/useRmbgHistory";
import { applyColorOverlay, downloadDataUrl, validateImageFile } from "../lib/image";
import { RMBG_HISTORY_MAX, type ColorMode } from "../lib/rmbgHistory";
import type { BgRemoveProgress } from "../lib/rmbg/removeBackground";
import {
  homeSeo,
  removeBgFaqJsonLd,
  softwareAppJsonLd,
  webAppJsonLd,
} from "../lib/seo";

type Status = "idle" | "processing" | "ready" | "error";
type ViewMode = "result" | "compare";
type StudioMode = "view" | "crop";

const COLOR_PRESETS: {
  id: Exclude<ColorMode, "custom">;
  label: string;
}[] = [
  { id: "original", label: "None" },
  { id: "black", label: "Black" },
  { id: "white", label: "White" },
];

function progressLabel(p: BgRemoveProgress | null): string {
  if (!p) return "Working…";
  if (p.phase === "download") {
    return typeof p.percent === "number"
      ? `Downloading model ${Math.round(p.percent)}%`
      : "Downloading model…";
  }
  return "Removing…";
}

export function RemoveBg() {
  const history = useRmbgHistory();
  const [pendingSourceUrl, setPendingSourceUrl] = useState<string | null>(null);
  const pendingObjectUrlRef = useRef<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<BgRemoveProgress | null>(null);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [colorPanelOpen, setColorPanelOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("result");
  const [studioMode, setStudioMode] = useState<StudioMode>("view");
  const [isPending, startTransition] = useTransition();
  const runIdRef = useRef(0);

  const active = history.active;
  const colorMode = active?.colorMode ?? "original";
  const customColor = active?.customColor ?? "#00a894";
  const sourceUrl = pendingSourceUrl ?? active?.sourceUrl ?? null;
  const cutoutUrl = pendingSourceUrl ? null : (active?.cutoutUrl ?? null);
  const colorActive = colorMode !== "original";
  const ready = Boolean(cutoutUrl) && !pendingSourceUrl;
  const busy = status === "processing" || isPending;
  const downloadUrl = displayUrl ?? cutoutUrl;
  const empty = !sourceUrl && !cutoutUrl && !busy;

  usePasteImage({
    onFile: (file) => {
      if (studioMode === "crop" || busy) return;
      void ingestFile(file);
    },
    onSrc: (src) => {
      if (studioMode === "crop" || busy) return;
      void ingestSrc(src);
    },
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

  function run(src: string, mode: "create" | "replace") {
    const runId = ++runIdRef.current;
    setStatus("processing");
    setError(null);
    setProgress(null);
    setDisplayUrl(null);
    setColorPanelOpen(false);
    setStudioMode("view");
    setViewMode("result");

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
          await history.replaceActiveCutout(out, {
            colorMode: "original",
            customColor: "#00a894",
          });
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
    if (busy || studioMode === "crop") return;
    clearPendingSource();
    history.select(id);
    setStatus("ready");
    setError(null);
    setColorPanelOpen(false);
    setStudioMode("view");
    setViewMode("result");
  }

  async function applyCrop(cropped: string) {
    await history.replaceActiveCutout(cropped, {
      colorMode: "original",
      customColor,
    });
    setStudioMode("view");
    setViewMode("result");
    setColorPanelOpen(false);
  }

  return (
    <div className="studio">
      <Seo
        page={homeSeo}
        jsonLd={[webAppJsonLd(), softwareAppJsonLd(homeSeo), removeBgFaqJsonLd()]}
      />

      <header className="studio__header">
        <h1 className="studio__title">Remove background</h1>
        {ready && downloadUrl && studioMode === "view" && (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => downloadDataUrl(downloadUrl, "cutout.png")}
          >
            Download
          </button>
        )}
      </header>

      {empty && (
        <div className="studio__hero">
          <DropZone
            hero
            label="Drop or paste an image"
            onFile={(file) => void ingestFile(file)}
          />
          <p className="studio__privacy">
            100% privacy · images stay on your device
          </p>
          {error && (
            <p className="status-line status-line--error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}

      {!empty && (
        <div className="studio__layout">
          <aside className="studio__rail">
            <DropZone
              compact
              label="New"
              hint="drop / paste"
              onFile={(file) => void ingestFile(file)}
            />

            {history.entries.length > 0 && (
              <div className="control-block">
                <button
                  type="button"
                  className={`btn btn--ghost btn--small color-overlay-toggle ${historyOpen ? "is-active" : ""}`}
                  aria-expanded={historyOpen}
                  onClick={() => setHistoryOpen((o) => !o)}
                >
                  <span aria-hidden>{historyOpen ? "▾" : "▸"}</span>
                  Recent ({history.entries.length}/{RMBG_HISTORY_MAX})
                </button>
                {historyOpen && (
                  <ul className="history-list">
                    {history.entries.map((entry) => {
                      const selected =
                        !pendingSourceUrl && entry.id === history.activeId;
                      return (
                        <li key={entry.id}>
                          <button
                            type="button"
                            className={`history-item ${selected ? "is-active" : ""}`}
                            disabled={busy || studioMode === "crop"}
                            onClick={() => onSelect(entry.id)}
                          >
                            <img
                              src={entry.cutoutUrl}
                              alt=""
                              className="history-item__thumb history-item__thumb--checker"
                            />
                            <span className="history-item__meta">
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
                            aria-label="Remove"
                            disabled={busy || studioMode === "crop"}
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
            )}

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
          </aside>

          <div className="studio__main">
            {ready && studioMode === "view" && (
              <div className="studio__toolbar">
                <div className="chip-row" role="group" aria-label="View">
                  <button
                    type="button"
                    className={`chip ${viewMode === "result" ? "is-active" : ""}`}
                    onClick={() => setViewMode("result")}
                  >
                    Result
                  </button>
                  <button
                    type="button"
                    className={`chip ${viewMode === "compare" ? "is-active" : ""}`}
                    onClick={() => setViewMode("compare")}
                  >
                    Compare
                  </button>
                </div>

                <div className="studio__toolbar-tools">
                  <button
                    type="button"
                    className={`btn btn--ghost btn--small ${colorPanelOpen || colorActive ? "is-active-tool" : ""}`}
                    aria-expanded={colorPanelOpen}
                    onClick={() => setColorPanelOpen((o) => !o)}
                  >
                    Color{colorActive ? " · on" : ""}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    disabled={!downloadUrl}
                    onClick={() => {
                      setColorPanelOpen(false);
                      setStudioMode("crop");
                    }}
                  >
                    Crop
                  </button>
                </div>
              </div>
            )}

            {ready && studioMode === "view" && colorPanelOpen && (
              <div className="color-overlay-panel studio__color-panel">
                <div className="chip-row">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`chip ${colorMode === preset.id ? "is-active" : ""}`}
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
                    onClick={() =>
                      history.setActiveColors("custom", customColor)
                    }
                  >
                    Custom
                  </button>
                </div>
                {colorMode === "custom" && (
                  <label className="color-picker-row">
                    <input
                      type="color"
                      value={customColor}
                      onChange={(e) =>
                        history.setActiveColors("custom", e.target.value)
                      }
                    />
                    <span>{customColor}</span>
                  </label>
                )}
              </div>
            )}

            {studioMode === "crop" && downloadUrl ? (
              <InlineCropper
                imageUrl={downloadUrl}
                onCancel={() => setStudioMode("view")}
                onApply={(cropped) => void applyCrop(cropped)}
              />
            ) : (
              <div className="studio__stage">
                {busy && !displayUrl && (
                  <div className="stage-empty">
                    <p>{progressLabel(progress)}</p>
                    {sourceUrl && (
                      <img
                        src={sourceUrl}
                        alt=""
                        className="studio__processing-thumb"
                      />
                    )}
                  </div>
                )}

                {!busy && viewMode === "compare" && sourceUrl && (
                  <div className="compare">
                    <figure className="compare__panel">
                      <figcaption>Before</figcaption>
                      <div className="compare__frame">
                        <img src={sourceUrl} alt="Original" />
                      </div>
                    </figure>
                    <figure className="compare__panel">
                      <figcaption>After</figcaption>
                      <div className="compare__frame compare__frame--checker">
                        {displayUrl ? (
                          <img src={displayUrl} alt="Background removed" />
                        ) : (
                          <div className="stage-empty stage-empty--inset">…</div>
                        )}
                      </div>
                    </figure>
                  </div>
                )}

                {!busy && viewMode === "result" && (
                  <div className="studio__result">
                    {displayUrl ? (
                      <div className="studio__result-frame compare__frame--checker">
                        <img src={displayUrl} alt="Background removed" />
                      </div>
                    ) : sourceUrl ? (
                      <div className="compare__frame">
                        <img src={sourceUrl} alt="Original" />
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="studio__footer">
        <span>100% privacy · local only</span>
        <span aria-hidden>·</span>
        <span>
          Made by{" "}
          <a href="https://github.com/frenkd" target="_blank" rel="noreferrer">
            frenkd
          </a>
        </span>
        <span aria-hidden>·</span>
        <a
          href="https://github.com/frenkd/image-editor"
          target="_blank"
          rel="noreferrer"
        >
          Source
        </a>
      </footer>

      {/* Collapsed for visitors; still crawlable for SEO */}
      <details className="studio__seo">
        <summary>FAQ</summary>
        <dl className="faq-list">
          <div>
            <dt>Is this 100% private?</dt>
            <dd>
              Yes. Images never leave your device. Processing and history stay
              in this browser.
            </dd>
          </div>
          <div>
            <dt>Is this background remover free?</dt>
            <dd>
              Yes. Free and open source. Runs in your browser with no account.
            </dd>
          </div>
          <div>
            <dt>How do I add an image?</dt>
            <dd>
              Drop a file, click to browse, or paste a screenshot, copied image,
              or image link.
            </dd>
          </div>
        </dl>
      </details>
    </div>
  );
}
