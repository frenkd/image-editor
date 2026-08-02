import { useEffect, useRef } from "react";
import { resolveClipboardImage } from "../lib/clipboardImage";

type PasteHandlers = {
  onFile: (file: File) => void;
  /** Remote / data URL when fetch is blocked by CORS but the browser can still load it. */
  onSrc?: (src: string) => void;
  onError?: (message: string) => void;
};

/** Paste images via Ctrl/Cmd+V: clipboard bitmaps, files, image URLs, or HTML imgs. */
export function usePasteImage(handlers: PasteHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let seq = 0;

    async function onPaste(e: ClipboardEvent) {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      const runId = ++seq;
      try {
        const pasted = await resolveClipboardImage(e.clipboardData);
        if (runId !== seq) return;
        if (!pasted) return;

        e.preventDefault();

        if (pasted.kind === "file") {
          handlersRef.current.onFile(pasted.file);
          return;
        }

        if (handlersRef.current.onSrc) {
          handlersRef.current.onSrc(pasted.src);
        } else {
          handlersRef.current.onError?.(
            "Could not load that image link (CORS). Try saving and dropping the file instead.",
          );
        }
      } catch (err) {
        if (runId !== seq) return;
        handlersRef.current.onError?.(
          err instanceof Error ? err.message : "Paste failed",
        );
      }
    }

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);
}
