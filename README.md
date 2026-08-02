# Remove Background

Local-first, open-source background remover that runs in your browser.

- Drop or paste an image (Ctrl/Cmd+V)
- Cut out with [RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4) via [Transformers.js](https://huggingface.co/docs/transformers.js)
- Optionally recolor or crop the cutout, then download a PNG

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

## CLI (agents / scripts)

Remove a background from a local file or image URL (writes a PNG):

```bash
npm run remove-bg -- ./photo.jpg
npm run remove-bg -- ./car.jpg ./car.png --crop auto --advanced
npm run remove-bg -- ./logo.jpg ./logo.png --mode ink --color #00a894 --crop auto
```

Options include `--color`, `--crop auto`, `--advanced`, `--fill-holes`, `--solid`, and `--mode ink`. See [`/agent-skills/remove-background/SKILL.md`](https://cutbg.vercel.app/agent-skills/remove-background/SKILL.md).

Agent discovery: [`/llms.txt`](https://cutbg.vercel.app/llms.txt), [`/agents.txt`](https://cutbg.vercel.app/agents.txt). Web deep link: `/?src=<image-url>&color=%2300a894&crop=auto&advanced=1`.

## Notes

- Pin `@huggingface/transformers` to `3.4.2`
- Recent cutouts are stored in IndexedDB on this device
- `/remove-background` and a few aliases also work; the app lives at `/`

## License

[MIT](./LICENSE)
