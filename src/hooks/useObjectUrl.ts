import { useEffect, useRef, useState } from "react";
import { validateImageFile } from "../lib/image";

export function useObjectUrl() {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  function revokeObjectUrl() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  function setFile(file: File | undefined): string | null {
    if (!file) return null;
    const err = validateImageFile(file);
    if (err) {
      setError(err);
      return null;
    }
    revokeObjectUrl();
    const next = URL.createObjectURL(file);
    objectUrlRef.current = next;
    setUrl(next);
    setError(null);
    return next;
  }

  /** Use a remote URL or data URL as the source (not revoked on clear of object URLs). */
  function setSrc(src: string): string {
    revokeObjectUrl();
    setUrl(src);
    setError(null);
    return src;
  }

  function clear() {
    revokeObjectUrl();
    setUrl(null);
    setError(null);
  }

  return { url, error, setError, setFile, setSrc, clear };
}
