/** Soft ETA for the process phase, refined by on-device samples. */

const STORAGE_KEY = "rmbg-timing-v1";
const MAX_SAMPLES = 24;

export type TimingSample = {
  at: number;
  /** Image megapixels at process time. */
  mp: number;
  cores: number;
  /** wall ms for the remove/process phase only (not model download). */
  processMs: number;
};

type Store = { samples: TimingSample[] };

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { samples: [] };
    const parsed = JSON.parse(raw) as Store;
    return { samples: Array.isArray(parsed.samples) ? parsed.samples : [] };
  } catch {
    return { samples: [] };
  }
}

function writeStore(store: Store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota / private mode */
  }
}

export function deviceCores(): number {
  if (typeof navigator === "undefined") return 4;
  return Math.max(1, navigator.hardwareConcurrency || 4);
}

/** Optional Chrome `deviceMemory` (GiB); undefined elsewhere. */
export function deviceMemoryGb(): number | undefined {
  if (typeof navigator === "undefined") return undefined;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return typeof mem === "number" && mem > 0 ? mem : undefined;
}

/**
 * Slower machines → factor > 1. Anchored around 8 cores / 8GB.
 * Used only when we lack matching samples.
 */
export function deviceSlowdown(): number {
  const cores = deviceCores();
  const mem = deviceMemoryGb();
  const corePart = 8 / Math.min(16, Math.max(2, cores));
  const memPart = mem ? 8 / Math.min(16, Math.max(2, mem)) : 1;
  return Math.min(2.4, Math.max(0.55, 0.65 * corePart + 0.35 * memPart));
}

export function megapixels(w: number, h: number): number {
  return Math.max(0.01, (w * h) / 1_000_000);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

/** Baseline guess before any local history (ms). Scales with MP + device. */
function baselineProcessMs(mp: number): number {
  // Rough RMBG-in-browser curve from typical laptop samples.
  return (700 + mp * 420 + Math.pow(mp, 1.25) * 80) * deviceSlowdown();
}

/** Estimate process-phase duration for this image on this machine. */
export function estimateProcessMs(mp: number): number {
  const cores = deviceCores();
  const samples = readStore().samples;
  const nearby = samples.filter(
    (s) =>
      Math.abs(s.mp - mp) / Math.max(mp, s.mp, 0.2) < 0.55 &&
      Math.abs(s.cores - cores) <= 4,
  );

  if (nearby.length >= 2) {
    const msPerMp = median(nearby.map((s) => s.processMs / Math.max(0.05, s.mp)));
    return Math.min(120_000, Math.max(400, msPerMp * mp));
  }

  if (nearby.length === 1) {
    const s = nearby[0]!;
    const scaled = s.processMs * (mp / Math.max(0.05, s.mp));
    return Math.min(120_000, Math.max(400, 0.55 * scaled + 0.45 * baselineProcessMs(mp)));
  }

  if (samples.length >= 3) {
    const msPerMp = median(samples.map((s) => s.processMs / Math.max(0.05, s.mp)));
    const blended = 0.4 * msPerMp * mp + 0.6 * baselineProcessMs(mp);
    return Math.min(120_000, Math.max(400, blended));
  }

  return baselineProcessMs(mp);
}

export function recordProcessSample(mp: number, processMs: number) {
  if (!Number.isFinite(processMs) || processMs < 80 || processMs > 180_000) return;
  const store = readStore();
  store.samples.unshift({
    at: Date.now(),
    mp,
    cores: deviceCores(),
    processMs: Math.round(processMs),
  });
  store.samples = store.samples.slice(0, MAX_SAMPLES);
  writeStore(store);
}

export function modelLikelyCached(): boolean {
  return readStore().samples.length > 0;
}
