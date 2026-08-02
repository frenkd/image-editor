---
name: remove-background
description: >
  Remove image backgrounds locally with RMBG-1.4, then optionally recolor,
  crop, and clean the mask. Use for cutouts, logo recolor, or when the user
  points at cutbg / this repo.
---

# Remove background (cutbg)

Local-first. Images are not uploaded to cutbg servers. The neural model
(`briaai/RMBG-1.4`) downloads from Hugging Face on first RMBG run.

## Preferred: CLI

```bash
npm install
npm run remove-bg -- <input> [output.png] [options]
```

`<input>` may be a local path or `http(s)` image URL.
Last stdout line is the `file://` URL of the written PNG.

### Options

| Flag | Purpose |
|------|---------|
| `--color #rrggbb` | Recolor all opaque pixels (logo fill) |
| `--crop auto` | Tight crop to solid content |
| `--crop x,y,w,h` | Manual crop in pixels |
| `--pad 0.03` | Padding for `--crop auto` |
| `--remove-speckles` | Drop small leftover BG islands |
| `--fill-holes` | Fill tiny enclosed mask holes |
| `--fill-holes=all` | Fill every enclosed hole |
| `--solid` | Hard 0/255 alpha + dilate (seal gaps) |
| `--advanced` | `--remove-speckles` + `--fill-holes` |
| `--mode ink` | Luminance ink cutout (logos on paper; skips model) |
| `--ink-max 96` | Dark threshold for `--mode ink` (0-255) |

### Examples

```bash
# Photo cutout
npm run remove-bg -- ./photo.jpg

# Product cutout + auto crop + light cleanup
npm run remove-bg -- ./car.jpg ./car.png --crop auto --advanced

# Logo on paper: ink mask + brand color + crop
npm run remove-bg -- ./logo.jpg ./logo.png --mode ink --color #e85d04 --crop auto

# Neural cutout + solid color (people / products)
npm run remove-bg -- ./shot.jpg ./shot.png --color #000000 --crop auto
```

### Tips

- Photos / people / cars: default RMBG mode. Add `--advanced` and `--crop auto` as needed.
- Logos printed on paper: prefer `--mode ink` + `--color`, not `--fill-holes=all` (that can weld letters into a blob).
- Thin strokes: avoid heavy morphology; `--solid` dilates slightly.

## Browser deep link

`https://cutbg.vercel.app/?src=<encoded-image-url>&color=%2300a894&crop=auto&advanced=1`

| Param | Purpose |
|-------|---------|
| `src` / `url` / `image` | Image URL (CORS must allow) |
| `color` / `fill` | `#rrggbb` recolor after cutout |
| `crop=auto` or `x,y,w,h` | Crop after cutout |
| `advanced=1` | Speckle + tiny hole cleanup |
| `speckles=1` / `fill-holes=1` | Individual cleanup flags |

Full CLI options (including `--mode ink` for logos) are the reliable agent path.

## Discovery

- https://cutbg.vercel.app/llms.txt
- https://cutbg.vercel.app/agents.txt
- https://cutbg.vercel.app/agents.json
