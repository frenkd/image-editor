---
name: remove-background
description: >
  Remove image backgrounds with cutbg over the web. Discover via GET
  /api/capabilities, then open /?src=<image-url>&via=agent. Optional color,
  crop, and cleanup query params. No repo clone. Use for Claude, ChatGPT,
  Codex, Cursor, and similar agents.
---

# Remove background (cutbg)

Local-first. Images are not uploaded to cutbg servers. The model
(`briaai/RMBG-1.4`) downloads from Hugging Face on first run in the tab.

Guide: https://cutbg.vercel.app/for-agents

## 1. Discover (HTTP request)

```
GET https://cutbg.vercel.app/api/capabilities?via=agent
```

Also: `/llms.txt`, `/agents.txt`, `/agents.json` (CORS enabled).

## 2. Open the web deep link (no clone)

```
https://cutbg.vercel.app/?src=<encoded-image-url>&via=agent&crop=auto&advanced=1
```

Always include `via=agent` so usage is tagged as agent traffic in Analytics.

| Param | Purpose |
|-------|---------|
| `src` / `url` / `image` | Image URL (browser CORS must allow it) |
| `via=agent` | Tag cutout as agent usage |
| `color` / `fill` | `#rrggbb` recolor after cutout |
| `crop=auto` or `x,y,w,h` | Crop after cutout |
| `advanced=1` | Speckle + tiny hole cleanup |

### Prompt sketch

```
GET https://cutbg.vercel.app/api/capabilities?via=agent
Open https://cutbg.vercel.app/?src=<IMAGE_URL>&via=agent&crop=auto
Do not clone the GitHub repo unless the user asks.
```

## Discovery

- https://cutbg.vercel.app/api/capabilities?via=agent
- https://cutbg.vercel.app/llms.txt
- https://cutbg.vercel.app/agents.txt
- https://cutbg.vercel.app/for-agents
