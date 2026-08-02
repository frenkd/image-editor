import {
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { Link } from "react-router-dom";
import { DropZone } from "../components/DropZone";
import { InlineCropper } from "../components/InlineCropper";
import { Seo } from "../components/Seo";
import { SiteFooter } from "../components/SiteFooter";
import { usePasteImage } from "../hooks/usePasteImage";
import { useRmbgHistory } from "../hooks/useRmbgHistory";
import type { Rect } from "../lib/cropMath";
import {
  applyColorOverlay,
  cropSrcToDataUrl,
  downloadDataUrl,
  formatImageSize,
  readImageSize,
  validateImageFile,
  type ImageSize,
} from "../lib/image";
import { RMBG_HISTORY_MAX } from "../lib/rmbgHistory";
import type { BgRemoveProgress } from "../lib/rmbg/removeBackground";
import {
  blendProgress,
  estimateProcessMs,
  megapixels,
  modelLikelyCached,
  recordProcessSample,
} from "../lib/rmbgTiming";
import {
  homeSeo,
  softwareAppJsonLd,
  webAppJsonLd,
} from "../lib/seo";

type Status = "idle" | "processing" | "ready" | "error";
type ViewMode = "result" | "compare";
type StudioMode = "view" | "crop" | "new";
type OpenMenu = "none" | "color";

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
  const [openMenu, setOpenMenu] = useState<OpenMenu>("none");
  const [viewMode, setViewMode] = useState<ViewMode>("result");
  const [studioMode, setStudioMode] = useState<StudioMode>("view");
  const [stageDragging, setStageDragging] = useState(false);
  const [sourceSize, setSourceSize] = useState<ImageSize | null>(null);
  const [resultSize, setResultSize] = useState<ImageSize | null>(null);
  const [progressPct, setProgressPct] = useState(0);
  const [processEtaMs, setProcessEtaMs] = useState(5000);
  const [isPending, startTransition] = useTransition();
  const runIdRef = useRef(0);
  const processStartedAtRef = useRef<number | null>(null);
  const runMpRef = useRef(2);
  const cachedModelRef = useRef(modelLikelyCached());

  const active = history.active;
  const colorMode = active?.colorMode ?? "original";
  const customColor = active?.customColor ?? "#00a894";
  const cropRect = active?.crop ?? null;
  const pickerHex =
    colorMode === "black"
      ? "#000000"
      : colorMode === "white"
        ? "#ffffff"
        : customColor;
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
    const hex =
      colorMode === "black"
        ? "#000000"
        : colorMode === "white"
          ? "#ffffff"
          : customColor;
    let cancelled = false;

    (async () => {
      try {
        let url = cutoutUrl;
        if (colorMode !== "original") {
          url = await applyColorOverlay(url, hex);
        }
        if (cropRect) {
          url = await cropSrcToDataUrl(url, cropRect);
        }
        if (!cancelled) setDisplayUrl(url);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not build preview",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cutoutUrl, colorMode, customColor, cropRect]);

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

  useEffect(() => {
    if (!busy) {
      setProgressPct(0);
      return;
    }
    let raf = 0;
    const tick = () => {
      const elapsed = processStartedAtRef.current
        ? performance.now() - processStartedAtRef.current
        : 0;
      setProgressPct(
        blendProgress({
          phase: progress?.phase ?? null,
          downloadPercent:
            typeof progress?.percent === "number" ? progress.percent : null,
          processElapsedMs: elapsed,
          processEtaMs,
          modelLikelyCached: cachedModelRef.current,
        }),
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [busy, progress, processEtaMs]);

  function clearPendingSource() {
    if (pendingObjectUrlRef.current) {
      URL.revokeObjectURL(pendingObjectUrlRef.current);
      pendingObjectUrlRef.current = null;
    }
    setPendingSourceUrl(null);
  }

  function run(src: string, mode: "create" | "replace") {
    const runId = ++runIdRef.current;
    processStartedAtRef.current = null;
    cachedModelRef.current = modelLikelyCached();
    setStatus("processing");
    setError(null);
    setProgress(null);
    setProgressPct(cachedModelRef.current ? 4 : 1);
    setDisplayUrl(null);
    setOpenMenu("none");
    setStudioMode("view");
    setViewMode("result");

    void readImageSize(src)
      .then((size) => {
        if (runId !== runIdRef.current) return;
        setSourceSize(size);
        runMpRef.current = megapixels(size.w, size.h);
        setProcessEtaMs(estimateProcessMs(runMpRef.current));
      })
      .catch(() => {
        if (runId !== runIdRef.current) return;
        runMpRef.current = 2;
        setProcessEtaMs(estimateProcessMs(2));
      });

    startTransition(async () => {
      try {
        const { removeImageBackground } = await import(
          "../lib/rmbg/removeBackground"
        );
        const out = await removeImageBackground(src, (p) => {
          if (runId !== runIdRef.current) return;
          if (p.phase === "process" && processStartedAtRef.current == null) {
            processStartedAtRef.current = performance.now();
          }
          setProgress(p);
        });
        if (runId !== runIdRef.current) return;

        if (processStartedAtRef.current != null) {
          recordProcessSample(
            runMpRef.current,
            performance.now() - processStartedAtRef.current,
          );
        }

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
        setProgressPct(100);
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

  function applyCrop(next: Rect) {
    history.setActiveCrop(next);
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
        jsonLd={[webAppJsonLd(), softwareAppJsonLd(homeSeo)]}
      />

      <header className="studio__header">
        <h1 className="studio__title">Remove background</h1>

        {!empty && (
          <div className="studio__header-actions">
            {studioMode === "new" ? (
              <button
                type="button"
                className="btn btn--ghost btn--small"
                disabled={busy}
                onClick={() => {
                  setError(null);
                  setStudioMode("view");
                }}
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--ghost btn--small"
                disabled={busy || studioMode === "crop"}
                onClick={() => {
                  setOpenMenu("none");
                  setError(null);
                  setStudioMode("new");
                }}
              >
                New
              </button>
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
            Nothing leaves this device ·{" "}
            <Link to="/how-it-works">How it works</Link>
          </p>
          {error && (
            <p className="status-line status-line--error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}

      {!empty && (
        <div
          className={`studio__shell ${history.entries.length > 0 || pendingSourceUrl ? "has-gallery" : ""}`}
        >
          {(history.entries.length > 0 || pendingSourceUrl) && (
            <aside className="studio__gallery" aria-label="Recent cutouts">
              <div className="studio__gallery-head">
                <span>Recent</span>
                <span className="studio__gallery-count">
                  {history.entries.length}/{RMBG_HISTORY_MAX}
                </span>
              </div>
              <ul className="gallery-list">
                {pendingSourceUrl && (
                  <li className="gallery-list__item">
                    <div className="gallery-thumb is-active is-pending">
                      <img src={pendingSourceUrl} alt="" />
                    </div>
                  </li>
                )}
                {history.entries.map((entry) => {
                  const selected =
                    !pendingSourceUrl && entry.id === history.activeId;
                  return (
                    <li key={entry.id} className="gallery-list__item">
                      <button
                        type="button"
                        className={`gallery-thumb ${selected ? "is-active" : ""}`}
                        disabled={busy || studioMode === "crop"}
                        onClick={() => onSelect(entry.id)}
                      >
                        <img src={entry.cutoutUrl} alt="" />
                      </button>
                      <button
                        type="button"
                        className="gallery-thumb__remove"
                        aria-label="Remove from recent"
                        disabled={busy || studioMode === "crop"}
                        onClick={() => void history.remove(entry.id)}
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>
          )}

          <div className="studio__work">
            {studioMode === "crop" && cutoutUrl ? (
              <InlineCropper
                imageUrl={cutoutUrl}
                initialCrop={cropRect}
                onCancel={() => setStudioMode("view")}
                onApply={applyCrop}
              />
            ) : studioMode === "new" && !busy ? (
              <>
                <div className="studio__chrome">
                  <p className="studio__compose-hint">
                    Drop, paste, or choose another image
                  </p>
                </div>
                <div className="studio__stage studio__stage--compose">
                  <div className="studio__compose">
                    <DropZone
                      hero
                      label="Drop or paste an image"
                      onFile={(file) => void ingestFile(file)}
                    />
                    <p className="studio__privacy">
                      Nothing leaves this device ·{" "}
                      <Link to="/how-it-works">How it works</Link>
                    </p>
                    {error && (
                      <p
                        className="status-line status-line--error"
                        role="alert"
                      >
                        {error}
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="studio__chrome">
                  {busy ? (
                    <div className="progress-rail" role="status">
                      <div className="progress-rail__meta">
                        <span>{progressLabel(progress)}</span>
                        <span className="progress-rail__pct">
                          {Math.round(progressPct)}%
                        </span>
                      </div>
                      <div
                        className="progress-rail__track"
                        aria-hidden
                      >
                        <div
                          className="progress-rail__fill"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="seg" role="group" aria-label="View">
                        <button
                          type="button"
                          className={`seg__btn ${viewMode === "result" ? "is-active" : ""}`}
                          disabled={!ready}
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
                          disabled={!ready}
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
                            disabled={!ready}
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
                              <div className="color-board">
                                <label className="color-board__picker">
                                  <span className="sr-only">Custom color</span>
                                  <input
                                    type="color"
                                    value={pickerHex}
                                    onChange={(e) =>
                                      history.setActiveColors(
                                        "custom",
                                        e.target.value,
                                      )
                                    }
                                  />
                                </label>
                                <button
                                  type="button"
                                  className={`color-swatch color-swatch--black ${colorMode === "black" || pickerHex.toLowerCase() === "#000000" ? "is-active" : ""}`}
                                  aria-label="Black"
                                  title="Black"
                                  onClick={() =>
                                    history.setActiveColors("black", "#000000")
                                  }
                                />
                                <button
                                  type="button"
                                  className={`color-swatch color-swatch--white ${colorMode === "white" || pickerHex.toLowerCase() === "#ffffff" ? "is-active" : ""}`}
                                  aria-label="White"
                                  title="White"
                                  onClick={() =>
                                    history.setActiveColors("white", "#ffffff")
                                  }
                                />
                                <button
                                  type="button"
                                  className={`color-swatch color-swatch--none ${colorMode === "original" ? "is-active" : ""}`}
                                  aria-label="No fill"
                                  title="No fill"
                                  onClick={() =>
                                    history.setActiveColors(
                                      "original",
                                      customColor,
                                    )
                                  }
                                >
                                  None
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          className="btn btn--ghost btn--small"
                          disabled={!ready || !downloadUrl}
                          onClick={() => {
                            setOpenMenu("none");
                            setStudioMode("crop");
                          }}
                        >
                          Crop
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {error && (
                  <p
                    className="studio__status studio__status--error"
                    role="alert"
                  >
                    {error}
                  </p>
                )}

                <div
                  className={`studio__stage ${stageDragging ? "is-drop-target" : ""}`}
                  onDragOver={(e) => {
                    if (busy) return;
                    e.preventDefault();
                    setStageDragging(true);
                  }}
                  onDragLeave={() => setStageDragging(false)}
                  onDrop={(e) => {
                    if (busy) return;
                    e.preventDefault();
                    setStageDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) void ingestFile(file);
                  }}
                >
                  {busy && sourceUrl && (
                    <div className="studio__result">
                      <div className="studio__result-frame">
                        <img
                          src={sourceUrl}
                          alt=""
                          className="is-processing"
                        />
                      </div>
                      {sourceSizeLabel && (
                        <p className="size-meta size-meta--below">
                          {sourceSizeLabel}
                        </p>
                      )}
                    </div>
                  )}

                  {!busy && viewMode === "compare" && sourceUrl && (
                    <div className="compare">
                      <figure className="compare__panel">
                        <figcaption>
                          Before
                          {sourceSizeLabel ? (
                            <span className="size-meta">
                              {" "}
                              {sourceSizeLabel}
                            </span>
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
                            <span className="size-meta">
                              {" "}
                              {resultSizeLabel}
                            </span>
                          ) : null}
                        </figcaption>
                        <div className="compare__frame compare__frame--checker">
                          {displayUrl ? (
                            <img src={displayUrl} alt="Background removed" />
                          ) : (
                            <div className="stage-empty stage-empty--inset">
                              …
                            </div>
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
                          <div className="studio__result-frame">
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
              </>
            )}
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}
