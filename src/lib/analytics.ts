import { track } from "@vercel/analytics";

/** Who started a cutout session (Vercel custom-event property). */
export type CutoutClient = "human" | "agent" | "deep_link";

const AGENT_UA =
  /bot|claude|anthropic|chatgpt|gptbot|openai|codex|cursor|langchain|perplexity|gemini|crawl|spider|agent/i;

export function resolveCutoutClient(
  params: URLSearchParams,
  userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "",
): CutoutClient {
  const via = (
    params.get("via") ||
    params.get("client") ||
    params.get("from") ||
    ""
  )
    .trim()
    .toLowerCase();
  if (
    via === "agent" ||
    via === "ai" ||
    via === "llm" ||
    parseTruthyFlag(params.get("agent"))
  ) {
    return "agent";
  }
  if (via === "human" || via === "user" || via === "ui") {
    return "human";
  }
  if (userAgent && AGENT_UA.test(userAgent)) return "agent";
  return "deep_link";
}

function parseTruthyFlag(v: string | null): boolean {
  if (v == null) return false;
  const t = v.trim().toLowerCase();
  return t === "" || t === "1" || t === "true" || t === "yes" || t === "on";
}

/** Safe no-op in dev / if Analytics is blocked. */
export function trackCutoutStart(
  client: CutoutClient,
  opts: {
    hasColor: boolean;
    hasCrop: boolean;
    advanced: boolean;
  },
) {
  try {
    track("cutout_start", {
      client,
      has_color: opts.hasColor,
      has_crop: opts.hasCrop,
      advanced: opts.advanced,
    });
  } catch {
    /* ignore */
  }
}

export function trackAgentGuideView() {
  try {
    track("agent_guide_view", { client: "human_or_agent" });
  } catch {
    /* ignore */
  }
}
