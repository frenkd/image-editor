# Contributing

Thanks for helping improve Image Editor.

## Setup

```bash
npm install
npm run dev
```

## Guidelines

- Keep tools local-first: no required backend for the core edit flows
- Prefer small, focused PRs (one tool or fix at a time)
- Match existing TypeScript / React patterns
- Pin `@huggingface/transformers` carefully; `3.4.2` is intentional for RMBG-1.4

## Checks

```bash
npm run lint
npm run build
```

## License

By contributing, you agree your changes are licensed under the MIT License.
