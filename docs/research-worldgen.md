# Project Orbis — World-Generation Research & How It Maps to Us

A synthesis of game and academic world-generation techniques, evaluated specifically
against Orbis's model (a 32×32 ECS tile grid where the map generates **context-aware
action cards** for a human who places **one tile at a time**, deterministically from a
seed, with an append-only event log). Each section gives the techniques, how they map
onto Orbis, and recommendations split into **near-term quick wins** vs **long-term
architecture**. Sources are listed at the end.

---

## 0. The big picture: Orbis is already a constrained generator, not a noise sampler

Most game worldgen is **one-shot and stateless**: elevation/moisture at any coordinate is
a pure function of position + seed (noise), so the whole world is globally consistent and
instantly samplable, but there's little local authorial control. Orbis is the opposite —
**incremental, stateful, human-in-the-loop**: terrain is built sequentially, each tile is
explicit state, placement order matters, and global coherence (a real coastline, a river
that reaches the sea) is *not* free — it must be maintained by rules at each step.

The single most important finding: **Orbis is, structurally, a Wave Function Collapse /
Model Synthesis system played by a human.** That reframing tells us which techniques apply
directly (constraint propagation, entropy ordering, biome lookup tables, event-log history,
drainage networks) and which don't (octave noise, domain warping — the machinery whose only
job is to manufacture variation from a coordinate, which Orbis gets from human choice
instead).

---

## 1. Constraint / adjacency generation — Wave Function Collapse

### Techniques
- **WFC (Maxim Gumin, 2016)** turns texture/tile synthesis into a **constraint-satisfaction
  problem**. Each cell starts in a *superposition* of all allowed tiles; you **observe**
  (collapse) one cell to a single tile, then **propagate** the consequences to neighbors
  (removing now-incompatible options) until locally consistent — repeat. The repo notes it
  uses the **AC-4 arc-consistency** algorithm from CSP theory.
- **Entropy ordering:** among un-collapsed cells, WFC collapses the **lowest-entropy** one
  next — roughly the *most-constrained* cell (fewest remaining options). Resolving the
  trickiest cell first minimizes the chance of a later dead-end.
- **Two models:** *simple tiled* (you author explicit edge-adjacency rules) vs *overlapping*
  (rules learned from a sample so every N×N window of output matches one from the input).
- **Roots — Paul Merrell's Model Synthesis (2007):** nearly identical; the main difference is
  cell-selection order (Merrell sweeps in scanline order, WFC picks lowest entropy).
- **Failure handling:** a cell whose options hit empty = contradiction (the problem is
  NP-hard). Options: restart (Gumin), backtrack, or Merrell's **"modify in blocks"**
  (re-solve only the failed region). With pure restart, failure probability rises with output
  size.
- **Carcassonne** is the tabletop analogue: each placed tile must match the edges of every
  tile it abuts — local-adjacency coherence enforced **incrementally**, one tile per turn.

### How it maps to Orbis
This is almost a description of Orbis already:
| WFC concept | Orbis equivalent |
|---|---|
| Cell in superposition | An empty frontier tile (its future is undetermined) |
| Tile domain / allowed set | The set of archetypes whose `canGenerate` passes for that tile |
| Observe / collapse | Player confirms a card; the tile becomes one terrain |
| Adjacency constraints | `canGenerate` gates (`touchesOcean`, `touchesHighGround`, …) |
| Propagation | `analyzeContext` re-reading neighbors before the next hand |
| Lowest-entropy selection | (we don't do this yet — we weight by *connectedness*) |
| Contradiction | A frontier tile that generates **0** cards |

Our two invariants — *no two cards produce the same terrain* and *any land-touching tile can
always grow land* — are hand-rolled **arc-consistency guarantees**: they keep each cell's
domain non-degenerate and non-empty.

### Near-term quick wins
- **Entropy-ordered frontier selection.** Instead of weighting `assignFrontierTile` by filled
  neighbors, weight by **fewest legal cards** (most-constrained first). WFC theory says this
  reduces "stuck"/0-card states and produces more coherent results. Cheap: we already compute
  eligibility; just pick the minimum-option frontier tile (with seeded tie-breaking).
- **One-step look-ahead (lazy propagation).** Before offering a card, check it won't leave a
  *neighbor* with 0 legal cards. Today we only check the target tile; a single-neighbor
  look-ahead is cheap and prevents self-created dead pockets — a weak form of WFC propagation.
- **Treat "0 cards" as a first-class contradiction signal.** Log/surface it; it's the same
  thing WFC restarts on, and it tells us where our adjacency rules are too strict.

### Long-term architecture
- If Orbis ever **auto-fills a region** (e.g., "generate a starting continent," or AI/agent
  turns), implement real WFC: domains + AC-style propagation + backtracking or modify-in-blocks.
  Our archetype `canGenerate` predicates are already the adjacency ruleset.
- Consider an explicit **edge-connector model** (label each terrain's edges) if we move from
  "terrain kind per tile" to sub-tile/auto-tiled rendering — it's how WFC tilesets stay
  coherent and rotatable.

---

## 2. Terrain & biomes — noise, Minecraft's pipeline, Whittaker

### Techniques
- **Gradient noise (Perlin / Simplex)** + **fractional Brownian motion (fBm)**: sum octaves at
  rising frequency (lacunarity) and falling amplitude (gain/persistence) for natural terrain.
  Simplex scales better to 3D/4D and avoids grid artifacts.
- **Redistribution** (`elevation = pow(e, k)`) biases toward plains-with-occasional-peaks;
  **island masks** (blend toward distance-from-center) make continents; **domain warping**
  (`fbm(p + fbm(p))`) makes organic, non-grid-aligned coastlines.
- **Minecraft (post-1.18)** decouples **climate from shape**. Six noise params —
  temperature, humidity, **continentalness**, **erosion**, **weirdness/peaks-and-valleys**,
  depth — where *continentalness* drives ocean↔inland, *erosion* drives flat↔mountainous, and
  **splines** map noise→height (raw Perlin is too smooth for dramatic terrain). **Biome is a
  nearest-neighbor lookup in this multi-dimensional climate space**, not an elevation band.
- **Whittaker diagram:** real biomes are a function of **temperature × precipitation**
  (tundra, desert, grassland, savanna, taiga, temperate/tropical forest…).
- **Red Blob Games** implements this concretely as a 2-axis **`biome(elevation, moisture)`
  lookup table** — explicitly "a variant of the Whittaker diagram," using elevation as a
  *temperature proxy*. Crucially, moisture is often derived from **proximity to water**, not
  its own noise.

### How it maps to Orbis
Orbis **already stores elevation, moisture, AND temperature per tile** — so we're better
positioned than the Red Blob scheme, which has to *fake* temperature from elevation. We have
the real axes for a Whittaker lookup. We also already mirror Minecraft's "shape decoupled from
climate" idea: terrain *kind* (shape) is separate from the climate components.

### Near-term quick wins
- **Formalize moisture-from-water-proximity.** Our `spreadMoisture` effect is exactly the Red
  Blob idea but ad-hoc. Make it a consistent **distance falloff from water** (when water is
  placed, push moisture into land within radius, decaying with distance). This makes "deserts
  far from water / wetlands near water" emerge correctly and feeds the future biome table.
- **Keep elevation continuous (done).** Our recent "flat extend, no creep" fix is the tile
  equivalent of redistribution/monotonic-elevation discipline. Good.
- **Latitude temperature (done)** is our analogue of Minecraft's temperature field; it already
  gives ice a home at the poles.

### Long-term architecture (the "ecology age")
- **Add a Whittaker `biome(temperature, moisture)` lookup table**, with **elevation as an
  override** (below sea level → water; very high → alpine/bare/snow regardless of climate),
  exactly as Minecraft uses continentalness/erosion/height to gate climate selection. This is
  the clean, literature-backed way to introduce biomes when we add ecology — no new per-tile
  data needed, just a derivation from components we already have.
- Treat **continentalness/erosion** as inspirations for *derived* fields if we ever pre-seed
  larger worlds: e.g., a "distance-to-ocean" field (continentalness) and a "local slope" field
  (erosion) to bias card availability.

---

## 3. Rivers, erosion, hydrology — the deferred river-flow layer

### Techniques
- **Droplet/particle hydraulic erosion (Lague, Beyer, Talle):** simulate many water droplets;
  each flows downhill (direction blended with inertia), **picks up sediment** when moving down
  a slope and capacity allows, **deposits** when moving uphill or over-capacity. Capacity ≈
  `slope · speed · water · k`. Great for *eroded heightmaps*, less so for discrete river lines.
- **Grid pipe-model / shallow-water (Mei et al.):** per-cell water height + outflow flux to 4
  neighbors + suspended sediment; GPU-friendly. Overkill for us.
- **D8 flow direction + flow accumulation:** each cell drains to its **steepest of 8
  neighbors**; **flow accumulation** counts how many upstream cells drain through each cell;
  **rivers emerge where accumulation exceeds a threshold**. This is the standard GIS/hydrology
  approach and the right mental model for *river networks* (vs erosion).
- **Priority-Flood depression filling (Barnes et al. 2014):** floods inward from the DEM edges
  with a priority queue so **every cell can drain to the edge**; depressions get **raised to
  their outlet/spill elevation — which is exactly a lake surface.** O(n) integer / O(n log n)
  float, ~20 lines of pseudocode. Must impose an **epsilon gradient** across filled flats to
  resolve flow. Alternative: **breaching** (carve a channel from the pit to outside) for
  minimal DEM change.
- **Dwarf Fortress & Red Blob** both carve rivers the simple way: start at high points, follow
  **downhill** edges to the ocean, grow **lakes along the path / in filled depressions**, and
  handle confluences where paths merge.

### How it maps to Orbis
Today our "river" is just a fresh-water tile with **no direction and no connectivity** — which
is why "lake→river→lake" reads ambiguously (correct in reality, but our model can't tell a
*meaningful* connector from a coincidence). Our `ConnectionComponent` exists in the data model
for exactly this but no card emits connections. Our integer 0–10 elevation grid is a tiny DEM —
D8 + priority-flood apply directly.

### Near-term quick wins (cheap heuristics, no full simulation)
- **Give rivers a `flowDirection` when carved:** point it at the **lowest orthogonal
  neighbor**. Instant D8-lite. Store it on the tile (or via `ConnectionComponent`).
- **Require rivers to trend downhill:** Carve River should prefer/await a lower neighbor to
  flow into (toward water or a lower tile). This is the "monotonic elevation so rivers reach
  the sea" invariant Red Blob enforces — it kills land-locked nonsense rivers.
- **Lakes = filled basins:** we already gate lakes on `isBasin`/low ground; that's a manual
  stand-in for depression filling. Keep it; later replace with real priority-flood.
- **Render connectivity:** once rivers carry a direction, the renderer can draw them as
  connected lines — making lake→river→lake *mean* something.

### Long-term architecture (the river-network layer)
- A proper **`RiverComponent`** (the PRD already sketches it: `connections`, `size`,
  `flowDirection`). Build the network with **D8 flow direction → flow accumulation → threshold
  for "this is a river"**, with **Priority-Flood** to fill/breach depressions into lakes and
  guarantee every drop reaches the sea. Confluences and **deltas/mouths** fall out naturally.
  - **D8 (O'Callaghan & Mark 1984):** each cell points to its steepest of 8 neighbors;
    **flow accumulation** = how many cells drain through each; **stream where accumulation
    exceeds a threshold** (small threshold = dense streams). This is the standard, simple
    model and fits our integer grid.
- **Borrow Red Blob's Mapgen4 river representation** — it's the cleanest match for an
  incremental, append-only system: **each river is a binary tree** where *two tributaries may
  join at a confluence but a river never splits*; trees are built from the **mouth uphill to
  springs**, then water is summed **springs → mouth**, and **width ∝ √(accumulated flow)**.
  This gives us meaningful confluences and downstream-widening rivers (DF's brook→stream→river
  size hierarchy) without a heavy fluid sim.
- **Hydrology-first option (Génevaux et al. 2013):** for any future *procedural* region, build
  the **drainage network first** (Horton–Strahler-ordered river tree), derive watersheds, then
  carve the terrain to fit — the inverse of eroding a noise heightmap, and a better fit for
  "rivers that make sense."
- Optionally a light **droplet/thermal-erosion** pass to carve valleys (and let banks slump at
  the **talus angle**, widening rivers) so rivers sit in believable valleys, not on flat ground.
- This is the right "next coherence jump" once primordial rules are stable — and it lands on
  our existing integer-DEM + event-log foundation.

---

## 4. Emergent history & simulation — the "ages" roadmap

### Techniques
- **Dwarf Fortress** builds the physical world in a **strict, one-directional pipeline**:
  geology/elevation → hydrology (erosion, rivers, lakes) → climate (rain shadow, temperature)
  → ecology → **then** a centuries-long **zero-player history sim** ("legends"). Each layer
  **reads the state the previous layers wrote** and doesn't run in reverse.
- **History is literally an append-only event log.** Tarn Adams' framing: "history is just a
  record of that [simulation]." Legends mode is a **reader/query layer** over discrete,
  entity-referential events (site founded, figure died…), **exportable as XML/text** — the log
  *is* the artifact.
- **Named "ages"** (Age of Myth → Legends → Heroes) are **derived from the log** (which great
  powers are alive), not stored separately — a projection.
- **Cellular automata** for terrain/ecology: the classic **4–5 rule** cave smoothing; the
  **Drossel–Schwabl forest-fire model** (empty→tree→burning with growth prob `p`, lightning
  prob `f`) as the canonical template for **spread/decay** of forests, fire, vegetation,
  flooding. A **flood-fill connectivity pass** removes isolated pockets.

### How it maps to Orbis
This is a **strong validation of Orbis's existing design.** Our event-log-as-source-of-truth
and "world evolves in ages" roadmap are *exactly* DF's two core ideas. We already record an
immutable event per action and materialize the map from it.

### Near-term quick wins
- **Make events strictly immutable + entity-referential** (every event points to tile/feature
  IDs), and treat **all higher-level views as projections** folded from the log — never
  separately mutated. We're basically there; just hold the discipline.
- **Derive any "era/age" label from the log**, not a stored field.

### Long-term architecture
- Keep the **acyclic age layering**: a later age may freely *read* earlier state but **appends
  new events rather than back-patching** old ones. DF's discipline.
- **Physical layers = field/CA mutation** (cheap, in-place, seed-deterministic); **history
  layer = append-only event stream** (causal, provenance-bearing). Use the **forest-fire CA**
  for the ecology age's spread/decay (forests advance, fires consume, wetlands creep) — these
  CA ticks *generate events* the log records ("wildfire consumed region X on day Y").
- **Validate state at every age boundary** (DF rejects bad worlds; CA does flood-fill
  connectivity passes) — the same philosophy as our test invariants, applied at runtime
  between ages.

---

## 5. Prioritized recommendations

### Near-term (fits the current primordial card system)
1. **Entropy-ordered frontier selection** — assign the *most-constrained* frontier tile, not
   the most-connected. Pure win from WFC theory; tiny change to `assignFrontierTile`.
2. **One-step look-ahead** so a card can't strand a neighbor with 0 options (lazy propagation).
3. **Rivers get a `flowDirection`** (lowest neighbor) and must trend downhill — cheap D8-lite
   that makes lake→river→lake meaningful and sets up the network layer.
4. **Formalize moisture-from-water-proximity** as a consistent distance falloff (we already
   have `spreadMoisture`).

### Long-term (the roadmap layers, now with a blueprint)
1. **River-network layer:** `RiverComponent` + D8 flow accumulation + Priority-Flood lakes →
   real drainage, confluences, deltas. The clear "next coherence jump."
2. **Ecology age:** Whittaker `biome(temperature, moisture)` lookup + elevation override; CA
   (forest-fire model) for forest/fire/vegetation spread & decay.
3. **History/ages:** keep append-only events as truth; derive ages as projections; layer ages
   acyclically (read prior state, append new events); validate at boundaries.
4. **(If ever auto-generating regions):** full WFC/Model-Synthesis with propagation +
   backtracking, reusing archetype `canGenerate` as the adjacency ruleset.

---

## Sources

**WFC / constraint generation**
- Maxim Gumin, WaveFunctionCollapse — https://github.com/mxgmn/WaveFunctionCollapse
- Paul Merrell, Model Synthesis — https://paulmerrell.org/model-synthesis/ (comparison: https://paulmerrell.org/wp-content/uploads/2021/07/comparison.pdf)
- BorisTheBrave, "WFC Explained" — https://www.boristhebrave.com/2020/04/13/wave-function-collapse-explained/ ; "Modifying in Blocks" — https://www.boristhebrave.com/2021/10/26/model-synthesis-and-modifying-in-blocks/
- Marian Kleineberg, WFC — https://marian42.de/article/wfc/ ; Robert Heaton — https://robertheaton.com/2018/12/17/wavefunction-collapse-algorithm/
- Carcassonne rules — https://www.ultraboardgames.com/carcassonne/game-rules.php

**Noise / terrain / biomes**
- Amit Patel (Red Blob Games), "Making maps with noise" — https://www.redblobgames.com/maps/terrain-from-noise/ ; "Polygon Map Generation" — http://www-cs-students.stanford.edu/~amitp/game-programming/polygon-map-generation/ ; Mapgen4 — https://www.redblobgames.com/maps/mapgen4/
- Inigo Quilez, fBm — https://iquilezles.org/articles/fbm/ ; Domain warping — https://iquilezles.org/articles/warp/
- Ken Perlin, Improved Noise — https://mrl.cs.nyu.edu/~perlin/noise/ ; Simplex — https://en.wikipedia.org/wiki/Simplex_noise
- Minecraft Wiki, World generation — https://minecraft.wiki/w/World_generation ; Density function — https://minecraft.wiki/w/Density_function
- Henrik Kniberg, "Minecraft terrain generation in a nutshell" — https://www.youtube.com/watch?v=OROPAKsqzRs
- Whittaker biomes — https://en.wikipedia.org/wiki/Biome ; https://serc.carleton.edu/eslabs/weather/4a.html

**Erosion / rivers / hydrology**
- Sebastian Lague, Hydraulic Erosion — https://github.com/SebLague/Hydraulic-Erosion ; video https://www.youtube.com/watch?v=eaXk97ujbPQ
- Hans Theobald Beyer thesis (2015) — https://www.firespark.de/?id=project&project=HydraulicErosion ; impl https://github.com/henrikglass/erodr
- Job Talle, "Simulating hydraulic erosion" — https://jobtalle.com/simulating_hydraulic_erosion.html
- Mei, Decaudin & Hu, "Fast Hydraulic Erosion on GPU" (PG '07) — http://evasion.imag.fr/Publications/2007/MDH07/
- Barnes, Lehman, Mulla, "Priority-Flood" (Computers & Geosciences, 2014) — https://arxiv.org/abs/1511.04463 ; RichDEM — https://richdem.readthedocs.io/
- Planchon & Darboux (2002) — https://hal.science/hal-00956072 ; Wang & Liu (2006) — https://www.tandfonline.com/doi/abs/10.1080/13658810500433453
- ESRI "How Fill works" — https://doc.esri.com/en/arcgis-pro/latest/tool-reference/spatial-analyst/how-fill-works.html
- D8 / flow accumulation (ESRI) — https://doc.esri.com/en/arcgis-pro/latest/tool-reference/spatial-analyst/how-flow-direction-works.html ; TauDEM (Tarboton) — https://hydrology.usu.edu/taudem/taudem5/help53/D8FlowDirections.html ; origin: O'Callaghan & Mark (1984) DOI 10.1016/S0734-189X(84)80011-0
- Red Blob Games, Mapgen4 river representation (binary-tree rivers, confluences, width∝√flow) — https://simblob.blogspot.com/2018/10/mapgen4-river-representation.html ; mapgen2 — http://www-cs-students.stanford.edu/~amitp/game-programming/polygon-map-generation/
- Dwarf Fortress river types/hierarchy — https://dwarffortresswiki.org/index.php/DF2014:River
- Génevaux et al. 2013, "Terrain Generation Using Procedural Models Based on Hydrology" (ACM TOG 32(4)) — https://dl.acm.org/doi/10.1145/2461912.2461996
- Cordonnier et al. 2016, "Large Scale Terrain Generation from Tectonic Uplift and Fluvial Erosion" — https://onlinelibrary.wiley.com/doi/10.1111/cgf.12820
- Thermal erosion / talus: Musgrave, Kolb & Mace (1989) — https://dl.acm.org/doi/10.1145/74333.74337 ; Olsen (2004) — https://web.mit.edu/cesium/Public/terrain.pdf

**Emergent history / CA**
- Dwarf Fortress Wiki — World generation https://dwarffortresswiki.org/index.php/World_generation ; Legends https://dwarffortresswiki.org/index.php/DF2014:Legends ; Biome https://dwarffortresswiki.org/index.php/Biome ; Calendar/ages https://www.dwarffortresswiki.org/index.php/Calendar
- RogueBasin, Cellular-automata caves — https://www.roguebasin.com/index.php/Cellular_Automata_Method_for_Generating_Random_Cave-Like_Levels
- Drossel–Schwabl forest-fire model — https://en.wikipedia.org/wiki/Forest-fire_model
- Tarn Adams interviews — https://www.pcgamer.com/dwarf-fortress-creator-on-how-hes-42-towards-simulating-existence/

> Sourcing caveats from the research pass: a few primary PDFs (Perlin's NYU page, the Merrell
> comparison PDF, the Beyer thesis, some journal pages) intermittently blocked automated
> fetching; those specific claims were corroborated via faithful open-source implementations
> and secondary summaries rather than read verbatim. Treat exact formula constants as
> "verify against source before implementing."
