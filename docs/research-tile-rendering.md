# Tile Rendering & the Tile Grammar — Research + Orbis Design

Research into how Carcassonne tiles actually work and how production games render
seamless, diagonal tile boundaries — mapped onto Orbis (a single-terrain-per-tile,
state-derived renderer). Companion to `research-worldgen.md`.

---

## TL;DR — the recommendation

1. **The naive "corner-cut" I first shipped is wrong.** Replace it with **dual-grid
   corner autotiling** for area terrain: offset the render grid by half a tile so each
   display cell is keyed by its **4 corner world-tiles** → **16 cases**, and the boundary
   cuts **corner-to-corner = diagonal/curved coastlines**. This is *the* production technique.
2. **Model a tile as a cell complex** (exactly your framing): an **area** label (terrain)
   on the face; **linear** features (river now, roads later) as **paths between edge nodes**
   (ports); **point** features (later) at the center node.
3. **The matching/legality logic is Wang-tiles = CSP = WFC** — which our card-generation
   `canGenerate` gates already approximate. Rendering and logic are the *same* grammar
   seen from two sides.

---

## 0. The unified model (your framing, confirmed)

A tile is a **CW-complex / planar subdivision**, not a pixel:
- **0-cells:** 4 corner nodes **+ edge nodes** (ports on each edge).
- **1-cells:** 4 edges.
- **2-cell:** the tile face.

Features attach to different parts, and this is the load-bearing distinction:

| Feature kind | Lives on | Carcassonne | Orbis | Renders as |
|---|---|---|---|---|
| **Area** | the 2-cell / regions bounded by edges | city, field | terrain, biomes | region fill, **diagonal corner boundaries** |
| **Linear** | paths between **edge nodes** | road, river | river (have flow dir), future roads | **port-to-port path** across tiles |
| **Point** | center node | cloister | future shrine/settlement | center stamp |

The map as a whole is a **planar graph** (tiles = faces, shared edges = graph edges); each
feature is a **subgraph** (a road network = a path subgraph; a coastline = the boundary
1-chain between water faces and land faces; a city/field/biome = a connected face region).
A **graph grammar** describes how features grow/merge across tiles (the right frame for the
future road/settlement ages). And the placement/adjacency rule is a **constraint-satisfaction
problem** — see §2.

---

## 1. Carcassonne is an edge-matched Wang-tile system

- Every tile edge carries a **feature type** — field / road / city (+ river in that
  expansion). Placement is legal iff **every shared edge matches** (city↔city, road↔road,
  field↔field). That predicate *is the entire legality test*. [rules: ultraboardgames,
  fwtwr]
- Features span tiles: **city** = area (walled region, can be a corner blob, a band, or a
  full-tile fill), **road** = linear (a path edge-to-edge: straight for opposite edges,
  curved for adjacent), **field** = the area filling the rest, **cloister** = a point
  feature always complete within one tile. [ultraboardgames, chessandpoker]
- The **artwork is fully determined by the edge configuration** + interior connectivity — a
  city on two adjacent edges is *drawn* as a diagonal corner blob; a road on two edges as a
  path between them. The picture is a *rendering of the grammar*, not extra data. This is
  exactly Orbis's "state is source of truth, visuals derived."
- Base game: **72 tiles / 24 distinct designs** with a known frequency distribution; e.g.
  exactly one full-city tile, one 4-way crossroads, 6 cloister tiles. [carcassonne.fandom
  Core_Game; wikicarpedia Tile_Reference]
- **It's a Wang system:** fixed-orientation squares whose edges are typed and must match —
  the textbook intuition pump for **Wave Function Collapse**. [robertheaton, mxgmn WFC]

---

## 2. The matching logic = Wang tiles = CSP = WFC

- **Wang tiles** (Hao Wang, 1961): unit squares with **colored edges**, placed only so
  abutting edges match, no rotation/reflection. Sets can be **aperiodic** (Berger 1966) and
  the tiling problem is **undecidable**; smallest aperiodic set = 11 tiles / 4 colors
  (Jeandel–Rao 2015). [Wikipedia: Wang tile]
- **Edge-coloring vs corner-coloring:** edge Wang tiles → **path/maze** designs (roads,
  rivers); **corner Wang tiles** (color the 4 corners) → **patch/terrain** designs, because
  one corner is shared by 3 neighbors so it cleanly assigns terrain to the quadrants meeting
  at a vertex. [cr31 intro + 2corn]
- **WFC = the Wang model as a constraint solver:** tiles have border labels; neighbors are
  legal iff facing borders are compatible; WFC adds entropy-ordered collapse + propagation.
  The WFC repo even calls some tilesets "non-Wang" precisely because their adjacency *can't*
  be induced from edge labels — i.e. Wang = the edge-label-derivable case. [mxgmn WFC,
  boristhebrave]
- **Orbis already does a hand-rolled version of this:** each archetype's `canGenerate` is an
  adjacency constraint; our two invariants (no-duplicate-terrain, always-growable) are
  arc-consistency guarantees. So the *logic* layer is sound; this research is mainly about
  the *rendering* layer.

---

## 3. Rendering techniques — and which Orbis should use

| Technique | Neighbors read | Cases (2 terrains) | Boundary | Verdict for Orbis |
|---|---|---|---|---|
| 4-bit orthogonal ("fence") | 4 sides | 16 | square-ish | good for **roads/rivers** (linear) |
| **8-bit "blob"** | 8 (Moore) | **47** (256→47) | needs authored corner art | ❌ two-material only, doesn't scale to N terrains, high authoring cost |
| **Dual-grid / corner** | **4 corners** | **16** | **diagonal/curved, corner-to-corner** | ✅ **best for area terrain** |
| **Marching squares** | 4 corner samples + threshold | **16** | interpolated contour (smooth) | ✅ conceptual parent of dual-grid; use for elevation bands |

- **Why 256 → 47 (blob):** a diagonal neighbor only matters if **both** flanking orthogonal
  neighbors match; otherwise there's no visible inside-corner. That gates the 256 down to 47
  distinct tiles. But blob is inherently **two-material** — a 3rd terrain "needs hundreds of
  tiles" — and the variation is poor for the effort. [cr31 blob, boristhebrave roundup,
  redblobgames]
- **Dual grid** (Oskar Stålberg; jess::codes; Red Blob; Boris the Brave): the render grid is
  **offset half a tile**, so each display tile covers the point where **4 world cells meet**;
  read those 4 corners as a 4-bit index → **16 tiles** (as few as 6 with symmetry), each
  checking **4 neighbors not 8**. Boundaries "pass through the middle of display tiles" →
  naturally **smooth and diagonal**. It is literally "marching squares to select which tile
  to draw based on the terrains at the corners." [redblobgames/autotile, jess-hammer,
  boristhebrave quarter-tile]
- **Marching squares:** 4 corner samples vs a threshold → 4-bit index → 16 contour cases;
  **linear interpolation** along edges gives smooth (even curved) boundaries; saddle cases
  (5, 10) resolved by the cell-center average. The diagonal chord in the "one corner differs"
  case is exactly the organic coastline cut. [Wikipedia: Marching squares]
- **Multi-layer terrain** (ocean < coast < plain < hill < mountain): run **one 2-class pass
  per adjacent boundary**, back-to-front. Each pass thresholds the map to binary at its own
  level and draws just that boundary with the same 4-corner→16-case lookup. Same idea as
  marching squares at multiple isovalues (nested isobands). [boristhebrave quarter-tile]
- **Production confirms it:** Tiled supports the 47-blob *and* corner **Wang sets**; Godot's
  terrain modes are **Match Corners / Sides / Corners+Sides** (corner matching is the
  workhorse); RPG Maker autotiles are built from **4 quarter-tiles** (corner family). The
  dominant production pattern = **ordered terrain hierarchy + corner matching.** [Tiled docs,
  Godot docs, rpgmakerweb]

---

## 4. The Orbis design

### A. Data model (extend, don't rewrite)
- **Area:** keep `terrain: TerrainKind` (the face label). Define a single **`terrainLayer`
  order** for blending (water=0, coast=1, plain=2, hill=3, mountain/volcano=4; specials —
  ice, lava, basalt — get their own layer slots). (We already have an ad-hoc `blendHeight`;
  formalize it.)
- **Linear:** rivers (and later roads) as features with **edge-node ports**: reuse the
  existing `ConnectionComponent` / `flows-<dir>` — a river is `connections: Direction[]`
  between ports. Roads later use the identical shape.
- **Point:** a future `centerFeature` (shrine/settlement) — out of scope now.
- Add a stable **`renderSeed`** per tile (`hash(tile.id)`) for deterministic variation.

### B. Renderer: dual-grid for area terrain + path layer for linear
1. **Base + transitions via dual grid.** Render `(W+1)×(H+1)` display cells, each offset by
   half a tile, sampling its **4 corner tiles' `terrainLayer`**. For each adjacent layer
   boundary present among those 4 corners, draw the higher layer's region as a polygon whose
   edge between a higher and lower corner is the **diagonal/curved marching-squares contour**.
   Composite layers low→high. This yields diagonal coastlines and stacked terrain transitions,
   automatically, from state.
2. **Linear features on the main grid.** Draw rivers/roads as **port-to-port paths** over the
   terrain (curve through center between the entered edge nodes), connecting across tiles —
   the Carcassonne road model. (We already do a first version of this for rivers.)
3. **Keep** elevation-heatmap mode (threshold/colour by elevation), selection/assigned
   overlays (overlays, not state), and per-tile memoization.

### C. Near-term vs long-term
- **Near-term (biggest visual win):** a **single** dual-grid pass for **land vs water** →
  diagonal coastlines and organic island silhouettes, plus the existing river paths. Replaces
  the naive corner-cut.
- **Long-term:** full **multi-layer** dual grid (ocean→coast→plain→hill→peak) with
  marching-squares interpolation + `renderSeed` curve wobble; roads as edge features; the
  **graph-grammar** for feature growth when the road/settlement ages arrive.

---

## Sources
- Carcassonne rules / tiles: https://www.ultraboardgames.com/carcassonne/game-rules.php ·
  https://wikicarpedia.com/car/Tile_Reference_(1st_edition) ·
  https://carcassonne.fandom.com/wiki/Core_Game · https://upsilon.cc/~zack/teaching/1011/gla/carcassonne/carcassonne.pdf
- Wang tiles: https://en.wikipedia.org/wiki/Wang_tile · cr31 (canonical, via mirror)
  http://www.boristhebrave.com/permanent/24/06/cr31/stagecast/wang/intro.html ·
  …/2corn.html · …/blob.html (orig https://www.cr31.co.uk/stagecast/wang/blob.html) ·
  Cohen et al. 2003 https://doi.org/10.1145/882262.882265
- Autotiling / dual grid / marching squares: https://www.redblobgames.com/articles/autotile/ ·
  https://github.com/jess-hammer/dual-grid-tilemap-system-unity ·
  https://www.boristhebrave.com/2023/05/31/quarter-tile-autotiling/ ·
  https://www.boristhebrave.com/2021/09/12/beyond-basic-autotiling/ ·
  https://www.boristhebrave.com/2013/07/14/tileset-roundup/ ·
  https://en.wikipedia.org/wiki/Marching_squares ·
  https://excaliburjs.com/blog/Dual%20Tilemap%20Autotiling%20Technique/ ·
  Oskar Stålberg https://x.com/OskSta/status/1448248658865049605
- Engine docs: https://docs.godotengine.org/en/stable/tutorials/2d/using_tilesets.html ·
  https://docs.mapeditor.org/en/stable/manual/terrain/ ·
  https://www.rpgmakerweb.com/blog/classic-tutorial-how-autotiles-work
- WFC tie-in: https://github.com/mxgmn/WaveFunctionCollapse ·
  https://www.boristhebrave.com/2020/04/13/wave-function-collapse-explained/ ·
  https://robertheaton.com/2018/12/17/wavefunction-collapse-algorithm/

> Sourcing caveats: cr31.co.uk intermittently blocks automated fetches; claims were verified
> via Boris the Brave's permanent cr31 mirror + independent corroboration. The "47 vs 48"
> figure depends on whether the empty/center tile is counted (47 solid).
