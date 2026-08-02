import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DropZone } from "../components/DropZone";
import { InlineCropper } from "../components/InlineCropper";
import { Seo } from "../components/Seo";
import { SiteFooter } from "../components/SiteFooter";
import { usePasteImage } from "../hooks/usePasteImage";
import { useRmbgHistory } from "../hooks/useRmbgHistory";
import {
  contentCropRect,
  imageDataFromElement,
} from "../lib/contentBounds";
import type { Rect } from "../lib/cropMath";
import {
  applyColorOverlay,
  cropSrcToDataUrl,
  downloadDataUrl,
  formatImageSize,
  loadImage,
  readImageSize,
  validateImageFile,
  type ImageSize,
} from "../lib/image";
import { RMBG_HISTORY_MAX } from "../lib/rmbgHistory";
import {
  cleanCutoutDataUrl,
  cleanupEnabled,
  DEFAULT_MASK_CLEANUP,
  type MaskCleanupOptions,
} from "../lib/rmbg/maskCleanup";
import type { BgRemoveProgress } from "../lib/rmbg/removeBackground";
import {
  estimateProcessMs,
  megapixels,
  modelLikelyCached,
  recordProcessSample,
} from "../lib/rmbgTiming";
import {
  resolveCutoutClient,
  trackCutoutStart,
  type CutoutClient,
} from "../lib/analytics";
import {
  homeSeo,
  softwareAppJsonLd,
  webAppJsonLd,
} from "../lib/seo";

const COLOR_DEBOUNCE_MS = 140;
const CLEANUP_STORAGE_KEY = "rmbg.maskCleanup";

type Status = "idle" | "processing" | "ready" | "error";
type ViewMode = "result" | "compare";
type StudioMode = "view" | "crop" | "new";
type OpenMenu = "none" | "color" | "advanced";

type AgentDeepLink = {
  color: string | null;
  crop: "auto" | Rect | null;
  cleanup: MaskCleanupOptions | null;
  client: CutoutClient;
};

function parseTruthy(v: string | null): boolean {
  if (v == null) return false;
  const t = v.trim().toLowerCase();
  return t === "" || t === "1" || t === "true" || t === "yes" || t === "on";
}

function parseHexColor(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/^#?([0-9a-f]{6})$/i);
  return m ? `#${m[1]!.toLowerCase()}` : null;
}

function parseCropParam(raw: string | null): "auto" | Rect | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === "auto" || v === "1" || v === "true") return "auto";
  const parts = raw.split(",").map((p) => Number(p.trim()));
  if (
    parts.length === 4 &&
    parts.every((n) => Number.isFinite(n)) &&
    parts[2]! > 0 &&
    parts[3]! > 0
  ) {
    return {
      x: parts[0]!,
      y: parts[1]!,
      width: parts[2]!,
      height: parts[3]!,
    };
  }
  return null;
}

function readAgentDeepLink(params: URLSearchParams): AgentDeepLink {
  const color =
    parseHexColor(params.get("color")) || parseHexColor(params.get("fill"));
  const crop = parseCropParam(params.get("crop"));
  const advanced = parseTruthy(params.get("advanced"));
  const speckles =
    advanced ||
    parseTruthy(params.get("speckles")) ||
    parseTruthy(params.get("remove-speckles"));
  const fillHoles =
    advanced ||
    parseTruthy(params.get("fill-holes")) ||
    parseTruthy(params.get("fillHoles"));
  const cleanup =
    speckles || fillHoles
      ? { removeSpeckles: speckles, fillHoles }
      : null;
  return {
    color,
    crop,
    cleanup,
    client: resolveCutoutClient(params),
  };
}

function readCleanupPrefs(): MaskCleanupOptions {
  try {
    const raw = localStorage.getItem(CLEANUP_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MASK_CLEANUP };
    const parsed = JSON.parse(raw) as Partial<MaskCleanupOptions>;
    return {
      removeSpeckles: Boolean(parsed.removeSpeckles),
      fillHoles: Boolean(parsed.fillHoles),
    };
  } catch {
    return { ...DEFAULT_MASK_CLEANUP };
  }
}

function writeCleanupPrefs(opts: MaskCleanupOptions) {
  try {
    localStorage.setItem(CLEANUP_STORAGE_KEY, JSON.stringify(opts));
  } catch {
    /* ignore quota / private mode */
  }
}

function progressLabel(p: BgRemoveProgress | null): string {
  if (!p) return "Working…";
  if (p.phase === "download") {
    return typeof p.percent === "number"
      ? `Downloading model ${Math.round(p.percent)}%`
      : p.message || "Downloading model…";
  }
  return p.message || "Removing…";
}

export function RemoveBg() {
  const history = useRmbgHistory();
  const [searchParams, setSearchParams] = useSearchParams();
  const agentSrcConsumed = useRef(false);
  const agentDeepLinkRef = useRef<AgentDeepLink | null>(null);
  const cutoutClientRef = useRef<CutoutClient>("human");
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
  const [processEtaMs, setProcessEtaMs] = useState(5000);
  const [draftColor, setDraftColor] = useState("#00a894");
  const [cleanup, setCleanup] = useState<MaskCleanupOptions>(readCleanupPrefs);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [isPending, startTransition] = useTransition();
  const runIdRef = useRef(0);
  const cleanupRef = useRef(cleanup);
  cleanupRef.current = cleanup;
  const processStartedAtRef = useRef<number | null>(null);
  const runMpRef = useRef(2);
  const cachedModelRef = useRef(modelLikelyCached());
  const colorDebounceRef = useRef<number | null>(null);

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
  const modelBusy = status === "processing" || isPending;
  const busy = modelBusy || cleanupBusy;
  const downloadUrl = displayUrl ?? cutoutUrl;
  const empty = !sourceUrl && !cutoutUrl && !busy;
  const cleanupOn = cleanupEnabled(cleanup);
  const sourceSizeLabel = formatImageSize(sourceSize);
  const resultSizeLabel = formatImageSize(resultSize);
  const modelCached = cachedModelRef.current;
  const downloadShare = modelCached ? 0.08 : 0.42;
  const isDownloading = busy && progress?.phase === "download";
  /** WASM work freezes JS timers; use CSS ETA animation instead. */
  const isEstimating =
    busy && status === "processing" && !isDownloading;
  const downloadProgress =
    typeof progress?.percent === "number"
      ? Math.min(1, Math.max(0, progress.percent / 100))
      : 0;
  const barFrom = isDownloading
    ? downloadProgress * downloadShare
    : downloadShare;
  const barNow = isDownloading ? barFrom : isEstimating ? barFrom : 0;

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
    setDraftColor(pickerHex);
  }, [pickerHex]);

  useEffect(() => {
    return () => {
      if (colorDebounceRef.current != null) {
        window.clearTimeout(colorDebounceRef.current);
      }
    };
  }, []);

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
    if (cachedModelRef.current) {
      processStartedAtRef.current = performance.now();
    }
    const client = cutoutClientRef.current;
    trackCutoutStart(client, {
      hasColor: Boolean(agentDeepLinkRef.current?.color),
      hasCrop: Boolean(agentDeepLinkRef.current?.crop),
      advanced: Boolean(
        agentDeepLinkRef.current?.cleanup?.removeSpeckles ||
          agentDeepLinkRef.current?.cleanup?.fillHoles,
      ),
    });
    cutoutClientRef.current = "human";
    setStatus("processing");
    setError(null);
    setProgress(
      cachedModelRef.current
        ? { phase: "process", message: "Removing…" }
        : { phase: "download", message: "Loading model…", percent: 0 },
    );
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
        const out = await removeImageBackground(
          src,
          (p) => {
            if (runId !== runIdRef.current) return;
            if (p.phase === "process" && processStartedAtRef.current == null) {
              processStartedAtRef.current = performance.now();
            }
            setProgress(p);
          },
          { cleanup: cleanupRef.current },
        );
        if (runId !== runIdRef.current) return;

        if (processStartedAtRef.current != null) {
          recordProcessSample(
            runMpRef.current,
            performance.now() - processStartedAtRef.current,
          );
        }

        const agent = agentDeepLinkRef.current;
        agentDeepLinkRef.current = null;
        let colorMode: "original" | "custom" | "black" | "white" = "original";
        let customColor = "#00a894";
        if (agent?.color) {
          colorMode = "custom";
          customColor = agent.color;
          setDraftColor(agent.color);
        }

        let crop: Rect | null = null;
        if (agent?.crop === "auto") {
          try {
            const img = await loadImage(out);
            crop = contentCropRect(imageDataFromElement(img));
          } catch {
            crop = null;
          }
        } else if (agent?.crop) {
          crop = agent.crop;
        }

        if (mode === "replace" && history.activeId) {
          await history.replaceActiveCutout(out, {
            colorMode,
            customColor,
            clearCrop: true,
          });
          if (crop) history.setActiveCrop(crop);
        } else {
          await history.addEntry({
            sourceSrc: src,
            cutoutSrc: out,
            colorMode,
            customColor,
            crop,
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
    agentDeepLinkRef.current = null;
    cutoutClientRef.current = "human";
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
  const ingestSrcRef = useRef(ingestSrc);
  ingestSrcRef.current = ingestSrc;

  /** Agent / deep-link: /?src=…&color=&crop=auto&advanced=1 */
  useEffect(() => {
    if (agentSrcConsumed.current || !history.hydrated || busy) return;
    const src =
      searchParams.get("src") ||
      searchParams.get("url") ||
      searchParams.get("image");
    if (!src?.trim()) return;
    agentSrcConsumed.current = true;
    const agent = readAgentDeepLink(searchParams);
    agentDeepLinkRef.current = agent;
    cutoutClientRef.current = agent.client;
    if (agent.cleanup) {
      setCleanup(agent.cleanup);
      cleanupRef.current = agent.cleanup;
      writeCleanupPrefs(agent.cleanup);
    }
    const next = new URLSearchParams(searchParams);
    for (const key of [
      "src",
      "url",
      "image",
      "color",
      "fill",
      "crop",
      "advanced",
      "speckles",
      "remove-speckles",
      "fill-holes",
      "fillHoles",
      "via",
      "client",
      "from",
      "agent",
    ]) {
      next.delete(key);
    }
    setSearchParams(next, { replace: true });
    void ingestSrcRef.current(src.trim());
  }, [history.hydrated, searchParams, setSearchParams, busy]);

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

  function revertCrop() {
    history.setActiveCrop(null);
    setStudioMode("view");
    setViewMode("result");
    setOpenMenu("none");
  }

  function queueCustomColor(hex: string) {
    setDraftColor(hex);
    if (colorDebounceRef.current != null) {
      window.clearTimeout(colorDebounceRef.current);
    }
    colorDebounceRef.current = window.setTimeout(() => {
      history.setActiveColors("custom", hex);
      colorDebounceRef.current = null;
    }, COLOR_DEBOUNCE_MS);
  }

  function updateCleanup(patch: Partial<MaskCleanupOptions>) {
    setCleanup((prev) => {
      const next = { ...prev, ...patch };
      writeCleanupPrefs(next);
      return next;
    });
  }

  async function applyCleanupToResult() {
    if (!cutoutUrl || !cleanupOn || busy) return;
    setCleanupBusy(true);
    setError(null);
    setOpenMenu("none");
    try {
      const cleaned = await cleanCutoutDataUrl(cutoutUrl, cleanup);
      await history.replaceActiveCutout(cleaned);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Cleanup failed");
    } finally {
      setCleanupBusy(false);
    }
  }

  function rerunFromSource() {
    if (!sourceUrl || busy) return;
    agentDeepLinkRef.current = null;
    cutoutClientRef.current = "human";
    run(sourceUrl, history.activeId ? "replace" : "create");
  }

  function toggleMenu(menu: Exclude<OpenMenu, "none">) {
    setOpenMenu((cur) => (cur === menu ? "none" : menu));
  }

  return (
    <div className={`studio ${empty ? "" : "studio--rail"}`.trim()}>
      <Seo
        page={homeSeo}
        jsonLd={[webAppJsonLd(), softwareAppJsonLd(homeSeo)]}
      />

      <header className="studio__header">
        <h1 className="studio__title">Remove background</h1>
      </header>

      {empty && (
        <div className="studio__hero">
          <DropZone
            hero
            label="Drop or paste an image"
            onFile={(file) => void ingestFile(file)}
          />
          <p className="studio__privacy">
            Your images stay on this device ·{" "}
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
        <aside className="studio__gallery" aria-label="Recent cutouts">
          <div className="studio__gallery-head">
            <div className="studio__gallery-label">
              <span>Recent</span>
              <span className="studio__gallery-count">
                {history.entries.length}/{RMBG_HISTORY_MAX}
              </span>
            </div>
            {studioMode === "new" ? (
              <button
                type="button"
                className="btn btn--ghost btn--small btn--block"
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
                className="btn btn--ghost btn--small btn--block"
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

      {!empty && (
        <div className="studio__work">
            {studioMode === "crop" && cutoutUrl ? (
              <InlineCropper
                imageUrl={cutoutUrl}
                initialCrop={cropRect}
                onCancel={() => setStudioMode("view")}
                onApply={applyCrop}
                onRevert={revertCrop}
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
                      Your images stay on this device ·{" "}
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
                  {modelBusy ? (
                    <div className="progress-rail" role="status">
                      <div className="progress-rail__meta">
                        <span>{progressLabel(progress)}</span>
                        {isDownloading && (
                          <span className="progress-rail__pct">
                            {Math.round(downloadProgress * 100)}%
                          </span>
                        )}
                      </div>
                      <div className="progress-rail__track" aria-hidden>
                        <div
                          key={isEstimating ? "estimating" : "download"}
                          className={`progress-rail__fill ${isEstimating ? "is-estimating" : ""}`}
                          style={
                            {
                              "--eta": `${Math.max(900, processEtaMs)}ms`,
                              "--from": String(Math.max(0.04, barFrom)),
                              "--p": String(barNow),
                            } as CSSProperties
                          }
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
                            Color{colorActive ? " on" : ""}
                          </button>
                          {openMenu === "color" && (
                            <div
                              className="menu-panel menu-panel--color"
                              role="dialog"
                              aria-label="Color overlay"
                            >
                              <div className="color-board">
                                <label
                                  className={`color-swatch color-swatch--picker ${colorMode === "custom" ? "is-active" : ""}`}
                                  title="Pick a color"
                                >
                                  <span
                                    className="color-swatch__fill"
                                    style={{ background: draftColor }}
                                  />
                                  <span className="color-swatch__icon" aria-hidden>
                                    <svg
                                      width="14"
                                      height="14"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                    >
                                      <path
                                        d="M4 20l.7-2.5L14.5 7.7l2.8 2.8L8.5 19.3 4 20z"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        strokeLinejoin="round"
                                      />
                                      <path
                                        d="M13.2 6.4l2.1-2.1a1.6 1.6 0 0 1 2.3 0l2.1 2.1a1.6 1.6 0 0 1 0 2.3l-2.1 2.1"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  </span>
                                  <span className="sr-only">Custom color</span>
                                  <input
                                    type="color"
                                    className="color-swatch__input"
                                    value={draftColor}
                                    onChange={(e) =>
                                      queueCustomColor(e.target.value)
                                    }
                                  />
                                </label>
                                <button
                                  type="button"
                                  className={`color-swatch color-swatch--black ${colorMode === "black" ? "is-active" : ""}`}
                                  aria-label="Black"
                                  title="Black"
                                  onClick={() => {
                                    if (colorDebounceRef.current != null) {
                                      window.clearTimeout(
                                        colorDebounceRef.current,
                                      );
                                      colorDebounceRef.current = null;
                                    }
                                    setDraftColor("#000000");
                                    history.setActiveColors("black", "#000000");
                                  }}
                                />
                                <button
                                  type="button"
                                  className={`color-swatch color-swatch--white ${colorMode === "white" ? "is-active" : ""}`}
                                  aria-label="White"
                                  title="White"
                                  onClick={() => {
                                    if (colorDebounceRef.current != null) {
                                      window.clearTimeout(
                                        colorDebounceRef.current,
                                      );
                                      colorDebounceRef.current = null;
                                    }
                                    setDraftColor("#ffffff");
                                    history.setActiveColors("white", "#ffffff");
                                  }}
                                />
                                <button
                                  type="button"
                                  className={`color-swatch color-swatch--none ${colorMode === "original" ? "is-active" : ""}`}
                                  aria-label="No fill"
                                  title="No fill"
                                  onClick={() => {
                                    if (colorDebounceRef.current != null) {
                                      window.clearTimeout(
                                        colorDebounceRef.current,
                                      );
                                      colorDebounceRef.current = null;
                                    }
                                    history.setActiveColors(
                                      "original",
                                      customColor,
                                    );
                                  }}
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

                        <div className="menu" data-studio-menu>
                          <button
                            type="button"
                            className={`btn btn--ghost btn--small btn--quiet ${openMenu === "advanced" || cleanupOn ? "is-active-tool" : ""}`}
                            aria-expanded={openMenu === "advanced"}
                            disabled={!ready && !sourceUrl}
                            onClick={() => toggleMenu("advanced")}
                          >
                            Advanced{cleanupOn ? " on" : ""}
                          </button>
                          {openMenu === "advanced" && (
                            <div
                              className="menu-panel menu-panel--advanced"
                              role="dialog"
                              aria-label="Advanced mask cleanup"
                            >
                              <header className="menu-panel__head">
                                <h2 className="menu-panel__title">
                                  Mask cleanup
                                </h2>
                                <p className="menu-panel__lead">
                                  Optional. Off by default. May soften fine
                                  edges.
                                </p>
                              </header>
                              <div className="check-list">
                                <label className="check-row">
                                  <input
                                    type="checkbox"
                                    checked={cleanup.removeSpeckles}
                                    onChange={(e) =>
                                      updateCleanup({
                                        removeSpeckles: e.target.checked,
                                      })
                                    }
                                  />
                                  <span>
                                    Remove speckles
                                    <small>
                                      Drop leftover background bits
                                    </small>
                                  </span>
                                </label>
                                <label className="check-row">
                                  <input
                                    type="checkbox"
                                    checked={cleanup.fillHoles}
                                    onChange={(e) =>
                                      updateCleanup({
                                        fillHoles: e.target.checked,
                                      })
                                    }
                                  />
                                  <span>
                                    Fill tiny holes
                                    <small>
                                      Pinholes only, not arm or leg gaps
                                    </small>
                                  </span>
                                </label>
                              </div>
                              <div className="menu-panel__actions">
                                <button
                                  type="button"
                                  className="btn btn--primary btn--small btn--block"
                                  disabled={
                                    !ready || !cleanupOn || cleanupBusy
                                  }
                                  onClick={() => void applyCleanupToResult()}
                                >
                                  Apply to result
                                </button>
                                <button
                                  type="button"
                                  className="btn btn--ghost btn--small btn--block"
                                  disabled={!sourceUrl || busy}
                                  onClick={rerunFromSource}
                                >
                                  Re-run removal
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {ready && downloadUrl && (
                          <button
                            type="button"
                            className="btn btn--primary btn--small"
                            onClick={() =>
                              downloadDataUrl(downloadUrl, "cutout.png")
                            }
                          >
                            Download
                          </button>
                        )}
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
      )}

      <SiteFooter />
    </div>
  );
}
