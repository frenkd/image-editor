import { useEffect, useRef, useState } from "react";
import { validateImageFile } from "../lib/image";

export function useObjectUrl() {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  function setFile(file: File | undefined): string | null {
    if (!file) return null;
    const err = validateImageFile(file);
    if (err) {
      setError(err);
      return null;
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const next = URL.createObjectURL(file);
    urlRef.current = next;
    setUrl(next);
    setError(null);
    return next;
  }

  function clear() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setUrl(null);
    setError(null);
  }

  return { url, error, setError, setFile, clear };
}
