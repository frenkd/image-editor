/**
 * Shared RMBG-1.4 setup for the browser.
 * Prefers WebGPU when available, falls back to WASM q8.
 */

export const RMBG_MODEL_ID = "briaai/RMBG-1.4";

export type RmbgProgress = {
  phase: "download" | "process";
  message: string;
  percent?: number;
};

export type RmbgBackendId =
  | "webgpu-fp16"
  | "webgpu-fp32"
  | "webgpu-q8"
  | "wasm-q8";

type ProgressPayload = {
  status: string;
  progress?: number;
  file?: string;
};

type LoadCandidate = {
  id: RmbgBackendId;
  device?: "webgpu";
  dtype: "fp16" | "fp32" | "q8";
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipelinePromise: Promise<any> | null = null;
let activeBackend: RmbgBackendId | null = null;

export function getRmbgBackend(): RmbgBackendId | null {
  return activeBackend;
}

function logRmbgProgress(
  data: ProgressPayload,
  onProgress?: (p: RmbgProgress) => void,
) {
  if (data.status === "progress" && typeof data.progress === "number") {
    const file = data.file ? ` ${data.file}` : "";
    const message = `Downloading RMBG model…${file} ${Math.round(data.progress)}%`;
    onProgress?.({ phase: "download", message, percent: data.progress });
  } else if (data.status === "done") {
    onProgress?.({ phase: "download", message: "Model ready", percent: 100 });
  }
}

/** Configure Transformers.js env before calling `pipeline()`. */
export async function configureRmbgEnv(): Promise<void> {
  const { env } = await import("@huggingface/transformers");
  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  env.useBrowserCache = true;
}

async function webgpuCapabilities(): Promise<{
  available: boolean;
  fp16: boolean;
}> {
  try {
    const gpu = navigator.gpu;
    if (!gpu) return { available: false, fp16: false };
    const adapter = await gpu.requestAdapter();
    if (!adapter) return { available: false, fp16: false };
    return {
      available: true,
      fp16: adapter.features.has("shader-f16"),
    };
  } catch {
    return { available: false, fp16: false };
  }
}

async function loadCandidates(): Promise<LoadCandidate[]> {
  const { available, fp16 } = await webgpuCapabilities();
  const list: LoadCandidate[] = [];
  if (available) {
    if (fp16) list.push({ id: "webgpu-fp16", device: "webgpu", dtype: "fp16" });
    list.push({ id: "webgpu-fp32", device: "webgpu", dtype: "fp32" });
    list.push({ id: "webgpu-q8", device: "webgpu", dtype: "q8" });
  }
  list.push({ id: "wasm-q8", dtype: "q8" });
  return list;
}

/**
 * Load RMBG via `image-segmentation`.
 * Tries WebGPU first (when available), then WASM q8.
 * Pin `@huggingface/transformers` to 3.4.2.
 */
export async function ensureRmbgPipeline(
  onProgress?: (p: RmbgProgress) => void,
): Promise<unknown> {
  if (!pipelinePromise) {
    pipelinePromise = loadRmbgPipeline(onProgress).catch((err) => {
      pipelinePromise = null;
      activeBackend = null;
      throw err;
    });
  }
  return pipelinePromise;
}

async function loadRmbgPipeline(
  onProgress?: (p: RmbgProgress) => void,
): Promise<unknown> {
  await configureRmbgEnv();
  const { pipeline } = await import("@huggingface/transformers");
  const candidates = await loadCandidates();
  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      onProgress?.({
        phase: "download",
        message: `Loading model (${candidate.id})…`,
        percent: 0,
      });

      const options: {
        dtype: LoadCandidate["dtype"];
        device?: "webgpu";
        progress_callback: (data: ProgressPayload) => void;
      } = {
        dtype: candidate.dtype,
        progress_callback: (data: ProgressPayload) =>
          logRmbgProgress(data, onProgress),
      };
      if (candidate.device) options.device = candidate.device;

      const pipe = await pipeline(
        "image-segmentation",
        RMBG_MODEL_ID,
        options,
      );
      activeBackend = candidate.id;
      console.info(`[rmbg] backend: ${candidate.id}`);
      onProgress?.({
        phase: "download",
        message: "Model ready",
        percent: 100,
      });
      return pipe;
    } catch (err) {
      lastError = err;
      console.warn(
        `[rmbg] ${candidate.id} unavailable:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to load background removal model.");
}
