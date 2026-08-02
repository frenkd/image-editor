# Remove Background

Local-first, open-source background remover for humans and AI agents.

- Drop or paste an image (Ctrl/Cmd+V)
- Cut out with [RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4) via [Transformers.js](https://huggingface.co/docs/transformers.js)
- Optionally recolor or crop the cutout, then download a PNG
- Agents: read [`/llms.txt`](https://cutbg.vercel.app/llms.txt) and open `/?src=<image-url>` (see [for agents](https://cutbg.vercel.app/for-agents))

Nothing is uploaded to a server. The model downloads from Hugging Face on first use (~40MB) and is cached afterwards.

## Quick start

```bash
npm install
npm run dev
```

```bash
npm run build
npm run preview
```

## Agents (web first)

No clone required. Point Claude, ChatGPT, Codex, or Cursor at:

- Guide: https://cutbg.vercel.app/for-agents
- HTTP: `GET https://cutbg.vercel.app/api/capabilities?via=agent`
- Discovery: [`/llms.txt`](https://cutbg.vercel.app/llms.txt), [`/agents.txt`](https://cutbg.vercel.app/agents.txt)
- Deep link: `https://cutbg.vercel.app/?src=<image-url>&via=agent&crop=auto&advanced=1`

`via=agent` tags Vercel Analytics (`cutout_start` with `client=agent`). Color, crop, and advanced cleanup also emit `tool_color`, `tool_crop`, and `tool_advanced`. Skill: [`/agent-skills/remove-background/SKILL.md`](https://cutbg.vercel.app/agent-skills/remove-background/SKILL.md).

## Optional CLI (local scripts)

```bash
npm run remove-bg -- ./photo.jpg
npm run remove-bg -- ./car.jpg ./car.png --crop auto --advanced
npm run remove-bg -- ./logo.jpg ./logo.png --mode ink --color #e85d04 --crop auto
```

## Notes

- Pin `@huggingface/transformers` to `3.4.2`
- Recent cutouts are stored in IndexedDB on this device
- `/remove-background` and a few aliases also work; the app lives at `/`

## License

[MIT](./LICENSE)
