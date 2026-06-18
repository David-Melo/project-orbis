import type { Rng } from "../engine/rng";
import type { TileContext, WorldAge } from "../engine/card";
import type { Effect, Requirement } from "../engine/effects";
import type { TerrainKind } from "../engine/components";
import type { WorldState } from "../engine/world";

/**
 * A card archetype is pure data + two functions:
 *  - canGenerate: would this card make sense on the assigned tile?
 *  - build:       produce the concrete title/requirements/effects/flavor.
 *
 * Cards are GROWN from the map. Every archetype reads the TileContext, so the
 * same neighborhood always offers the same possibilities.
 *
 * Three design rules drive this primordial set:
 *  1. Terrain transitions respect neighbors — ocean meets land through coast,
 *     rivers need a source, ice needs cold, lakes need a basin or fresh water.
 *  2. Elevation is continuous — a new tile's height derives from its neighbors,
 *     stepped per terrain, never an arbitrary jump (see elevationFor).
 *  3. The world is REVERSIBLE — cards may transform existing edge tiles, not
 *     just empty frontier, so shores erode, heights wear down, basins flood,
 *     and water freezes/melts in place. The constraint is physical, not
 *     "build-only".
 */
export type CardArchetype = {
  id: string;
  name: string;
  age: WorldAge;
  /** Terrains this card may be played ON (the target tile's current terrain). */
  targets: TerrainKind[];
  canGenerate: (ctx: TileContext, world: WorldState) => boolean;
  build: (ctx: TileContext, world: WorldState, rng: Rng) => ArchetypeResult;
};

export type ArchetypeResult = {
  title: string;
  requirements: Requirement[];
  effects: Effect[];
  flavor: string;
};

const RIVER_SOURCE: TerrainKind[] = ["hill", "mountain", "volcano", "river", "lake", "wetland", "ice"];
const WATER_KINDS: TerrainKind[] = ["ocean", "coast", "lake", "river", "wetland"];

const clamp = (v: number, lo = 0, hi = 10) => Math.max(lo, Math.min(hi, Math.round(v)));

/** How many orthogonal neighbors are water — used to stop water filling blobs. */
const adjacentWaterCount = (ctx: TileContext) =>
  ctx.adjacentTerrains.filter((t) => WATER_KINDS.includes(t)).length;

/** Does the target tile's current terrain allow this archetype? */
const targetOk = (a: CardArchetype, ctx: TileContext) => a.targets.includes(ctx.targetTerrain);

/**
 * Derive a continuous elevation for a new tile of `kind` from the average
 * height of its existing neighbors (`base`), stepped and clamped per terrain.
 */
function elevationFor(kind: TerrainKind, base: number): number {
  switch (kind) {
    case "ocean":
      return 0;
    case "coast":
      return clamp(Math.min(base, 3), 1, 3);
    case "cliff":
      return clamp(Math.max(base, 5), 5, 9);
    case "wetland":
      return clamp(base - 1, 1, 3);
    case "lake":
      return clamp(base - 1, 0, 4);
    case "river":
      return clamp(base - 1, 1, 7);
    case "plain":
      return clamp(base + 1, 3, 6);
    case "hill":
      return clamp(base + 2, 5, 8);
    case "mountain":
      return clamp(Math.max(base, 6), 6, 10);
    case "volcano":
      return clamp(base + 4, 7, 10);
    case "lava":
      return clamp(base, 4, 9);
    case "basalt":
      return clamp(base, 3, 8);
    case "ice":
      return clamp(base, 0, 10);
    default:
      return clamp(base, 0, 10);
  }
}

/** Valid elevation band per terrain. */
const TERRAIN_BANDS: Partial<Record<TerrainKind, [number, number]>> = {
  ocean: [0, 0],
  coast: [1, 3],
  cliff: [5, 9],
  wetland: [1, 3],
  lake: [0, 4],
  river: [1, 7],
  plain: [3, 6],
  hill: [5, 8],
  mountain: [6, 10],
  volcano: [7, 10],
  basalt: [3, 8],
  ice: [0, 10],
};

/**
 * Elevation for a LATERAL extension: match the neighbors' height (clamped to
 * the terrain's band) WITHOUT stepping up. Using elevationFor here is what
 * caused plains to creep upward to the cap on every extend; extending a
 * feature should keep it flat, only Raise/Sink change height.
 */
function matchElevation(kind: TerrainKind, base: number): number {
  const [lo, hi] = TERRAIN_BANDS[kind] ?? [0, 10];
  return clamp(base, lo, hi);
}

const pickFlavor = (rng: Rng, options: string[]): string => rng.pick(options);

const PRIMARY_ARCHETYPES: CardArchetype[] = [
  // 1. Raise Land — UPLIFT of existing land, one step up the chain:
  //    coast -> plain -> hill -> mountain. Lateral growth of new ground is
  //    handled by the Extend archetypes; this card only adds height to land
  //    that already exists. It is the inverse of Wear Down.
  {
    id: "raise_land",
    name: "Raise Land",
    age: "primordial",
    targets: ["coast", "plain", "hill"],
    canGenerate(ctx) {
      // Uplift is the counterforce to erosion/subsidence. It must be reachable
      // at the coast too (tectonics / sediment building the shore up): gating it
      // to !touchesOcean was what made coastal land able only to SINK, draining
      // the warm middle to open sea over a long run.
      return targetOk(this, ctx);
    },
    build: (ctx, _w, rng) => {
      let kind: TerrainKind;
      let value: number;
      if (ctx.targetTerrain === "coast") {
        kind = "plain";
        value = elevationFor("plain", Math.max(ctx.averageElevation, ctx.targetElevation + 1));
      } else if (ctx.targetTerrain === "plain") {
        kind = "hill";
        value = clamp(ctx.targetElevation + 2, 5, 8);
      } else {
        kind = "mountain";
        value = clamp(ctx.targetElevation + 2, 7, 10);
      }
      const title =
        kind === "mountain" ? "Raise Mountain" : kind === "hill" ? "Raise Hill" : "Raise Land";
      return {
        title,
        requirements: [{ type: "targetTerrainIn", terrains: ["coast", "plain", "hill"] }],
        effects: [
          { type: "setTerrain", terrain: kind },
          { type: "setElevation", value },
          { type: "adjustMoisture", amount: -1 },
        ],
        flavor: pickFlavor(rng, [
          "The ground heaves upward, reaching for the sky.",
          "Old rock buckles and rises another step.",
          "The land swells higher above its neighbors.",
        ]),
      };
    },
  },

  // 2. Form Coast — the way an ocean-adjacent empty tile becomes solid shore.
  {
    id: "form_coast",
    name: "Form Coast",
    age: "primordial",
    targets: ["empty"],
    canGenerate(ctx) {
      return targetOk(this, ctx) && ctx.touchesOcean;
    },
    build: (ctx, _w, rng) => ({
      title: "Form Coast",
      requirements: [
        { type: "targetTerrainIn", terrains: ["empty"] },
        { type: "touchesTerrain", terrain: "ocean" },
      ],
      effects: [
        { type: "setTerrain", terrain: "coast" },
        { type: "setElevation", value: elevationFor("coast", ctx.averageElevation) },
        { type: "adjustMoisture", amount: 6 },
      ],
      flavor: pickFlavor(rng, [
        "Land and water settle their border into a shore.",
        "A beach is negotiated between stone and surf.",
        "The edge of the world sharpens into coast.",
      ]),
    }),
  },

  // 3. Extend Coast — build coast outward from EXISTING coast (not just where
  //    land meets open ocean), so you can widen beaches, bend a shoreline a
  //    tile inland, or turn a near-shore plain into a sandy beach.
  {
    id: "extend_coast",
    name: "Extend Coast",
    age: "primordial",
    // Empty only: turning an existing near-shore plain into beach is Sink
    // Land's plain->coast step ("Lower to Shore"), so they never duplicate.
    targets: ["empty"],
    canGenerate(ctx) {
      return (
        ctx.targetTerrain === "empty" &&
        ctx.adjacentTerrains.includes("coast") &&
        !ctx.touchesOcean &&
        !ctx.touchesLava &&
        ctx.averageElevation <= 5
      );
    },
    build: (ctx, _w, rng) => ({
      title: "Extend Coast",
      requirements: [
        { type: "targetTerrainIn", terrains: ["empty"] },
        { type: "touchesTerrain", terrain: "coast" },
        { type: "maxElevation", value: 6 },
      ],
      effects: [
        { type: "setTerrain", terrain: "coast" },
        { type: "setElevation", value: elevationFor("coast", ctx.averageElevation) },
        { type: "adjustMoisture", amount: 3 },
        { type: "addTrait", trait: "sandy" },
      ],
      flavor: pickFlavor(rng, [
        "The shore widens into a low band of sand and shingle.",
        "The coastline reaches a little further along the water.",
        "Wind and tide spread the beach across the margin.",
      ]),
    }),
  },

  // 4. Spread Ocean — the sea grows into low frontier beside any SHORELINE
  //    (open ocean, a coast, or a wet marsh — all places the sea can reach),
  //    and can erode a coast/wetland back into open water.
  {
    id: "spread_ocean",
    name: "Spread Ocean",
    age: "primordial",
    targets: ["empty", "coast", "wetland"],
    canGenerate(ctx) {
      const shoreline =
        ctx.touchesOcean || ctx.adjacentTerrains.includes("coast") || ctx.adjacentTerrains.includes("wetland");
      // <= 4 matches this card's own maxElevation requirement; a shoreline sits
      // at coast elevation (~2-3), so a stricter gate wrongly blocked the sea
      // from advancing along a low coastline.
      return targetOk(this, ctx) && shoreline && ctx.averageElevation <= 4;
    },
    build: (ctx, _w, rng) => ({
      title: ctx.targetTerrain === "empty" ? "Spread Ocean" : "Erode Shore",
      requirements: [
        { type: "targetTerrainIn", terrains: ["empty", "coast", "wetland"] },
        { type: "touchesAnyTerrain", terrains: ["ocean", "coast", "wetland"] },
        { type: "maxElevation", value: 4 },
      ],
      effects: [
        { type: "setTerrain", terrain: "ocean" },
        { type: "setElevation", value: 0 },
        { type: "adjustMoisture", amount: 9 },
      ],
      flavor: pickFlavor(rng, [
        "The sea reaches out and claims a little more of the low ground.",
        "Waves gnaw the shore away until only water remains.",
        "The ocean remembers it was here first.",
      ]),
    }),
  },

  // 4. Form Shore — create a SHORELINE from dry land, even with no sea nearby.
  //    This is how you outline or begin a coast where none exists, so a growing
  //    continent can be given a coastline and eventually closed into an island.
  //    (extend_coast continues an existing coast; form_coast handles the ocean
  //    boundary; this handles dry land.)
  {
    id: "form_shore",
    name: "Form Shore",
    age: "primordial",
    targets: ["empty"],
    canGenerate(ctx) {
      return (
        ctx.targetTerrain === "empty" &&
        ctx.touchesLand &&
        !ctx.touchesOcean &&
        !ctx.touchesLava &&
        !ctx.adjacentTerrains.includes("coast") &&
        ctx.averageElevation <= 5
      );
    },
    build: (ctx, _w, rng) => ({
      title: "Form Shore",
      requirements: [
        { type: "targetTerrainIn", terrains: ["empty"] },
        { type: "maxElevation", value: 6 },
      ],
      effects: [
        { type: "setTerrain", terrain: "coast" },
        { type: "setElevation", value: elevationFor("coast", ctx.averageElevation) },
        { type: "adjustMoisture", amount: 5 },
        { type: "addTrait", trait: "sandy" },
      ],
      flavor: pickFlavor(rng, [
        "The land lies down low and sandy at its margin, a shore in waiting.",
        "A beach forms along the edge of the dry ground.",
        "The continent grows itself a coastline.",
      ]),
    }),
  },

  // 4b. Form Cliff — where HIGH GROUND (a hill or mountain) meets the sea, the
  //     shore is a sheer cliff rather than a low beach. Gated on actually
  //     touching high ground + the sea, NOT on the neighborhood average (which
  //     the low water would otherwise drag below the threshold, making cliffs
  //     unreachable).
  {
    id: "form_cliff",
    name: "Form Cliff",
    age: "primordial",
    targets: ["empty", "coast", "hill"],
    canGenerate(ctx) {
      const atSea = ctx.touchesOcean || ctx.adjacentTerrains.includes("coast");
      return targetOk(this, ctx) && atSea && ctx.touchesHighGround && !ctx.touchesLava;
    },
    build: (ctx, _w, rng) => ({
      title: ctx.targetTerrain === "empty" ? "Form Cliff" : "Raise Sea Cliff",
      requirements: [
        { type: "targetTerrainIn", terrains: ["empty", "coast", "hill"] },
        { type: "touchesAnyTerrain", terrains: ["ocean", "coast"] },
        { type: "touchesAnyTerrain", terrains: ["hill", "mountain", "volcano"] },
      ],
      effects: [
        { type: "setTerrain", terrain: "cliff" },
        { type: "setElevation", value: elevationFor("cliff", ctx.averageElevation) },
        { type: "adjustMoisture", amount: 3 },
        { type: "addTrait", trait: "sheer" },
      ],
      flavor: pickFlavor(rng, [
        "The high land breaks off sheer where it meets the water.",
        "Waves hammer the foot of a tall stone cliff.",
        "The coast rises into a wall of rock above the sea.",
      ]),
    }),
  },

  // 5. Sink Land — the DOWNWARD ladder for EXISTING land, mirroring Raise Land:
  //    plain → coast → (ocean by the sea, else wetland) → lake. A deliberate
  //    (click-targeted) transform with no adjacent-water requirement, so you
  //    can carve channels and close off islands. It is not a growth card, so it
  //    never appears on empty frontier during the random ritual.
  {
    id: "sink_land",
    name: "Sink Land",
    age: "primordial",
    targets: ["plain", "coast", "wetland"],
    canGenerate(ctx) {
      return targetOk(this, ctx);
    },
    build: (ctx, _w, rng) => {
      let kind: TerrainKind;
      let title: string;
      let trait: string;
      switch (ctx.targetTerrain) {
        case "plain":
          kind = "coast";
          title = "Lower to Shore";
          trait = "sandy";
          break;
        case "coast":
          // Always subsides to marsh; the sea eroding a coast to open ocean is
          // Spread Ocean's "Erode Shore", so the two never duplicate.
          kind = "wetland";
          title = "Sink to Marsh";
          trait = "marsh";
          break;
        default: // wetland
          kind = "lake";
          title = "Deepen to Lake";
          trait = "freshwater";
          break;
      }
      return {
        title,
        requirements: [{ type: "targetTerrainIn", terrains: ["plain", "coast", "wetland"] }],
        effects: [
          { type: "setTerrain", terrain: kind },
          { type: "setElevation", value: elevationFor(kind, ctx.averageElevation) },
          { type: "adjustMoisture", amount: 4 },
          { type: "addTrait", trait },
        ],
        flavor: pickFlavor(rng, [
          "The ground gives way and sinks toward the water table.",
          "Low land settles another step down toward the sea.",
          "The earth subsides, and water is not far behind.",
        ]),
      };
    },
  },

  // 5. Erupt Volcano — fire belongs to the heights. A MOUNTAIN grows into a
  //    volcano, and new vents only open within an existing volcanic region
  //    (next to a mountain, volcano, or lava). It never erupts on a random
  //    plain, so volcanoes cluster into ranges and fields instead of speckling
  //    the whole map.
  {
    id: "erupt_volcano",
    name: "Erupt Volcano",
    age: "primordial",
    targets: ["empty", "plain", "hill", "mountain", "basalt"],
    canGenerate(ctx) {
      if (!targetOk(this, ctx)) return false;
      // A mountain can erupt directly into a volcano.
      if (ctx.targetTerrain === "mountain") return true;
      // Otherwise only within an existing volcanic neighborhood.
      return ctx.touchesMountain || ctx.touchesVolcano || ctx.touchesLava;
    },
    build: (ctx, _w, rng) => ({
      title: ctx.targetTerrain === "mountain" ? "Mountain Erupts" : "Erupt Volcano",
      requirements: [
        { type: "targetTerrainIn", terrains: ["empty", "plain", "hill", "mountain", "basalt"] },
      ],
      effects: [
        { type: "setTerrain", terrain: "volcano" },
        { type: "setElevation", value: elevationFor("volcano", ctx.averageElevation) },
        { type: "adjustTemperature", amount: 4 },
        { type: "adjustMoisture", amount: -3 },
        { type: "addTrait", trait: "volcanic" },
      ],
      flavor: pickFlavor(rng, [
        "The earth splits and the deep fire finds the sky.",
        "A mountain is born screaming, wreathed in ash.",
        "Fire remembers it was here before the water.",
      ]),
    }),
  },

  // 6. Spread Lava — lava/volcano spills onto an adjacent tile.
  {
    id: "spread_lava",
    name: "Spread Lava",
    age: "primordial",
    targets: ["empty", "plain", "basalt", "coast"],
    canGenerate(ctx) {
      return targetOk(this, ctx) && (ctx.touchesLava || ctx.touchesVolcano);
    },
    build: (ctx, _w, rng) => ({
      title: "Spread Lava",
      requirements: [
        { type: "targetTerrainIn", terrains: ["empty", "plain", "basalt", "coast"] },
        { type: "touchesAnyTerrain", terrains: ["lava", "volcano"] },
      ],
      effects: [
        { type: "setTerrain", terrain: "lava" },
        { type: "setElevation", value: elevationFor("lava", ctx.averageElevation) },
        { type: "adjustTemperature", amount: 5 },
        { type: "adjustMoisture", amount: -4 },
        { type: "addTrait", trait: "molten" },
      ],
      flavor: pickFlavor(rng, [
        "A river of fire finds new ground to consume.",
        "The lava advances, patient and bright.",
        "Nothing green survives where this tide passes.",
      ]),
    }),
  },

  // 7. Cool Lava — lava beside water/ice (or in cool air) hardens to basalt.
  //    Can act on an empty tile beside lava OR on a lava tile cooling in place.
  {
    id: "cool_lava",
    name: "Cool Lava",
    age: "primordial",
    targets: ["empty", "lava"],
    canGenerate(ctx) {
      if (!targetOk(this, ctx)) return false;
      const nearLava = ctx.targetTerrain === "lava" || ctx.touchesLava;
      return nearLava && (ctx.touchesWater || ctx.touchesIce || ctx.averageTemperature <= 6);
    },
    build: (ctx, _w, rng) => ({
      title: ctx.touchesWater ? "Quench Lava" : "Cool Lava",
      requirements: [
        { type: "targetTerrainIn", terrains: ["empty", "lava"] },
      ],
      effects: [
        { type: "setTerrain", terrain: "basalt" },
        { type: "setElevation", value: elevationFor("basalt", ctx.averageElevation) },
        { type: "adjustTemperature", amount: -4 },
        { type: "adjustFertility", amount: 2 },
        { type: "addTrait", trait: "basaltic" },
      ],
      flavor: pickFlavor(rng, [
        "The fire hardens into black, glassy stone.",
        "Steam screams where molten rock meets the cold.",
        "What was molten becomes a foundation.",
      ]),
    }),
  },

  // 8. Freeze — cold polar WATER freezes over into ice (sea ice, frozen lakes).
  //    Ice is only ever frozen water, so it forms polar caps along cold coasts
  //    and seas instead of marching across the land. Melt (>=4) thaws the margin.
  {
    id: "freeze",
    name: "Freeze",
    age: "primordial",
    targets: ["ocean", "coast", "lake", "river", "wetland"],
    canGenerate(ctx) {
      // Cold water freezes from a FRONT — a shore or an existing ice margin —
      // not spontaneously across the open sea, so deep polar water stays liquid
      // and ice reads as caps and shelves rather than a solid field.
      return (
        targetOk(this, ctx) &&
        ctx.averageTemperature <= 3 &&
        (ctx.touchesLand || ctx.touchesIce)
      );
    },
    build: (ctx, _w, rng) => ({
      title: "Freeze Over",
      requirements: [
        { type: "targetTerrainIn", terrains: ["ocean", "coast", "lake", "river", "wetland"] },
        { type: "maxTemperature", value: 3 },
      ],
      effects: [
        { type: "setTerrain", terrain: "ice" },
        { type: "setElevation", value: elevationFor("ice", ctx.averageElevation) },
        { type: "adjustTemperature", amount: -3 },
        { type: "addTrait", trait: "frozen" },
      ],
      flavor: pickFlavor(rng, [
        "The cold lays a still white hand over the world.",
        "Water forgets how to move and turns to glass.",
        "Winter writes its name across the tile.",
      ]),
    }),
  },

  // 9. Melt Ice — an existing ice tile thaws at the warm margin (temp >= 4) or
  //    next to lava/volcano. Low ground becomes a lake, higher ground a wetland.
  {
    id: "melt_ice",
    name: "Melt Ice",
    age: "primordial",
    targets: ["ice"],
    canGenerate(ctx) {
      // Thaws at the warm margin or by lava — and CALVES at the open-water edge
      // even in the cold, so a polar ice sheet has a retreat as well as an
      // advance and settles into a fluctuating cap instead of saturating.
      return (
        targetOk(this, ctx) &&
        (ctx.averageTemperature >= 4 || ctx.touchesLava || ctx.touchesVolcano || ctx.touchesOcean)
      );
    },
    build: (ctx, _w, rng) => {
      const low = ctx.averageElevation <= 3;
      const kind: TerrainKind = low ? "lake" : "wetland";
      return {
        title: "Melt Ice",
        requirements: [{ type: "targetTerrainIn", terrains: ["ice"] }],
        effects: [
          { type: "setTerrain", terrain: kind },
          { type: "setElevation", value: elevationFor(kind, ctx.averageElevation) },
          { type: "adjustTemperature", amount: 2 },
          { type: "spreadMoisture", amount: 2, radius: 1 },
        ],
        flavor: pickFlavor(rng, [
          "The thaw releases water held for an age.",
          "Meltwater pools where the ice gives way.",
          "The white retreats and leaves the ground sodden.",
        ]),
      };
    },
  },

  // 9a. Extend Ice — a glacier / ice sheet advances onto adjacent empty frontier
  //     in the cold (avg temp <= 3). The only way to GROW ice onto new ground;
  //     freezing existing water is Freeze's job. Gated to cold so ice can't
  //     creep into temperate land.
  {
    id: "extend_ice",
    name: "Extend Ice",
    age: "primordial",
    targets: ["empty"],
    canGenerate(ctx) {
      return (
        ctx.targetTerrain === "empty" &&
        ctx.adjacentTerrains.includes("ice") &&
        !ctx.touchesLava &&
        ctx.averageTemperature <= 3
      );
    },
    build: (ctx, _w, rng) => ({
      title: "Extend Ice",
      requirements: [
        { type: "targetTerrainIn", terrains: ["empty"] },
        { type: "touchesTerrain", terrain: "ice" },
        { type: "maxTemperature", value: 3 },
      ],
      effects: [
        { type: "setTerrain", terrain: "ice" },
        { type: "setElevation", value: matchElevation("ice", ctx.averageElevation) },
        { type: "adjustMoisture", amount: 3 },
        { type: "addTrait", trait: "glacier" },
      ],
      flavor: pickFlavor(rng, [
        "The ice sheet creeps outward, swallowing the ground.",
        "A glacier advances, grinding over the frontier.",
        "Winter extends its white reach one tile further.",
      ]),
    }),
  },

  // 9b. Form Floodplain — fertile LAND beside fresh water. This is the way
  //     OUT of a water-locked frontier: instead of only ever making more
  //     river/lake, a tile touching fresh water (with no plain to extend) can
  //     become a fertile bank. Fires especially where water has boxed a tile
  //     in, so water no longer begets only water.
  {
    id: "form_floodplain",
    name: "Form Floodplain",
    age: "primordial",
    targets: ["empty"],
    canGenerate(ctx) {
      return (
        ctx.targetTerrain === "empty" &&
        ctx.touchesFreshWater &&
        !ctx.touchesLava &&
        !ctx.adjacentTerrains.includes("plain") && // extend_plain owns that case
        ctx.averageElevation <= 6
      );
    },
    build: (ctx, _w, rng) => ({
      title: "Form Floodplain",
      requirements: [
        { type: "targetTerrainIn", terrains: ["empty"] },
        { type: "touchesAnyTerrain", terrains: ["river", "lake", "wetland"] },
      ],
      effects: [
        { type: "setTerrain", terrain: "plain" },
        { type: "setElevation", value: clamp(Math.max(ctx.averageElevation, 3), 3, 5) },
        { type: "adjustMoisture", amount: 6 },
        { type: "spreadMoisture", amount: 2, radius: 1 },
        { type: "adjustFertility", amount: 3 },
        { type: "addTrait", trait: "fertile" },
      ],
      flavor: pickFlavor(rng, [
        "Silt settles into rich, fertile ground along the water.",
        "The flood leaves behind dark, living soil.",
        "A green bank rises beside the water, ready for life.",
      ]),
    }),
  },

  // 10. Carve River — needs a SOURCE (high ground spring, meltwater, or an
  //     existing river) and extends along an edge rather than filling water.
  {
    id: "carve_river",
    name: "Carve River",
    age: "primordial",
    targets: ["empty", "plain", "wetland", "basalt"],
    canGenerate(ctx) {
      // A river needs a real source — a slope (high ground), meltwater (ice),
      // or an existing river to continue — and must extend along an edge, not
      // fill a water body (so it stays linear instead of blobbing out).
      const hasSource = ctx.touchesHighGround || ctx.touchesIce || ctx.touchesRiver;
      return targetOk(this, ctx) && !ctx.touchesLava && hasSource && adjacentWaterCount(ctx) <= 2;
    },
    build: (ctx, _w, rng) => ({
      title: "Carve River",
      requirements: [
        { type: "targetTerrainIn", terrains: ["empty", "plain", "wetland", "basalt"] },
        { type: "touchesAnyTerrain", terrains: RIVER_SOURCE },
      ],
      effects: [
        { type: "setTerrain", terrain: "river" },
        { type: "setElevation", value: elevationFor("river", ctx.averageElevation) },
        { type: "flowDownhill" },
        { type: "spreadMoisture", amount: 3, radius: 2 },
        { type: "addTrait", trait: "freshwater" },
      ],
      flavor: pickFlavor(rng, [
        "Water finds the lowest path and insists on it.",
        "A river begins its long argument with the land.",
        "Fresh water threads its way down from the heights.",
      ]),
    }),
  },

  // 11. Form Lake — fresh water pools where there is a SOURCE to feed it: an
  //     adjacent river, wetland, lake or meltwater. Pooling water in a dry
  //     hollow with no source is Form Spring's job (a spring-fed pool), so the
  //     two never offer the same lake on the same tile.
  {
    id: "form_lake",
    name: "Form Lake",
    age: "primordial",
    // Not "wetland": deepening a marsh to a lake is Sink Land's job, so the
    // two never offer the same lake on a wetland tile.
    targets: ["empty", "plain", "basalt"],
    canGenerate(ctx) {
      // A lake needs a fresh-water source AND a genuine low spot to collect in
      // (a basin or very low ground), and won't form if the tile is already
      // boxed in by water — otherwise lakes spread into blobs.
      const lowEnough = ctx.isBasin || ctx.averageElevation <= 2;
      return (
        targetOk(this, ctx) &&
        ctx.averageElevation <= 5 &&
        (ctx.touchesFreshWater || ctx.touchesIce) &&
        lowEnough &&
        adjacentWaterCount(ctx) <= 3
      );
    },
    build: (ctx, _w, rng) => ({
      title: "Form Lake",
      requirements: [
        { type: "targetTerrainIn", terrains: ["empty", "plain", "basalt"] },
        { type: "touchesAnyTerrain", terrains: ["river", "lake", "wetland", "ice"] },
        { type: "maxElevation", value: 6 },
      ],
      effects: [
        { type: "setTerrain", terrain: "lake" },
        { type: "setElevation", value: elevationFor("lake", ctx.averageElevation) },
        { type: "adjustMoisture", amount: 5 },
        { type: "spreadMoisture", amount: 3, radius: 2 },
        { type: "adjustFertility", amount: 1 },
        { type: "addTrait", trait: "freshwater" },
      ],
      flavor: pickFlavor(rng, [
        "The water gathers in the hollow and decides to stay.",
        "A still mirror forms in the low ground.",
        "Where water rests, life will one day follow.",
      ]),
    }),
  },

  // 12. Form Spring — groundwater wells up in genuinely DRY interior land (not
  //     touching ANY water, including a coast) that has latent moisture. A
  //     marshy wetland, or a spring-fed pool in a basin. This is the only way
  //     to seed brand-new water away from existing water.
  {
    id: "form_spring",
    name: "Form Spring",
    age: "primordial",
    targets: ["empty", "plain"],
    canGenerate(ctx) {
      return (
        targetOk(this, ctx) &&
        ctx.touchesLand &&
        !ctx.touchesWater &&
        !ctx.touchesLava &&
        ctx.averageMoisture >= 3 &&
        ctx.averageElevation <= 6
      );
    },
    build: (ctx, _w, rng) => {
      const kind: TerrainKind = ctx.isBasin ? "lake" : "wetland";
      return {
        title: kind === "lake" ? "Spring-fed Pool" : "Form Spring",
        requirements: [
          { type: "targetTerrainIn", terrains: ["empty", "plain"] },
          { type: "maxElevation", value: 6 },
        ],
        effects: [
          { type: "setTerrain", terrain: kind },
          { type: "setElevation", value: elevationFor(kind, ctx.averageElevation) },
          { type: "adjustMoisture", amount: 5 },
          { type: "spreadMoisture", amount: 2, radius: 1 },
          { type: "addTrait", trait: "freshwater" },
        ],
        flavor: pickFlavor(rng, [
          "Groundwater finds a weakness and wells up into the light.",
          "A spring bubbles up where the dry land least expected it.",
          "Hidden water surfaces and softens the ground to reed and pool.",
        ]),
      };
    },
  },

  // 13. Wear Down — erosion lowers heights one step: volcano→mountain,
  //     mountain→hill, hill→plain. The world is allowed to come back down.
  {
    id: "wear_down",
    name: "Wear Down",
    age: "primordial",
    targets: ["hill", "mountain", "volcano"],
    canGenerate(ctx) {
      return targetOk(this, ctx);
    },
    build: (ctx, _w, rng) => {
      const out: TerrainKind =
        ctx.targetTerrain === "volcano" ? "mountain" : ctx.targetTerrain === "mountain" ? "hill" : "plain";
      return {
        title: ctx.targetTerrain === "volcano" ? "Volcano Goes Dormant" : "Wear Down",
        requirements: [{ type: "targetTerrainIn", terrains: ["hill", "mountain", "volcano"] }],
        effects: [
          { type: "setTerrain", terrain: out },
          // Step down, but keep the result inside the OUTPUT terrain's band so a
          // worn mountain still reads as a valid hill (not a sub-band height).
          { type: "setElevation", value: matchElevation(out, ctx.targetElevation - 2) },
          { type: "adjustFertility", amount: 1 },
        ],
        flavor: pickFlavor(rng, [
          "Wind and water grind the height down, grain by grain.",
          "The peak slumps, tired after an age of standing.",
          "Time files the mountain toward the plain.",
        ]),
      };
    },
  },
];

/**
 * Lateral feature extension: an empty frontier tile becomes a copy of an
 * adjacent solid feature, at matching height. This is how a feature grows
 * sideways — hill→hill, mountain→mountain, basalt→basalt, wetland→wetland — as
 * opposed to Raise Land, which steps land UP. (Coast/ocean/lava have their own
 * dedicated spread cards.) Excluded next to open ocean so land still meets the
 * sea through a coast, and next to lava so molten rock doesn't get paved over.
 *
 * `sources` are the adjacent terrains that can seed this extension; it defaults
 * to the kind itself, but e.g. Extend Plain grows from any walkable land (a
 * beach's hinterland, a hill's foot), so you can always push grassland inland.
 */
function makeExtend(kind: TerrainKind, label: string, sources: TerrainKind[] = [kind]): CardArchetype {
  return {
    id: `extend_${kind}`,
    name: `Extend ${label}`,
    age: "primordial",
    targets: ["empty"],
    canGenerate(ctx) {
      return (
        ctx.targetTerrain === "empty" &&
        sources.some((s) => ctx.adjacentTerrains.includes(s)) &&
        !ctx.touchesOcean &&
        !ctx.touchesLava
      );
    },
    build(ctx, _w, rng) {
      const noun = label.toLowerCase();
      const moisture = kind === "wetland" ? 7 : kind === "basalt" ? 2 : kind === "mountain" ? 3 : 4;
      // "Extend" when copying an identical neighbor; "Form" when growing this
      // terrain from a different source (e.g. grassland behind a coast/cliff).
      const title = ctx.adjacentTerrains.includes(kind) ? `Extend ${label}` : `Form ${label}`;
      return {
        title,
        requirements: [
          { type: "targetTerrainIn", terrains: ["empty"] },
          { type: "touchesAnyTerrain", terrains: sources },
        ],
        effects: [
          { type: "setTerrain", terrain: kind },
          { type: "setElevation", value: matchElevation(kind, ctx.averageElevation) },
          { type: "adjustMoisture", amount: moisture },
        ],
        flavor: pickFlavor(rng, [
          `The ${noun} spreads into the next tile, of a piece with its neighbor.`,
          `The ${noun} reaches a little further, unbroken.`,
          `What stood here before extends across the edge.`,
        ]),
      };
    },
  };
}

const EXTEND_ARCHETYPES: CardArchetype[] = [
  // Plain grows from any walkable land — so you can push grassland inland from
  // a beach (coast), down from a hill, or behind a cliff, not only from a plain.
  makeExtend("plain", "Plain", ["plain", "coast", "hill", "cliff"]),
  makeExtend("hill", "Hill"),
  makeExtend("mountain", "Mountain"),
  makeExtend("basalt", "Basalt"),
  makeExtend("wetland", "Wetland"),
];

export const ARCHETYPES: CardArchetype[] = [...PRIMARY_ARCHETYPES, ...EXTEND_ARCHETYPES];

export const ARCHETYPES_BY_ID: Record<string, CardArchetype> = Object.fromEntries(
  ARCHETYPES.map((a) => [a.id, a]),
);
