import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { DropZone } from "../components/DropZone";
import { InlineCropper } from "../components/InlineCropper";
import { Seo } from "../components/Seo";
import { usePasteImage } from "../hooks/usePasteImage";
import { useRmbgHistory } from "../hooks/useRmbgHistory";
import {
  applyColorOverlay,
  downloadDataUrl,
  formatImageSize,
  readImageSize,
  validateImageFile,
  type ImageSize,
} from "../lib/image";
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
type OpenMenu = "none" | "recent" | "color";

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
  const newInputId = useId();
  const [pendingSourceUrl, setPendingSourceUrl] = useState<string | null>(null);
  const pendingObjectUrlRef = useRef<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<BgRemoveProgress | null>(null);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<OpenMenu>("none");
  const [viewMode, setViewMode] = useState<ViewMode>("result");
  const [studioMode, setStudioMode] = useState<StudioMode>("view");
  const [stageDragging, setStageDragging] = useState(false);
  const [sourceSize, setSourceSize] = useState<ImageSize | null>(null);
  const [resultSize, setResultSize] = useState<ImageSize | null>(null);
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
  const sourceSizeLabel = formatImageSize(sourceSize);
  const resultSizeLabel = formatImageSize(resultSize);

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
    if (!sourceUrl) {
      setSourceSize(null);
      return;
    }
    let cancelled = false;
    readImageSize(sourceUrl)
      .then((size) => {
        if (!cancelled) setSourceSize(size);
      })
      .catch(() => {
        if (!cancelled) setSourceSize(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sourceUrl]);

  useEffect(() => {
    const src = displayUrl ?? cutoutUrl;
    if (!src) {
      setResultSize(null);
      return;
    }
    let cancelled = false;
    readImageSize(src)
      .then((size) => {
        if (!cancelled) setResultSize(size);
      })
      .catch(() => {
        if (!cancelled) setResultSize(null);
      });
    return () => {
      cancelled = true;
    };
  }, [displayUrl, cutoutUrl]);

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

  useEffect(() => {
    if (openMenu === "none") return;

    function onPointerDown(e: PointerEvent) {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-studio-menu]")) return;
      setOpenMenu("none");
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenMenu("none");
    }

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

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
    setOpenMenu("none");
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
    setOpenMenu("none");
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
    setOpenMenu("none");
  }

  function toggleMenu(menu: Exclude<OpenMenu, "none">) {
    setOpenMenu((cur) => (cur === menu ? "none" : menu));
  }

  return (
    <div className="studio">
      <Seo
        page={homeSeo}
        jsonLd={[
          webAppJsonLd(),
          softwareAppJsonLd(homeSeo),
          removeBgFaqJsonLd(),
        ]}
      />

      <header className="studio__header">
        <h1 className="studio__title">Remove background</h1>

        {!empty && (
          <div className="studio__header-actions">
            <label htmlFor={newInputId} className="btn btn--ghost btn--small">
              New
              <input
                id={newInputId}
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={busy || studioMode === "crop"}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void ingestFile(file);
                }}
              />
            </label>

            {history.entries.length > 0 && studioMode === "view" && (
              <div className="menu" data-studio-menu>
                <button
                  type="button"
                  className={`btn btn--ghost btn--small ${openMenu === "recent" ? "is-active-tool" : ""}`}
                  aria-expanded={openMenu === "recent"}
                  disabled={busy}
                  onClick={() => toggleMenu("recent")}
                >
                  Recent
                  <span className="menu__count">{history.entries.length}</span>
                </button>
                {openMenu === "recent" && (
                  <div
                    className="menu-panel menu-panel--recent"
                    role="dialog"
                    aria-label="Recent cutouts"
                  >
                    <ul className="recent-grid">
                      {history.entries.map((entry) => {
                        const selected =
                          !pendingSourceUrl && entry.id === history.activeId;
                        return (
                          <li key={entry.id} className="recent-grid__item">
                            <button
                              type="button"
                              className={`recent-card ${selected ? "is-active" : ""}`}
                              disabled={busy}
                              onClick={() => onSelect(entry.id)}
                            >
                              <img
                                src={entry.cutoutUrl}
                                alt=""
                                className="recent-card__thumb"
                              />
                            </button>
                            <button
                              type="button"
                              className="recent-card__remove"
                              aria-label="Remove from recent"
                              disabled={busy}
                              onClick={() => void history.remove(entry.id)}
                            >
                              ×
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="menu-panel__meta">
                      {history.entries.length}/{RMBG_HISTORY_MAX} on this device
                    </p>
                  </div>
                )}
              </div>
            )}

            {ready && downloadUrl && studioMode === "view" && (
              <button
                type="button"
                className="btn btn--primary btn--small"
                onClick={() => downloadDataUrl(downloadUrl, "cutout.png")}
              >
                Download
              </button>
            )}
          </div>
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
            Nothing leaves this device
          </p>
          {error && (
            <p className="status-line status-line--error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}

      {!empty && (
        <div className="studio__work">
          {ready && studioMode === "view" && (
            <div className="studio__chrome">
              <div className="seg" role="group" aria-label="View">
                <button
                  type="button"
                  className={`seg__btn ${viewMode === "result" ? "is-active" : ""}`}
                  onClick={() => {
                    setViewMode("result");
                    setOpenMenu("none");
                  }}
                >
                  Result
                </button>
                <button
                  type="button"
                  className={`seg__btn ${viewMode === "compare" ? "is-active" : ""}`}
                  onClick={() => {
                    setViewMode("compare");
                    setOpenMenu("none");
                  }}
                >
                  Compare
                </button>
              </div>

              <div className="studio__tools">
                <div className="menu" data-studio-menu>
                  <button
                    type="button"
                    className={`btn btn--ghost btn--small ${openMenu === "color" || colorActive ? "is-active-tool" : ""}`}
                    aria-expanded={openMenu === "color"}
                    onClick={() => toggleMenu("color")}
                  >
                    Color{colorActive ? " · on" : ""}
                  </button>
                  {openMenu === "color" && (
                    <div
                      className="menu-panel menu-panel--color"
                      role="dialog"
                      aria-label="Color overlay"
                    >
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
                </div>

                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  disabled={!downloadUrl}
                  onClick={() => {
                    setOpenMenu("none");
                    setStudioMode("crop");
                  }}
                >
                  Crop
                </button>
              </div>
            </div>
          )}

          {busy && (
            <p className="studio__status" role="status">
              {progressLabel(progress)}
            </p>
          )}
          {error && (
            <p className="studio__status studio__status--error" role="alert">
              {error}
            </p>
          )}

          {studioMode === "crop" && downloadUrl ? (
            <InlineCropper
              imageUrl={downloadUrl}
              onCancel={() => setStudioMode("view")}
              onApply={(cropped) => void applyCrop(cropped)}
            />
          ) : (
            <div
              className={`studio__stage ${stageDragging ? "is-drop-target" : ""}`}
              onDragOver={(e) => {
                if (busy || studioMode === "crop") return;
                e.preventDefault();
                setStageDragging(true);
              }}
              onDragLeave={() => setStageDragging(false)}
              onDrop={(e) => {
                if (busy || studioMode === "crop") return;
                e.preventDefault();
                setStageDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void ingestFile(file);
              }}
            >
              {busy && !displayUrl && (
                <div className="stage-empty">
                  <p>{progressLabel(progress)}</p>
                  {sourceSizeLabel && (
                    <p className="size-meta">{sourceSizeLabel}</p>
                  )}
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
                    <figcaption>
                      Before
                      {sourceSizeLabel ? (
                        <span className="size-meta"> {sourceSizeLabel}</span>
                      ) : null}
                    </figcaption>
                    <div className="compare__frame">
                      <img src={sourceUrl} alt="Original" />
                    </div>
                  </figure>
                  <figure className="compare__panel">
                    <figcaption>
                      After
                      {resultSizeLabel ? (
                        <span className="size-meta"> {resultSizeLabel}</span>
                      ) : null}
                    </figcaption>
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
                    <>
                      <div className="studio__result-frame compare__frame--checker">
                        <img src={displayUrl} alt="Background removed" />
                      </div>
                      {resultSizeLabel && (
                        <p className="size-meta size-meta--below">
                          {resultSizeLabel}
                          {sourceSizeLabel &&
                          sourceSizeLabel !== resultSizeLabel
                            ? ` · from ${sourceSizeLabel}`
                            : ""}
                        </p>
                      )}
                    </>
                  ) : sourceUrl ? (
                    <>
                      <div className="compare__frame">
                        <img src={sourceUrl} alt="Original" />
                      </div>
                      {sourceSizeLabel && (
                        <p className="size-meta size-meta--below">
                          {sourceSizeLabel}
                        </p>
                      )}
                    </>
                  ) : null}
                </div>
              )}

              {stageDragging && (
                <div className="studio__drop-hint">Drop to replace</div>
              )}
            </div>
          )}
        </div>
      )}

      <footer className="studio__footer">
        <span>On-device · nothing uploaded</span>
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

      <details className="studio__seo">
        <summary>FAQ</summary>
        <dl className="faq-list">
          <div>
            <dt>Do images leave my device?</dt>
            <dd>
              No. Nothing is uploaded. Processing and history stay in this
              browser.
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
