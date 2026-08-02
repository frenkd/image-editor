/** Shared FAQ copy for the FAQ page and JSON-LD. */

export const FAQ_ITEMS = [
  {
    q: "Do images leave my device?",
    a: "No. Processing runs in your browser. We do not receive your photos. Recent cutouts stay in this browser only.",
  },
  {
    q: "Do you use analytics?",
    a: "Yes. The hosted site uses Vercel Analytics for anonymous page-view metrics. It does not receive your images. See the Privacy page for details.",
  },
  {
    q: "What about the Hugging Face download?",
    a: "That request fetches the model weights, not your image. Your photo never goes to Hugging Face as part of this flow.",
  },
  {
    q: "Is it free?",
    a: "Yes. The app is open source, and the cutout runs with the local model in your browser.",
  },
  {
    q: "Why is the first run slow?",
    a: "The model has to download and load once. After that it is cached and much quicker.",
  },
  {
    q: "Where are recent cutouts stored?",
    a: "In this browser only (IndexedDB). Clearing site data removes them. They are not synced to a server.",
  },
  {
    q: "Can I recolor or crop after removal?",
    a: "Yes. After the cutout, use Color or Crop, then download a PNG.",
  },
  {
    q: "Can AI agents use this?",
    a: "Yes. See /for-agents. Agents GET /api/capabilities?via=agent (or /llms.txt), then open /?src=<image-url>&via=agent&crop=auto. No clone required. via=agent tags the session in Vercel Analytics separately from human uploads.",
  },
  {
    q: "Can analytics tell humans and agents apart?",
    a: "Page views alone are a weak signal. We emit custom Vercel Analytics events: cutout_start (client=human or agent), tool_color, tool_crop, tool_advanced for studio tools, plus agent_discover on /api/capabilities. Filter those in the Analytics Events panel. Images are never sent to analytics.",
  },
] as const;
