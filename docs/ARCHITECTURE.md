# Architecture

How the atlas is built, and why. Sections follow the flow of the data: files → validated model → index → pages, then the
map, links, timeline, and finally the development-only editing tools.

## Guiding principles

1. **The map is the interface to the world, not the whole of it.** Geography is one *view* over a graph of things. People,
   gods, factions and events are entries in the same graph, and any entry can link to any other.
2. **Content is data.** Adding an entry never touches application code. The code reads whatever is in `src/data/` and
   `src/content/`.
3. **The URL is the source of truth.** What's selected, what the panel shows and where the map camera points are derived
   from the address. That gives shareable links, working back/forward, and nothing to keep in sync.
4. **An id is an identity.** Every entry has one globally unique id. Links, routes, Markdown files and saves are all keyed by
   it, and nothing else (a year, a name, a file name) is ever treated as an identity.
5. **Logic is separated from rendering.** Anything that can be a pure function (camera maths, level-of-detail rules,
   validation, link resolution, timeline layout, save rules) lives in `src/lib/`, has no React in it, and is unit-tested.
6. **Authoring tools are development-only.** They write files through a local dev server. They are compiled out of production
   builds, so the published site is a plain static, read-only page.
7. **Don't add what you can't justify.** Runtime dependencies: React, React Router, `react-markdown`, and two self-hosted fonts.
   No map library, no state-management library, no CSS framework.

## Stack

| Choice | Why |
| --- | --- |
| **Vite + React + TypeScript** | Fast feedback loop; the types double as documentation of the data format |
| **React Router** | Real URLs for every entry with almost no code |
| **Plain SVG, own camera** | The map is a few dozen shapes. A hand-written camera (pure maths plus one hook) gives full control over animation and avoids a mismatch between D3's DOM ownership and React's |
| **`react-markdown`** | Renders Markdown to React elements (never `dangerouslySetInnerHTML`), and exposes the syntax tree so cross-links can be added as a plugin. Raw HTML is not rendered |
| **CSS Modules + design tokens** | Scoped styles with no dependency; `tokens.css` holds the whole visual identity |
| **`import.meta.glob`** | Vite finds every JSON and Markdown file in the data folders. This is what makes "add a file, get an entry" work |
| **Vitest** | Same config as the build; tests run in milliseconds and include a validity check over the real data |

## Data model

```
src/data/world.json                world name + map coordinate space
src/data/locations/**.json         places      type: country | region | city | poi
src/data/entities/**.json          lore        type: person | faction | organization | deity | politics | culture
src/data/history/**.json           events      type: event  (+ year, order)
src/content/**/<id>.md             Markdown body; the file name IS the id
```

`src/types/world.ts` is the contract. Every entry has `id`, `name`, `type`, optional `summary` (Markdown) and optional
`relations: [{ label, target }]`. Places add `parent` plus a `polygon` or `coordinates`; events add an integer `year` and an
optional `order`. The `Entity` type is the union of all three families.

**Ids are unique across all kinds.** `validateWorld` enforces it (a person and a city can't share one), which is what
makes an id in prose resolve to exactly one entry.

**Events are separate files, not `{ year, events: [] }`.** Each event is a first-class entity with its own id, Markdown
body, connections and editor. `year` is only a sort/group key; grouping happens at load time in `groupByYear`. This
reads the same as nested JSON but means a year can never be mistaken for an identity.

### Loading and validation

```
 src/data/**/*.json ─┐
                     ├─ loadWorld.ts (globs) ─► validateWorld ─► issues ─► errors: app shows a readable report
 src/content/**/*.md ┘                              │                       warnings: dev banner / console
                                                    ▼
                                               WorldIndex ── React context (useWorld) ── pages & components
```

`validateWorld` parses each file by its `type`, reports problems across **all** files at once, names the file and says how
to fix it. **Errors** stop the app: bad id, missing name, invalid type, duplicate id (across kinds), malformed polygon,
malformed `relations`, event without an integer year, bad parent. **Warnings** don't: a relation or `[[link]]` to an unknown id,
an orphaned or duplicated Markdown file, geometry outside the map, a marker outside its parent's polygon.
The parent/child rules live in one table (`ALLOWED_PARENTS`), and rendering follows *the hierarchy in the data* rather
than assuming country → region → city.

`WorldIndex` is the single read-only lookup. Geography (`childrenOf`, `ancestorsOf`, `chainTo`, `boundsOf`, `svgPathOf`) and
everything cross-cutting: `entity(id)` for any kind, `loreOfType`, `events`, `markdownOf`, the link resolver (`links`), and
`backlinksOf(id)`. Components never walk raw data.

## Cross-links

A link is written as an **id or name in text**, never a route. Resolution is three small, pure steps.

1. **`LinkResolver` (`lib/content/links.ts`)** splits text into plain and link segments. It builds one token table from every
   entry: ids (3+ chars) and names (3+ chars), where a name that two entries share is dropped, and a name starting with
   "The" also registers its shortened form (5+ chars, unique). Matching is one regex, whole-token and case-sensitive,
   longest first. `[[id]]` and `[[id|text]]` are handled first, and are always emitted.
   Automatic links use a shared `linked` set, so each entry is linked **once per document**; an explicit link also
   counts as that first mention; and the entry never links to itself.
2. **`remarkEntityLinks` (`components/content`)** is a remark plugin that runs the resolver over the Markdown tree's text nodes
   and swaps matches for `link` nodes with an `entity:<id>` address. It skips headings, code, HTML and existing links.
3. **`RichText`** renders with `react-markdown`, mapping `entity:` links to `EntityLink`, which asks `entityPath(index, id)`
   for the route and renders a router `Link` (or a muted "broken link" span if the id is unknown).

`entityPath` is the only place that knows where things live: places → `atlasPath` (`/atlas/<chain>`), events →
`/history/<id>`, everything else → `/<category>/<id>`. Each entry's summary and Markdown body are joined and rendered as
one document, so "first mention" spans both.

**Backlinks** (`WorldIndex.backlinksOf`) come from the same resolver: an entry links to `X` if a `relation` targets it or its
text mentions it. A relation's label wins when both apply. `Connections` and `Linked from` render these, so the graph is
navigable in both directions while each fact is written once.

## Routing and pages

| Route | Page |
| --- | --- |
| `/atlas/*` | `AtlasPage`: map + side panel; the path decides the selection |
| `/people/:id?`, `/factions/…`, `/organizations/…`, `/pantheon/…`, `/politics/…`, `/culture/…` | `EncyclopediaPage` (one per category in `CATEGORIES`) |
| `/history/:id?` | `HistoryPage`: timeline + article |

Pages **normalise addresses** rather than fail: `/atlas/aurelia` redirects to the canonical chain; an id in the wrong section
(`/people/veyr`, `/atlas/veyr`, `/history/aurelia`) redirects to `entityPath`. Only unknown ids show "not found". Because
each link is an ordinary navigation, back/forward work and the address is shareable. Following a link to a place changes
the URL, `AtlasPage` derives the new selection, and the map camera flies there.

## The map

### One coordinate space
Countries, regions and cities share the space declared in `world.json`. Zooming into a region is just showing a smaller
rectangle of it, and a hand-traced Paint image can be used 1:1.

### Camera: `{ cx, cy, s }`
`lib/map/viewport.ts` is pure maths (fit bounds, zoom about a point, pan, clamp, interpolate); `hooks/useMapViewport.ts`
applies it to the DOM.

- **The camera lives in a ref and is written straight to the SVG `viewBox`,** not through React state. A 700 ms zoom is ~40
  frames; `setState` would re-render the whole map on each.
- **Scale is published as a CSS variable (`--s`, px per map unit).** Labels and markers divide by it, so they stay a constant
  size while the map zooms under them, with no per-frame JS. Borders use `vector-effect: non-scaling-stroke`.
- On resize the camera keeps the visible map's **top-left** fixed, so opening the side panel doesn't make the picture jump.
- Interpolation is geometric in scale, and proportional in visible width for the centre, which keeps motion even.

### Level of detail is a function
`lib/map/visibility.ts` maps the selection to what to draw (countries → regions of the selected country → markers of the
selected region). `lib/map/focus.ts` maps it to a camera target: fit the polygon; or centre a marker at 1.35× its region's
zoom, with extra room under the floating header.

### Interaction details
Drag vs click: pointer capture starts only after 5 px of movement, and the click that follows a drag is swallowed in the
capture phase. The tooltip's position is written to the DOM on `pointermove` (no re-render). Areas and markers are
keyboard-focusable.

## History timeline

`lib/content/timeline.ts` (pure): `compareEvents` sorts by year, then `order`, then name. `groupByYear` groups. `layoutTimeline`
positions groups left to right with gap `170 + 46·log2(1 + years)` px, capped at 540, with 150 px padding.
Distance grows with elapsed time but is compressed so clustered events don't overlap and a long age doesn't make a huge void.

`components/history/Timeline.tsx` renders it: a scroller with a line, `data-year` points, "N years" gap labels, and a dropdown
that expands in place. The track's `min-height` animates to make room for the expanded list (rows are a fixed height so
the maths is exact). Opening an event by link expands its year and `scrollIntoView`s it.

## Editing tools (development only)

Everything below is gated by `import.meta.env.DEV`, a build-time constant, and loaded with `lazy(() => import(…))`. A production
build contains none of it (verified by searching the built bundle).

### Rules first: `lib/content/savePlan.ts`
Pure and unit-tested, imported by the dev server. The rule that matters most: **create and update are different operations.**

- **create** refuses if the id is used by *anything* (any kind, any file). It never overwrites.
- **update** refuses unless exactly one file defines the id, and it must be the same kind.
- Only listed fields may change (`editableFields`): name, summary, relations for everyone; colour for areas; icon for points;
  year and order for events. Geometry, parent, id, type and unknown keys survive an edit. Clearing a field removes the key.
- `applyGeometry` replaces **only** `polygon`/`coordinates` (validated: ≥3 points, finite numbers).

### The dev server: `tools/atlasDevSave.ts`
A Vite plugin (`apply: 'serve'`) with two endpoints, both thin wrappers over `savePlan`:

| Endpoint | Purpose |
| --- | --- |
| `POST /__atlas/save` | Shapes. `create` a place, or `update` (replace only the shape of) an existing one |
| `POST /__atlas/entity` | Information. Update or create any non-place entry, or update a place's info, plus its Markdown body |

Safety: it exists only under `npm run dev`; writes only inside `src/data` and `src/content`; folders come from a fixed list; ids
must be valid slugs (so `../` is rejected); bodies are size-limited. It scans the data folders for who defines an id, so
files an author has reorganised are found and edited **in place**.

### Redraw is a session, not a form fill
An early version implemented "Redraw" by pre-filling the trace form's id/name/parent. That let a stale form follow you to
another place and overwrite the wrong entry, and let a name collision replace a file of a different kind. The tool now has two explicit sessions
(`components/map/trace/TraceTool.tsx`):

- **create**: needs a name, parent and an id nothing else uses.
- **redraw**: bound to one entity id. It sends only geometry, through `update`. The session ends if the selection changes, on Cancel,
  or when Trace is switched off, discarding drawn points. The old shape is rendered as a non-interactive ghost (`AreaStatus 'ghost'`)
  so there is only one live shape on screen.

Uniqueness is defended in depth: the form, the server (`planSave`), and the validator (duplicate ids are an error).

### The Edit dialog: `components/editor`
`EditButton` / `NewEntityButton` open `EntityEditor`, a native `<dialog>`: name, summary, a Markdown editor with Write/Preview
(the preview is the real `RichText`), an "insert link" picker, a connections editor, and kind-specific fields. It posts to
`/__atlas/entity`. Places are not creatable here (they need a shape); that's the Trace tool's job.

### After a save: don't trust the reload
After a data change Vite may hot-refresh in place, or reload the page, or both (a save that writes JSON and Markdown triggers two). The
editor therefore doesn't depend on any of it: it stores a **time-limited note** *before* sending the request (a reload can beat the
HTTP response), then reloads itself shortly after success. `FlashToast` shows the note, and, for a newly created entry, opens it, but
only when the load lands back on the address the save happened at, so someone who has already navigated elsewhere is never redirected.

## Visual design

*A cosy café meets a modern atlas.* Warm linen surfaces and espresso ink for the interface; a cool, quiet sea so the land is the
subject; one wine-coloured accent reserved for "you are here" (selected outline, selected marker, capitals, links). Fraunces
(a soft, warm serif) carries names and headings, Figtree carries UI text. Internal links are wine-coloured with a faint
underline: recognisable, but quiet. All tokens live in `src/styles/tokens.css`.

## Testing

Unit tests (Vitest) cover the pure logic: geometry and camera maths; validation across every kind (cross-kind id uniqueness,
event years, relations, warnings); the link resolver (explicit, id, name, "The" aliases, boundaries, first-mention,
ambiguity, self-links); timeline grouping and spacing; the save rules (create-never-overwrites, update-only-existing,
no kind changes, field whitelisting, geometry-only redraw, path-traversal rejection); URL resolution and the level-of-detail rules.
`worldData.test.ts` validates whatever world is in `src/data`; `demoWorld.test.ts` pins the bundled demo.

Interaction (click-to-zoom, drag not selecting, links across pages, timeline expansion, redraw sessions, Edit/Create, the "Saved" note)
was verified end-to-end in headless Chromium during development but is not yet automated. Adding Playwright tests for it is the natural next step.

## Extension plan and known limits

- **Search** (not built): a build-time index over names and Markdown text, using `WorldIndex` as the source. Static data, so no server.
- **Deleting and renaming ids from the UI** (not built): needs a rewrite of every link and relation that mentions the id; the
  backlink index already knows where they are.
- **Dragging individual corners** (not built): geometry is already plain data and `clientToMap` already converts screen → map coordinates.
- **Markdown:** CommonMark only (no tables), no raw HTML.
- **Dev reload:** edits reload the page (a few seconds in development). Hot-swapping the loaded world without a reload is possible but
  wasn't worth the complexity for a local authoring tool.

**Explicitly out of scope** (per the brief): accounts, auth, permissions, fog of war, secrets, a database, multiplayer, campaign tracking.
