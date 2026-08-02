import { useId, useState } from "react";
import { isApplePlatform, pasteShortcutLabel } from "../lib/platform";

type Props = {
  label?: string;
  hint?: string;
  onFile: (file: File) => void;
  /** Large 16:9 drop target with paste-mode list (idle hero). */
  hero?: boolean;
};

function ShortcutKeys({ label }: { label: string }) {
  const keys = isApplePlatform()
    ? ["⌘", "V"]
    : label.split("+").map((part) => part.trim());

  return (
    <span className="shortcut" aria-label={label}>
      {keys.map((key) => (
        <kbd key={key} className="shortcut__key">
          {key}
        </kbd>
      ))}
    </span>
  );
}

export function DropZone({
  label = "Drop an image",
  hint = "or click to browse · paste works too",
  onFile,
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
      className={`dropzone ${hero ? "dropzone--hero" : ""} ${dragging ? "is-dragging" : ""}`}
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
            <ShortcutKeys label={pasteKey} />
            <span>Paste a screenshot, image, or link</span>
          </li>
          <li className="dropzone__modes-secondary">
            Drop a file or click to browse
          </li>
        </ul>
      )}
    </label>
  );
}
