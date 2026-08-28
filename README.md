# QUILL

QUILL is an experimental writing sandbox for shaping living drafts and ink trails.

It is intentionally open-ended: you seed a phrase, tune the pressure, and the canvas grows a drifting field of glyphs, echoes, and handwritten marks.

## What it is for

- Fast visual writing experiments
- Tinkering with motion, color, and density
- A small, local-first playground you can keep reshaping

## Run it

```bash
npm install
npm run dev
```

## Build and check

```bash
npm run check
```

## Controls

- Change the seed phrase to generate a different draft
- Adjust bloom, drift, gravity, pulse, and chroma
- Click or drag on the canvas to draw living ink
- Use `Freeze` to pause the draft and inspect it
- Use `Share` to copy the current draft URL

## State

QUILL keeps the current draft in the URL hash instead of writing persistent local state.
That makes it easy to share and keeps the app lightweight on disk.

## Shortcuts

- `R` randomizes the draft
- `F` toggles freeze
- `C` captures a PNG
- `X` clears the canvas
- `Space` plants an ink mark at center
