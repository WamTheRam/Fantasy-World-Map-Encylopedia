# Architecture

This document explains how the atlas is built and why, and how the later phases (content, encyclopedia, editor) are
meant to slot in without rework.

## Guiding principles

1. **The map is the interface to the world, not the whole of it.** Geography is one *view* over a graph of things.
   Everything else (people, gods, events) will link into the same graph.
2. **Content is data.** Adding a place never touches application code. The code reads whatever is in `src/data/`.
3. **The URL is the source of truth.** What's selected, what the panel shows and where the camera points are all
   derived from the address. That gives shareable links, a working back button, and one fewer thing to keep in sync.
4. **Logic is separated from rendering.** Anything that can be a pure function (camera maths, level-of-detail rules,
   validation, path resolution) lives in `lib/`, has no React in it, and is unit-tested.
5. **Don't add what you can't justify.** The runtime dependencies are React, React Router and two self-hosted
   fonts. There is no map library and no state-management library.

## Stack

| Choice | Why |
| --- | --- |
| **Vite + React + TypeScript** | Fast feedback loop, ubiquitous, and the types double as documentation of the data format |
| **React Router** | Real URLs (`/atlas/kingdom-of-valen/central-plains`) with almost no code |
| **Plain SVG, own camera** | The map is a few dozen shapes. A hand-written camera (~100 lines of pure maths plus one hook) gives full control over animation and avoids a mismatch between D3's DOM ownership and React's. D3 would earn its place for projections or thousands of features, neither of which applies |
| **CSS Modules + design tokens** | Scoped styles with no dependency and no build config; one `tokens.css` holds the whole visual identity |
| **`import.meta.glob`** | Vite finds every JSON file in `src/data/locations/`. This is the mechanism that makes "add a file, get a place" work |
| **Vitest** | Same config as the build. Tests run in milliseconds and include a validity check over the real data |

## Data flow

```
 src/data/**/*.json
        │  import.meta.glob (loadWorld.ts)
        ▼
  validateWorld ──► issues (errors stop the app and are shown as a readable report; warnings are advisory)
        │
        ▼
    WorldIndex  ◄── the single read-only lookup: get(id), childrenOf, ancestorsOf, chainTo, boundsOf …
        │  React context (useWorld)
        ▼
   AtlasPage ── URL ──► resolveAtlasPath ──► selected location
        │
        ├── MapCanvas      selected id ─► computeVisibility (what to draw)
        │                              └► computeFocusView  (where the camera goes)
        ├── SidePanel      selected location + index ─► LocationInfo
        └── Breadcrumbs    index.chainTo(selected)
```

User input flows the other way: a click calls `navigate(atlasPath(id))`, the URL changes, and everything re-derives.
No component keeps its own copy of "what's selected".

## The map

### One coordinate space
Countries, regions and cities all share the coordinate space declared in `world.json`. There is no per-level local
coordinate system, so "zooming into Central Plains" is only "show a smaller rectangle of the same space." It also means
a hand-traced Paint image can be used 1:1 (see the README).

### Camera: `{ cx, cy, s }`
`lib/map/viewport.ts` is pure maths: fit bounds, zoom about a point, pan, clamp, interpolate. `hooks/useMapViewport.ts`
applies it to the DOM. Two deliberate details:

- **The camera lives in a ref and is written straight to the SVG `viewBox`,** not through React state. A 700 ms zoom is
  ~40 frames; going through `setState` would re-render the entire map on each. Only *selection* changes render.
- **Scale is published as a CSS variable (`--s`, px per map unit).** Labels and markers divide by it
  (`font-size: calc(14px / var(--s))`, `transform: scale(calc(1 / var(--s)))`), so they stay a constant readable size
  while the map zooms beneath them, with no JS per frame. Borders use `vector-effect: non-scaling-stroke` for the same reason.

Scale is stored in absolute pixels per unit, and on container resize the camera keeps the visible map's *top-left*
fixed. That's why opening the side panel (which narrows the map) doesn't make the picture jump.

Zoom animations interpolate scale geometrically and the centre in proportion to the change in visible width, which
keeps the motion even instead of "swooping."

### Level of detail is a function, not scattered `if`s
`lib/map/visibility.ts` takes the selection and returns which regions and markers to draw. The rules (countries →
regions of the selected country → markers of the selected region) are readable in one place and unit-tested.

### Interaction details worth knowing
- Drag vs click: pointer capture begins only after 5 px of movement, and the click that follows a drag is swallowed
  in the capture phase. Without this, panning would select whatever polygon you started on.
- The tooltip's position is written to the DOM on `pointermove`. Hovering never re-renders the map.
- Markers and areas are keyboard focusable (`Tab`, `Enter`/`Space`).

## Data model and validation

`types/world.ts` is the contract; `lib/content/validateWorld.ts` enforces it with messages written for the person
editing the files ("`"centrl-plains"` … no location with that id exists"). Parent/child rules live in one table
(`ALLOWED_PARENTS`), and the rendering and navigation code follow *the hierarchy in the data* rather than assuming
country→region→city. So a point of interest nested inside a city already works.

## Extension plan

The MVP was built so each later phase is additive.

**Phase 2: content and search**
- Add an optional `"content": "…/aurelia.md"` field per entity; load Markdown with a second `import.meta.glob`
  (`?raw`) and render it inside `LocationInfo`. The `summary` field remains as the short blurb used in lists and search.
- Cross-references: a generic *entity registry* (`id → { kind, name, path }`) generalises `WorldIndex`. Markdown links such
  as `[Veyr](pantheon:veyr)` resolve through the registry to routes. The locations already use exactly this model.
- Search: build an in-memory index at load time over names and Markdown text. Static data, so no server.

**Phase 3: encyclopedia**
- Each category (`people`, `factions`, `pantheon`, `history`…) is a JSON folder + Markdown folder + a route, reusing the
  same entity, panel and link components. `lib/navigation/sections.ts` already lists them; flipping `enabled` turns
  a menu entry on. History is its own timeline view and does not move the map.

**Phase 4: map editor**
- A first slice already exists and is dev-only: the **trace tool** (`components/map/trace/`). It is loaded with
  `lazy(() => import(…))` behind `import.meta.env.DEV`, a build-time constant, so production bundles contain none of it.
  It draws into a `<g>` slot inside the map's SVG, so the preview shares the map's zoom, and reuses
  `clientToMap` for screen → map coordinates and the same level-of-detail rules to decide which corners to snap to.
- Saving goes through a small Vite dev-server plugin (`tools/atlasDevSave.ts`), `POST /__atlas/save`. It only exists under
  `npm run dev`, only writes inside `src/data/locations/`, whitelists folder names and validates ids. It *merges* into an
  existing file (`mergeLocation`) so re-tracing a shape never discards the summary or colour written by hand.
  The deployed site stays fully static.
- Still to build: dragging individual vertices, and delete from the UI.

**Explicitly out of scope** (per the brief): accounts, auth, permissions, fog of war, secrets, database, multiplayer,
campaign tracking. Nothing here prevents them, but nothing anticipates them either.

## Visual design

*A cosy café meets a modern atlas.* Warm linen surfaces and espresso ink for the interface; a cool, quiet sea so the
land is the subject; one wine-coloured accent reserved for "you are here" (the selected outline, the selected marker,
capitals). Fraunces (a soft, warm serif) carries names and headings, Figtree carries UI text. Texture is limited to a
fine paper grain on the sea and a soft coastal halo. All tokens are in `src/styles/tokens.css`.

## Testing

`npm test` covers the pure logic (geometry, camera maths, validation, URL resolution, level-of-detail) and validates
the real data. Interaction behaviours (click-to-zoom, drag not selecting, deep links, redirects, Escape, breadcrumbs,
panel hide/show, menu) were verified end-to-end in headless Chromium during development. Adding Playwright tests
for those is a sensible next step (Phase 5).
