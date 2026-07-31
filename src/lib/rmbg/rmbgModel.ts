/**
 * Shared RMBG-1.4 setup for the browser.
 * Adapted from sloai-org (briaai/RMBG-1.4 via Transformers.js).
 */

export const RMBG_MODEL_ID = "briaai/RMBG-1.4";

export type RmbgProgress = {
  phase: "download" | "process";
  message: string;
  percent?: number;
};

type ProgressPayload = {
  status: string;
  progress?: number;
  file?: string;
};

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipelinePromise: Promise<any> | null = null;

function resetRmbgPipeline(): void {
  pipelinePromise = null;
}

/**
 * Load RMBG via `image-segmentation`.
 * Transformers.js v4's `background-removal` task rejects SegformerForSemanticSegmentation.
 * Pin `@huggingface/transformers` to 3.4.2.
 */
export async function ensureRmbgPipeline(
  onProgress?: (p: RmbgProgress) => void,
): Promise<unknown> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      await configureRmbgEnv();
      onProgress?.({
        phase: "download",
        message: "Loading background removal model…",
        percent: 0,
      });
      const { pipeline } = await import("@huggingface/transformers");
      return pipeline("image-segmentation", RMBG_MODEL_ID, {
        dtype: "q8",
        progress_callback: (data: ProgressPayload) =>
          logRmbgProgress(data, onProgress),
      });
    })();
  }
  return pipelinePromise;
}

/** Best-effort model load. Returns null on failure and clears the cached promise. */
export async function tryEnsureRmbgPipeline(
  onProgress?: (p: RmbgProgress) => void,
): Promise<unknown | null> {
  try {
    return await ensureRmbgPipeline(onProgress);
  } catch (error) {
    resetRmbgPipeline();
    console.warn(
      `[rmbg] Model unavailable: ${(error as Error).message}`,
    );
    return null;
  }
}
