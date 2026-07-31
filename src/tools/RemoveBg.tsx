import { useRef, useState, useTransition } from "react";
import { DropZone } from "../components/DropZone";
import { ToolShell } from "../components/ToolShell";
import { useObjectUrl } from "../hooks/useObjectUrl";
import { usePasteImage } from "../hooks/usePasteImage";
import { downloadDataUrl } from "../lib/image";
import type { BgRemoveProgress } from "../lib/rmbg/removeBackground";

type Status = "idle" | "processing" | "ready" | "error";

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
  const source = useObjectUrl();
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState<BgRemoveProgress | null>(null);
  const [isPending, startTransition] = useTransition();
  const runIdRef = useRef(0);

  usePasteImage((file) => onFile(file));

  function run(src: string) {
    const runId = ++runIdRef.current;
    setStatus("processing");
    source.setError(null);
    setProgress(null);
    setResultUrl(null);

    startTransition(async () => {
      try {
        const { removeImageBackground } = await import(
          "../lib/rmbg/removeBackground"
        );
        const out = await removeImageBackground(src, (p) => {
          if (runId === runIdRef.current) setProgress(p);
        });
        if (runId !== runIdRef.current) return;
        setResultUrl(out);
        setStatus("ready");
        setProgress(null);
      } catch (err) {
        if (runId !== runIdRef.current) return;
        setStatus("error");
        source.setError(err instanceof Error ? err.message : "Removal failed");
        setProgress(null);
      }
    });
  }

  function onFile(file: File) {
    const url = source.setFile(file);
    setResultUrl(null);
    if (url) run(url);
  }

  const busy = status === "processing" || isPending;
  const err = source.error;

  return (
    <ToolShell
      title="Remove background"
      subtitle="Runs entirely in your browser. First use downloads ~40MB RMBG-1.4 from Hugging Face, then caches it."
      actions={
        <button
          type="button"
          className="btn btn--primary"
          disabled={!resultUrl}
          onClick={() => resultUrl && downloadDataUrl(resultUrl, "cutout.png")}
        >
          Download PNG
        </button>
      }
    >
      <div className="workspace">
        <aside className="workspace__side">
          <DropZone
            label="Drop a photo"
            hint="portraits, product shots, people"
            onFile={onFile}
          />
          {source.url && (
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy}
              onClick={() => source.url && run(source.url)}
            >
              {busy ? "Working…" : "Run again"}
            </button>
          )}
          {busy && (
            <p className="status-line" role="status">
              {progressLabel(progress)}
            </p>
          )}
          {err && (
            <p className="status-line status-line--error" role="alert">
              {err}
            </p>
          )}
          <p className="fineprint">
            Model: <code>briaai/RMBG-1.4</code> via Transformers.js. Nothing is
            uploaded to a server — processing stays on this device.
          </p>
        </aside>

        <div className="workspace__stage">
          {!source.url && !resultUrl && (
            <div className="stage-empty">
              Drop or paste an image to knock out the background.
            </div>
          )}
          {(source.url || resultUrl) && (
            <div className="compare">
              {source.url && (
                <figure className="compare__panel">
                  <figcaption>Original</figcaption>
                  <div className="compare__frame">
                    <img src={source.url} alt="Original upload" />
                  </div>
                </figure>
              )}
              <figure className="compare__panel">
                <figcaption>Cutout</figcaption>
                <div className="compare__frame compare__frame--checker">
                  {resultUrl ? (
                    <img src={resultUrl} alt="Background removed" />
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
    </ToolShell>
  );
}
