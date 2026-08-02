import { useId, useState } from "react";
import { pasteShortcutLabel } from "../lib/platform";

type Props = {
  label?: string;
  hint?: string;
  onFile: (file: File) => void;
  compact?: boolean;
  /** Large 16:9 drop target with paste-mode list (idle hero). */
  hero?: boolean;
};

export function DropZone({
  label = "Drop an image",
  hint = "or click to browse · paste works too",
  onFile,
  compact = false,
  hero = false,
}: Props) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const pasteKey = pasteShortcutLabel();

  function take(file: File | undefined) {
    if (file) onFile(file);
  }

  return (
    <label
      htmlFor={inputId}
      className={`dropzone ${compact ? "dropzone--compact" : ""} ${hero ? "dropzone--hero" : ""} ${dragging ? "is-dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        take(e.dataTransfer.files?.[0]);
      }}
    >
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          take(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <span className="dropzone__mark" aria-hidden>
        +
      </span>
      <span className="dropzone__label">{label}</span>
      {!hero && <span className="dropzone__hint">{hint}</span>}
      {hero && (
        <ul className="dropzone__modes">
          <li>
            <kbd>{pasteKey}</kbd> screenshot or copied image
          </li>
          <li>
            <kbd>{pasteKey}</kbd> image link
          </li>
          <li>Drop a file or click to browse</li>
        </ul>
      )}
    </label>
  );
}
