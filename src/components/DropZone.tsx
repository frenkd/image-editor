import { useId, useState } from "react";

type Props = {
  label?: string;
  hint?: string;
  onFile: (file: File) => void;
  compact?: boolean;
};

export function DropZone({
  label = "Drop an image",
  hint = "or click to browse · paste works too",
  onFile,
  compact = false,
}: Props) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  function take(file: File | undefined) {
    if (file) onFile(file);
  }

  return (
    <label
      htmlFor={inputId}
      className={`dropzone ${compact ? "dropzone--compact" : ""} ${dragging ? "is-dragging" : ""}`}
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
      <span className="dropzone__hint">{hint}</span>
    </label>
  );
}
