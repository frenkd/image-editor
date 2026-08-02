---
name: remove-background
description: >
  Remove image backgrounds locally with RMBG-1.4 (Transformers.js).
  Use when the user wants a cutout PNG from a local file or image URL,
  or asks to remove a background via cutbg / this repo.
---

# Remove background (cutbg)

Local-first background removal. Images are not uploaded to cutbg servers.
The model (`briaai/RMBG-1.4`) downloads from Hugging Face on first use.

## Preferred: CLI in this repo

From the project root (after `npm install`):

```bash
npm run remove-bg -- <input> [output.png] [--color #rrggbb]
```

- `<input>`: local path or `http(s)` image URL
- Default output: `<name>-cutout.png` next to the input (or cwd for URLs)
- `--color #rrggbb`: fill opaque cutout pixels with a solid color (logo recolor)

Examples:

```bash
npm run remove-bg -- ./photo.jpg
npm run remove-bg -- https://example.com/car.jpg ./car.png
npm run remove-bg -- ./logo.jpg ./logo.png --color #00a894
```

The CLI prints the `file://` URL of the written PNG on the last stdout line.

## Browser deep link

Open (CORS must allow the image URL):

`https://cutbg.vercel.app/?src=<encoded-image-url>`

Also accepted: `url`, `image`. Processing runs in the visitor's browser tab.

## Notes

- Prefer the CLI for agents (no CORS, deterministic file output).
- Optional Advanced cleanup (speckles / tiny holes) exists only in the web UI.
- Site docs for humans: `/how-it-works`, `/faq`, `/use-cases`.
