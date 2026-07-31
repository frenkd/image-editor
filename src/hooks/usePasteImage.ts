import { useEffect, useRef } from "react";

/** Paste an image from the clipboard when not focused in a text field. */
export function usePasteImage(onFile: (file: File) => void) {
  const onFileRef = useRef(onFile);
  onFileRef.current = onFile;

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items?.length) return;

      for (const item of items) {
        if (!item.type.startsWith("image/")) continue;
        const file = item.getAsFile();
        if (!file) continue;
        e.preventDefault();
        onFileRef.current(file);
        return;
      }
    }

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);
}
