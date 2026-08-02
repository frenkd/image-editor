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

## Notes

- Pin `@huggingface/transformers` to `3.4.2`
- Recent cutouts are stored in IndexedDB on this device
- `/remove-background` and a few aliases also work; the app lives at `/`

## License

[MIT](./LICENSE)
