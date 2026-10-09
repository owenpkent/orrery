# Working on Orrery

Orientation for anyone arriving cold, including AI coding agents.

## What this project is

A static website that shows Earth's calendar systems side by side, how they overlap and relate to
celestial events (solstices, equinoxes, moons, eclipses), and one invented calendar, the Orrery
calendar. Vite, vanilla TypeScript, SVG. No UI framework, no backend.

## Commands

```bash
python run.py            # dev server (port 5174), opens the browser
python run.py preview    # build, then serve dist/ at http://localhost:4173/orrery/
npm run verify           # tsc + eslint + vitest. Run this before you finish.
npm run format           # prettier --write
npm run build            # type-check, then static site into dist/
```

`npm run verify` is the gate. CI also runs `prettier --check`, the build, and a no-em-dash scan.

## Layout

```
src/calendars/   one file per calendar, types.ts (the contract), index.ts (registry), jdn.ts (pivot)
  intl.ts        the single Intl.DateTimeFormat adapter used by the Intl-backed calendars
  orrery.ts, orrery-config.ts   the invented calendar and every tunable choice in it
src/sky/         astronomy-engine wrapper with a per-year event cache
src/views/       home.ts, today.ts, timeline.ts, ring.ts, orreryCalendar.ts (one per tab)
src/scene/       orreryScene.ts, the three.js hero scene; imported only via dynamic import from home.ts
src/styles/      tokens.css (every design token, dark default + light), base.css (glass, buttons),
                 shell.css (nav pill, date dock, atmosphere), one css file per view
src/ui/          dom helpers, the shared date control (a fixed glass dock), formatting, fx.ts (spotlight,
                 reveals, text-swap animation, view transitions, tween; all honour reduced motion)
src/sky/orbit.ts Earth's orbital angle helpers shared by the hero scene and the ring view
src/state.ts     selected day (JDN) + current view, mirrored to the URL hash
tests/           pure logic, runs under Node with no DOM
docs/            CALENDARS.md (every calendar), ORRERY_CALENDAR.md (the spec)
```

## Rules that are not negotiable

1. **No em dashes (U+2014)** in code, docs or UI text. CI greps for it. Use a comma, colon,
   parentheses or a full stop.
2. **Mouse-first UI.** Nothing may require typing. Every action needs a button, slider or click
   target of at least 44px, and must also work from the keyboard. Keep light and dark themes working
   (tokens are CSS variables in `src/styles/tokens.css`). Earth can be dragged by mouse in the hero
   and the ring view; both also expose a keyboard slider.
3. **JDN is the pivot.** A calendar converts from the integer JDN of a UTC civil day (2000-01-01 is
   2451545). Do not pass `Date` objects between modules.
4. **Docs stay true.** Changing a calendar's algorithm, epoch or limits means editing
   `docs/CALENDARS.md` in the same commit. Changing the Orrery rules means editing
   `docs/ORRERY_CALENDAR.md` and the config together.
5. **Orrery choices live in `orrery-config.ts`**, not scattered through the code. The placeholder
   month and weekday names are meant to be renamed by the owner.
6. **Pin TypeScript to 5.x.** typescript-eslint's peer range excludes newer majors. Dependabot is
   configured to ignore a TypeScript major bump.
7. **Every calendar needs fixtures** from a published source in `tests/calendars.test.ts`; the
   registry test covers the contract (bands tile the window, labels are sane).

## Adding a calendar

See the end of `docs/CALENDARS.md`. In short: new file, register it in `src/calendars/index.ts`,
add fixtures, update the docs and the calendar count in the registry test.

## Looking at it (screenshots)

Verify visually after any UI change. Chrome and Edge live under Program Files on Windows.

```bash
npm run build
npx vite preview --port 4173 --strictPort &
CH="/c/Program Files/Google/Chrome/Application/chrome.exe"
"$CH" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=8000 \
  --window-size=1400,1000 --screenshot="C:/path/out.png" \
  "http://localhost:4173/orrery/#/timeline?d=2026-10-09"
```

For WebGL in headless Chrome add `--use-angle=swiftshader --enable-unsafe-swiftshader`. Views are
`#/home` (default), `#/today`, `#/timeline`, `#/ring`, `#/orrery`; `d=YYYY-MM-DD` sets the selected day. Read
the PNG to check it. Note that `vite preview` serves under `/orrery/` (the Pages base), so a URL
without that prefix returns the HTML for scripts and renders a blank page. For hover, wheel or
colour-scheme checks, drive Chrome over the DevTools protocol (`--remote-debugging-port`, then
`Input.dispatchMouseEvent` and `Page.captureScreenshot`); headless `--screenshot` cannot hover.
Narrow widths (390x844) are worth a look too.

## Searching

Use ripgrep (`rg`), not grep.

## Known gotchas

- `Intl` output differs slightly between ICU versions; the fixtures in the calendar tests pin the
  dates that matter. A failing Intl fixture after a Node upgrade means the ICU data changed.
- The Timeline redraws the whole SVG on every pointer move. It is fast enough for about 20 lanes
  over a few years; if you add lanes or zoom limits, watch the frame rate.
- Month-start scanning in the Intl adapter is cached per JDN. Do not call `fromJDN` with
  fractional values.
