# Project Orbis — v0.0.1

A daily collaborative myth-map game where you grow a shared world one
constrained, context-aware action at a time. The map itself generates the
cards you can play: **the map tells you what futures are possible.**

This is **v0.0.1**, the PRD's "First Build" — Prototype 0 (ECS map spike) and
Prototype 1 (local primordial cards) combined. It is intentionally ugly but
thinks correctly. See [`docs/project-orbis-manifesto-and-prd.md`](docs/project-orbis-manifesto-and-prd.md)
for the full vision and roadmap.

## What's in this build

- **Vite + React + TypeScript**, local-only, no backend, no accounts.
- **ECS-style world state** — tiles are entities; terrain, elevation, moisture,
  temperature, fertility, surface, connections, traits, and history are
  components. The renderer derives visuals from state; state is the truth.
- **32×32 grid** seeded with a tiny primordial island.
- **Deterministic seeded RNG** — same seed + same actions ⇒ same world.
- **Symbolic rendering** — colored CSS tiles with ASCII glyphs.
- **The core loop:** Start Day → assign a frontier tile → analyze its
  neighborhood → generate up to 3 valid cards → preview → confirm → apply
  effects → record an event → persist.
- **10 geological card archetypes:** raise land, sink land, form coast, erupt
  volcano, spread lava, cool lava, freeze, melt ice, carve river, form lake.
- **`localStorage` persistence** plus **JSON export/import**.
- **Tile inspector** (raw component state + per-tile history) and a
  **chronological history log** (the world's memory).

## Run it

```bash
npm install
npm run dev        # start the dev server
npm run build      # typecheck + production build
npm run smoke      # headless test of the full game loop
```

## Architecture

```
src/
  engine/      ids, seeded rng, component types, world helpers, effects, cards
  systems/     worldGeneration, frontierAssignment, contextAnalysis,
               cardGeneration, requirementValidation, effectApplication, history
  cards/       the 10 geological archetypes (data + canGenerate/build)
  persistence/ localStorage save/load + JSON export/import
  state/       the game store that drives the loop, plus the React hook
  ui/          MapView, SessionDock, TileInspector, HistoryLog, DevControls
```

### Design rule (from the PRD)

> The **card** says what kind of change is possible.
> The **map** says where it is possible.
> The **systems** decide how it resolves.

## Not in this build (future layers)

Multiplayer, backend, accounts, real daily lockout, ages beyond primordial,
ecology, names/lore, roads, settlements, agents, factions — all intentionally
deferred. The only goal here is to prove the map-card-rule loop feels alive.
