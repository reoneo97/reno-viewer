# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # install deps
npm run dev          # dev server → http://localhost:5173 (or next available port)
npm run build        # tsc type-check + vite prod build
npm run preview      # serve dist/ locally
```

No test suite.

## Architecture

A single-page React 18 + TypeScript + Vite app. All state lives in `App.tsx` and flows down via props — no global state library. Nothing is persisted; state resets on refresh.

**Domain types** (`src/types.ts`): `Anchor` and `CandidateImage`. Anchor positions are stored as `x`/`y` percentages of image dimensions so they remain correct regardless of zoom/pan level.

**`FloorPlanCanvas`** — pan (drag) and zoom (scroll wheel) are implemented via CSS `transform: translate() scale()` on an inner wrapper. In edit mode, clicking places a pending "ghost" anchor; the user must hit the confirm button before it is committed. Clicking elsewhere replaces the pending anchor rather than stacking a second one.

**`AnchorPoint`** — in view mode, hover triggers `CandidatePopover`. In edit mode, click opens `AnchorEditModal`.

**`AnchorEditModal`** — accepts images via file picker, drag-drop, or clipboard paste. The paste handler attaches to `window` while the modal is mounted and is removed on unmount.

**`utils/exportSnapshot.ts`** — converts all object URLs (floor plan + every candidate image) to base64 via `FileReader`, then generates a self-contained vanilla-JS HTML file with everything inlined. The output has no React dependency and can be hosted on S3 as a static file for read-only sharing. Anchors without candidates still show a label popover in the snapshot.
