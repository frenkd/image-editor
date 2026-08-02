import { track } from "@vercel/analytics/server";

export const config = { runtime: "edge" };

const BODY = {
  name: "cutbg",
  site: "https://cutbg.vercel.app",
  guide: "https://cutbg.vercel.app/for-agents",
  discovery: {
    llms_txt: "https://cutbg.vercel.app/llms.txt",
    agents_txt: "https://cutbg.vercel.app/agents.txt",
    agents_json: "https://cutbg.vercel.app/agents.json",
    skill: "https://cutbg.vercel.app/agent-skills/remove-background/SKILL.md",
  },
  preferred: "web_deep_link",
  clone_required: false,
  web_deep_link:
    "https://cutbg.vercel.app/?src=<encoded-image-url>&via=agent&crop=auto&advanced=1",
  web_query_params: [
    "src",
    "url",
    "image",
    "via",
    "agent",
    "color",
    "fill",
    "crop",
    "advanced",
    "speckles",
    "fill-holes",
  ],
  notes: [
    "No repo clone required.",
    "Open the deep link in a browser tab (CORS must allow the image URL).",
    "Add via=agent so Vercel Analytics can tag the session as agent usage.",
    "Cutout runs in the browser; images are not uploaded to cutbg servers.",
  ],
  model: "briaai/RMBG-1.4",
  uploads_images_to_site: false,
} as const;

/**
 * Agent-facing JSON over HTTP (GET).
 * Adds CORS so tools can fetch from any origin.
 * Optional ?via=agent tags a discovery hit in Vercel Analytics.
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders(),
    });
  }

  const url = new URL(req.url);
  const via = (url.searchParams.get("via") || "request").slice(0, 64);
  try {
    await track("agent_discover", { via, endpoint: "capabilities" });
  } catch {
    /* analytics must never break discovery */
  }

  if (req.method === "HEAD") {
    return new Response(null, { status: 200, headers: corsHeaders() });
  }

  return new Response(JSON.stringify(BODY, null, 2), {
    status: 200,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=120",
    },
  });
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
  };
}
