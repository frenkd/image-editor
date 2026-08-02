# Image Editor

Local-first, open-source image tools that run in your browser.

- **Remove background**: on-device cutouts with [RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4) via [Transformers.js](https://huggingface.co/docs/transformers.js), plus a color overlay (black / white / picker) that keeps the alpha mask
- **Crop**: freeform or locked aspect ratios for screenshots and photos

Nothing is uploaded to a server. The background-removal model downloads from Hugging Face on first use (~40MB) and is cached by the browser afterwards.

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

```bash
npm run build   # production build → dist/
npm run preview # serve the build locally
```

## Tools

| Route | What it does |
| --- | --- |
| `/` | Tool picker |
| `/remove-bg` | Background removal + color overlay on the cutout |
| `/crop` | Interactive crop with aspect presets |

Paste images from the clipboard on the remove-bg and crop screens.

## Background removal notes

- Model ID: `briaai/RMBG-1.4`
- Task: `image-segmentation` (not the v4 `background-removal` task; Segformer is rejected there)
- Pinned dependency: `@huggingface/transformers@3.4.2`
- Cold start can take 15–60s while the model downloads; warm runs are much faster

Pipeline adapted from the [sloai-org](https://github.com/sloai-org) dither / event-image tooling.

## Stack

- Vite + React + TypeScript
- React Router
- Transformers.js (WebGPU / WASM as available)

## License

[MIT](./LICENSE)
