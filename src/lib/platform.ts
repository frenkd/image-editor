/** True when the user is likely on macOS (for shortcut hints). */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platform = nav.userAgentData?.platform || navigator.platform || "";
  const ua = navigator.userAgent || "";
  return /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac OS X|iPhone|iPad/i.test(ua);
}

export function pasteShortcutLabel(): string {
  return isApplePlatform() ? "⌘V" : "Ctrl+V";
}
