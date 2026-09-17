# Handover: Activities App

Static site (no build step, no dependencies) for browsing a fixed list of
group-facilitation activities and stepping through a selected subset in a
focused session view.

## Current Project State

Everything below is implemented and has been manually verified in a
real browser (Playwright-driven Chromium, no console errors).

**Screen A — activity list (`#screen-list`)**
- Loads activities from `main.json` via `fetch` on page load.
- Header row: filter dropdown, "Clear all" button, "Start: N" button
  (in that order).
- Dropdown filters the visible list by `type` (value = raw type string,
  label = human-readable Title Case via `labelFor()`, e.g. `1t1` →
  "One to one", `energizer` → "Energizer"). Filtering only hides/shows
  rows — selection state is independent of the filter.
- Each row: type icon (stub emoji), title (`name`, or a generated
  fallback `"<type> exercise <n>"` if the entry has no `name`), a
  type label under the title, a select toggle (`+` / `✓` circle), and
  an expand/collapse chevron.
- Expanding a row reveals `description`, and `iteration`/`variant` if
  present, each under a small uppercase section label (those small
  section labels — "Iteration"/"Variant" — are the one place that's
  still deliberately all-caps via CSS; the *type* labels are not).
- "Clear all" deselects everything in one click; disabled when nothing
  is selected.
- "Start: N" reflects the live count of selected items; disabled at
  N = 0. Clicking it opens the session viewer with the selected items,
  in their current list order.
- The list itself is **static** — nothing is added/removed from it in
  the UI; selection only marks which existing items go into a session.

**Screen B — session viewer (`#screen-session`)**
- Close button (`×`) floats top-right (`position: absolute`), not
  inside a header bar — this was a deliberate fix so the icon rail
  below doesn't visually read as "part of the header".
- Everything else lives in `.session-content`, a flex column below the
  floating close button. It is **not** vertically centered (that was
  tried and then reverted) — content sits near the top, with just a
  10px `margin-top` on the icon rail (`#dots`) as breathing room under
  the close button.
- Icon rail (`#dots`): one large chip (56px, rounded) per selected
  item, wrapping and centered horizontally. No plain "dot" indicators
  — every item is shown as its actual type icon. The current item's
  chip is highlighted (accent border, now 3px, + tinted background).
  - Clicking a chip jumps directly to that item.
  - Chips are **drag-and-drop reorderable**, primarily via
    **SortableJS loaded from a CDN** (jsdelivr,
    `sortablejs@1.15.2/Sortable.min.js`, `animation: 150`) for smooth,
    touch-friendly dragging. If the CDN script fails to load
    (`onerror` sets `window.__sortableLoadFailed`), `app.js` falls
    back to a hand-rolled native HTML5 drag-and-drop implementation
    that produces the same result. Both paths funnel through
    `reorderAndAnimate(fromIndex, toIndex)`, which mutates
    `state.session.items`, re-renders, and plays a small **FLIP
    animation** (capture old chip positions → re-render → transform
    from old position back to rest over 200ms) so the icon swap is
    always animated even on the native-DnD fallback path (SortableJS
    already animates its own drag gesture; the FLIP step is a
    no-op/harmless there since positions already match). The
    currently-displayed item is tracked by `id`, not array index, so
    dragging never changes which activity is on screen, only the
    ordering around it.
  - Verified: in a sandboxed test environment where the CDN request
    was blocked (proxy 407), the fallback kicked in automatically and
    reordering still worked correctly with no functional errors.
- Card: current item's title + type label (compact — this was
  deliberately shrunk so the description below doesn't start too low
  on the screen).
- `‹` / `›` buttons flank the card: `‹` disabled on the first item.
  `›` is now simply **hidden** (`visibility: hidden` via an
  `is-hidden` class) on the last item — the old behavior where it
  turned into a `✓` "Finish" button and closed the session was
  removed. The only way to leave the session now is the close (`×`)
  button.
- Footer: description text, plus `iteration`/`variant` if present.

**Data (`main.json`)**
- 25 activities, valid JSON, hand-edited by the user throughout this
  session (types were renamed/added — this file should be treated as
  the source of truth and re-read before assuming its shape).
- Current known types: `1t1`, `energizer`, `improv`, `introductions`,
  `starter`. Entries are grouped/sorted by `type` (stable order within
  each group); re-sort if the user adds/edits entries and asks again.
- Fields per entry: `type` (required), `description` (required),
  `name` (optional — falls back to a generated title if absent),
  `iteration` (optional), `variant` (optional, seen once on "Tree").

**Known non-issue**: icons are emoji stubs by design (user asked to
stub icons for now). In one headless-Chromium test environment they
rendered as empty boxes (missing emoji font in that sandbox) — not
expected to be a problem in a normal desktop browser, but worth a
sanity check if icons ever look blank for the user.

**Color/accessibility**: `--accent` was changed from a lighter
terracotta (`#d97757`) to a darker, higher-contrast orange
(`#c2410c`, ~5.2:1 contrast against white/`--bg`) specifically so
accent-colored elements (selected toggle, Start button, current-chip
border) are distinguishable by lightness contrast alone, not just
hue — the main lever for colorblind-friendliness. If the palette
changes again, re-check contrast against both `--bg` and `--surface`,
not just against white.

`.activity-list` has a 25px `margin-bottom` (in addition to its
existing padding) — a spacing tweak, not layout-load-bearing.

## Architecture & File Map

| File | Responsibility |
|---|---|
| `index.html` | Markup for both screens (`#screen-list`, `#screen-session`) inside a single-page shell (`.app`). No routing — screens are just toggled via a CSS class (`.active`) from JS. Loads the SortableJS CDN script (with an `onerror` fallback flag), then `app.js`. |
| `app.js` | All logic. Single `state` object (`activities`, `selected: Set`, `expanded: Set`, `filterType`, `session`). No framework, no modules — one file, top-level `init()` call at the bottom. Key functions: `loadActivities()` (fetch + assign `id`/`typeIndex`), `renderList()`, `renderSession()`, `setUpReordering()` (SortableJS init or native-DnD fallback), `reorderAndAnimate()` + `captureChipRects()`/`playFlipAnimation()` (shared reorder + FLIP animation for both DnD paths), `iconFor()`/`labelFor()` (type → emoji / Title Case display label), `titleFor()` (name fallback), `clearSelection()`. |
| `style.css` | All styling, plain CSS custom properties (`:root` vars for colors/radius). Mobile-first, single-column layout capped at 480px (`.app { max-width: 480px }`). No preprocessor, no framework. Includes styling for both the native `.dragging` class and SortableJS's own `.sortable-ghost`/`.sortable-chosen` classes so the drag visuals match regardless of which path is active. |
| `main.json` | Data source, fetched at runtime. Not bundled/inlined — the app must be served over HTTP (see below), not opened via `file://`. |
| `.gitignore` | Scoped to an allowlist (`*` then `!`-exceptions) so only `index.html`, `style.css`, `app.js`, `main.json`, `doc.md`, and `.gitignore` itself are ever tracked — the working directory has a lot of unrelated dotfiles/IDE config that must stay untracked. |

No `package.json`, no build tool, no test suite. The only external
dependency is SortableJS, loaded at runtime from
`cdn.jsdelivr.net` — nothing to install locally, but the app needs
outbound internet access for the smooth drag experience (it still
works offline via the fallback, just with plain native DnD).
"Testing" so far has been manual: serve with `python3 -m http.server`,
drive with a Playwright install borrowed from another project on the
machine (`/home/stan/start/e2etests/node_modules/playwright` — not
part of this repo).

## Important Context for Next Session

- **Must be served over HTTP, not opened directly.** `app.js` uses
  `fetch("main.json")`, which fails under `file://` due to CORS. Use
  any static file server (`python3 -m http.server`, `npx serve`, etc.)
  for local testing.
- **`main.json` is user-edited live and frequently.** Types have been
  renamed/added several times directly in the user's IDE mid-session,
  sometimes leaving it briefly invalid JSON while typing. Always
  re-`Read` the file immediately before editing it, and don't assume
  the type list above is still exhaustive.
- **Nothing has been committed to git.** `git status` currently shows
  `main.json` modified and `.gitignore`/`app.js`/`doc.md`/`index.html`/
  `style.css` untracked. Ask before committing.
- **Original design reference** was a hand-drawn sketch (two screens,
  labeled A and B) which drove the initial layout decisions. The
  session-viewer layout has since moved away from the sketch in a few
  deliberate ways (no header bar for the icon rail, larger icons
  instead of small dots, drag-to-reorder) per follow-up feedback — the
  sketch is not in the repo, so this doc plus the code is now the
  authoritative spec, not the original drawing.
- **Type display labels**: `labelFor()` in `app.js` Title-Cases any
  type it doesn't recognize, plus a manual override map
  (`TYPE_LABELS`) for cases that need more than capitalization (only
  `1t1` → "One to one" so far). Extend `TYPE_LABELS` / `TYPE_ICONS` if
  more types need a nicer label/icon than the automatic capitalization
  gives.
- **SortableJS version is pinned** (`1.15.2`) in the CDN URL in
  `index.html`. If drag behavior ever needs to change, that's the one
  place to look; the fallback path in `app.js`
  (`bindNativeDragAndDrop`) is intentionally kept simple and only
  needs to stay behaviorally equivalent, not visually identical.
