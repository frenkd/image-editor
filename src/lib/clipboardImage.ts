/** Pull an image File or remote/data URL out of a paste event. */

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|avif|heic|heif)(\?|#|$)/i;

export type PastedImage =
  | { kind: "file"; file: File }
  | { kind: "src"; src: string };

function looksLikeImageUrl(url: string): boolean {
  if (/^data:image\//i.test(url)) return true;
  if (IMAGE_EXT.test(url)) return true;
  // Common image hosts / CDN paths without a clear extension
  try {
    const u = new URL(url);
    return (
      u.protocol === "http:" ||
      u.protocol === "https:" ||
      u.protocol === "data:"
    );
  } catch {
    return false;
  }
}

function firstHttpUrl(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (/^data:image\//i.test(trimmed)) return trimmed;

  // Whole clipboard is a bare URL
  if (/^https?:\/\/\S+$/i.test(trimmed)) return trimmed;

  const match = trimmed.match(/https?:\/\/[^\s<>"']+/i);
  return match?.[0] ?? null;
}

function srcFromHtml(html: string): string | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const img = doc.querySelector("img[src]");
  const src = img?.getAttribute("src")?.trim();
  if (!src) return null;
  if (src.startsWith("data:image/") || /^https?:\/\//i.test(src)) return src;
  return null;
}

async function fileFromBlob(
  blob: Blob,
  name = "pasted-image",
): Promise<File> {
  const type = blob.type.startsWith("image/") ? blob.type : "image/png";
  const ext = type.split("/")[1] || "png";
  const filename = name.includes(".") ? name : `${name}.${ext}`;
  return new File([blob], filename, { type });
}

/** Best-effort: download a URL into a File (needs CORS). */
export async function fetchImageAsFile(src: string): Promise<File> {
  const res = await fetch(src);
  if (!res.ok) {
    throw new Error(`Could not fetch image (${res.status}).`);
  }
  const blob = await res.blob();
  if (
    blob.type &&
    !blob.type.startsWith("image/") &&
    !blob.type.includes("octet-stream")
  ) {
    throw new Error("That link does not look like an image.");
  }
  let name = "pasted-image";
  try {
    const path = new URL(src, window.location.href).pathname;
    const base = path.split("/").pop();
    if (base) name = decodeURIComponent(base);
  } catch {
    /* keep default */
  }
  return fileFromBlob(blob, name);
}

/**
 * Resolve clipboard paste into a local File or a usable image src.
 * Prefers binary clipboard images, then HTML img, then plain URL / data URL.
 */
export async function resolveClipboardImage(
  data: DataTransfer | null,
): Promise<PastedImage | null> {
  if (!data) return null;

  // 1) Native image items (Screenshot / Copy Image)
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) return { kind: "file", file };
    }
  }

  // 2) Files list (some browsers / OS paste paths)
  for (const file of Array.from(data.files ?? [])) {
    if (file.type.startsWith("image/") || IMAGE_EXT.test(file.name)) {
      return { kind: "file", file };
    }
  }

  // 3) HTML with <img src>
  const html = data.getData("text/html");
  if (html) {
    const src = srcFromHtml(html);
    if (src) {
      if (src.startsWith("data:image/")) {
        const file = await fetchImageAsFile(src);
        return { kind: "file", file };
      }
      try {
        const file = await fetchImageAsFile(src);
        return { kind: "file", file };
      } catch {
        return { kind: "src", src };
      }
    }
  }

  // 4) Plain text URL or data URL
  const text = data.getData("text/plain");
  const url = firstHttpUrl(text);
  if (url && looksLikeImageUrl(url)) {
    if (url.startsWith("data:image/")) {
      const file = await fetchImageAsFile(url);
      return { kind: "file", file };
    }
    try {
      const file = await fetchImageAsFile(url);
      return { kind: "file", file };
    } catch {
      // CORS-blocked hosts: still try loading the URL directly in <img> / model
      return { kind: "src", src: url };
    }
  }

  return null;
}
