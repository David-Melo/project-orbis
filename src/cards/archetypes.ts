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

const LAND_TOUCH: TerrainKind[] = ["coast", "plain", "hill", "mountain", "volcano", "basalt"];
const WATER_TOUCH: TerrainKind[] = ["ocean", "coast", "lake", "river", "wetland"];
const RIVER_SOURCE: TerrainKind[] = ["hill", "mountain", "volcano", "river", "lake", "wetland", "ice"];
const FREEZABLE_TOUCH: TerrainKind[] = ["ocean", "coast", "lake", "river", "wetland", "ice", "mountain"];
const WATER_KINDS: TerrainKind[] = ["ocean", "coast", "lake", "river", "wetland"];

const clamp = (v: number, lo = 0, hi = 10) => Math.max(lo, Math.min(hi, Math.round(v)));

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

const pickFlavor = (rng: Rng, options: string[]): string => rng.pick(options);

export const ARCHETYPES: CardArchetype[] = [
  // 1. Raise Land — UPLIFT. Builds new inland ground on empty/coast, and lifts
  //    existing land one step up the chain: plain -> hill -> mountain. Touches
  //    land, NOT open ocean, so a plain never forms directly on the sea. This
  //    is the inverse of Wear Down.
  {
    id: "raise_land",
    name: "Raise Land",
    age: "primordial",
    targets: ["empty", "coast", "plain", "hill"],
    canGenerate(ctx) {
      return targetOk(this, ctx) && ctx.touchesLand && !ctx.touchesOcean;
    },
    build: (ctx, _w, rng) => {
      let kind: TerrainKind;
      let value: number;
      if (ctx.targetTerrain === "plain") {
        kind = "hill";
        value = clamp(ctx.targetElevation + 2, 5, 8);
      } else if (ctx.targetTerrain === "hill") {
        kind = "mountain";
        value = clamp(ctx.targetElevation + 2, 7, 10);
      } else {
        // empty or coast: new ground, hill if the surrounding land is high.
        kind = ctx.averageElevation >= 5 ? "hill" : "plain";
        value = elevationFor(kind, ctx.averageElevation);
      }
      const title =
        kind === "mountain" ? "Raise Mountain" : kind === "hill" ? "Raise Hill" : "Raise Land";
      return {
        title,
        requirements: [
          { type: "targetTerrainIn", terrains: ["empty", "coast", "plain", "hill"] },
          { type: "touchesAnyTerrain", terrains: LAND_TOUCH },
        ],
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
    targets: ["empty", "plain"],
    canGenerate(ctx) {
      return (
        targetOk(this, ctx) &&
        ctx.adjacentTerrains.includes("coast") &&
        !ctx.touchesOcean &&
        !ctx.touchesLava &&
        ctx.averageElevation <= 5
      );
    },
    build: (ctx, _w, rng) => ({
      title: ctx.targetTerrain === "plain" ? "Form Beach" : "Extend Coast",
      requirements: [
        { type: "targetTerrainIn", terrains: ["empty", "plain"] },
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

  // 4. Spread Ocean — the sea grows into low, ocean-adjacent frontier, and can
  //    ERODE a coast or wetland back into open water.
  {
    id: "spread_ocean",
    name: "Spread Ocean",
    age: "primordial",
    targets: ["empty", "coast", "wetland"],
    canGenerate(ctx) {
      return targetOk(this, ctx) && ctx.touchesOcean && ctx.averageElevation <= 3;
    },
    build: (ctx, _w, rng) => ({
      title: ctx.targetTerrain === "empty" ? "Spread Ocean" : "Erode Shore",
      requirements: [
        { type: "targetTerrainIn", terrains: ["empty", "coast", "wetland"] },
        { type: "touchesTerrain", terrain: "ocean" },
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

  // 4. Sink Land — low ground beside water subsides into marshy WETLAND. Works
  //    on empty frontier OR an existing plain/coast/hill (subsidence).
  {
    id: "sink_land",
    name: "Sink Land",
    age: "primordial",
    targets: ["empty", "plain", "coast", "hill"],
    canGenerate(ctx) {
      return (
        targetOk(this, ctx) &&
        (ctx.touchesOcean || ctx.touchesFreshWater) &&
        ctx.averageElevation <= 4
      );
    },
    build: (ctx, _w, rng) => ({
      title: ctx.targetTerrain === "empty" ? "Sink Land" : "Subside to Marsh",
      requirements: [
        { type: "targetTerrainIn", terrains: ["empty", "plain", "coast", "hill"] },
        { type: "touchesAnyTerrain", terrains: WATER_TOUCH },
      ],
      effects: [
        { type: "setTerrain", terrain: "wetland" },
        { type: "setElevation", value: elevationFor("wetland", ctx.averageElevation) },
        { type: "adjustMoisture", amount: 4 },
        { type: "addTrait", trait: "marsh" },
      ],
      flavor: pickFlavor(rng, [
        "The ground loses its argument with the water and softens to marsh.",
        "Low land sinks into reed, mud, and standing pools.",
        "Water seeps in and the soil gives way to wetland.",
      ]),
    }),
  },

  // 5. Erupt Volcano — a frontier tile, or existing land, erupts into a peak.
  {
    id: "erupt_volcano",
    name: "Erupt Volcano",
    age: "primordial",
    targets: ["empty", "plain", "hill", "mountain", "coast", "basalt"],
    canGenerate(ctx) {
      return targetOk(this, ctx) && (ctx.touchesLand || ctx.touchesLava || ctx.touchesVolcano);
    },
    build: (ctx, _w, rng) => ({
      title: "Erupt Volcano",
      requirements: [
        { type: "targetTerrainIn", terrains: ["empty", "plain", "hill", "mountain", "coast", "basalt"] },
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

  // 8. Freeze — genuine cold turns an empty tile OR open water into ice.
  {
    id: "freeze",
    name: "Freeze",
    age: "primordial",
    targets: ["empty", "ocean", "coast", "lake", "river", "wetland"],
    canGenerate(ctx) {
      if (!targetOk(this, ctx)) return false;
      const cold = ctx.touchesIce || ctx.averageTemperature <= 3;
      const freezable =
        WATER_KINDS.includes(ctx.targetTerrain) ||
        ctx.adjacentTerrains.some((t) => FREEZABLE_TOUCH.includes(t));
      return cold && freezable;
    },
    build: (ctx, _w, rng) => ({
      title: WATER_KINDS.includes(ctx.targetTerrain) ? "Freeze Over" : "Freeze",
      requirements: [
        { type: "targetTerrainIn", terrains: ["empty", "ocean", "coast", "lake", "river", "wetland"] },
        { type: "maxTemperature", value: 4 },
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

  // 9. Melt Ice — an existing ice tile in warm air returns to water. Low ground
  //    becomes a lake, higher ground a wetland.
  {
    id: "melt_ice",
    name: "Melt Ice",
    age: "primordial",
    targets: ["ice"],
    canGenerate(ctx) {
      return targetOk(this, ctx) && ctx.averageTemperature >= 4;
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

  // 10. Carve River — needs a SOURCE (high ground spring or existing fresh
  //     water/ice). Can cut through empty frontier OR existing plain/wetland.
  {
    id: "carve_river",
    name: "Carve River",
    age: "primordial",
    targets: ["empty", "plain", "wetland", "basalt"],
    canGenerate(ctx) {
      return (
        targetOk(this, ctx) &&
        !ctx.touchesLava &&
        (ctx.touchesHighGround || ctx.touchesFreshWater || ctx.touchesIce)
      );
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
        { type: "spreadMoisture", amount: 3, radius: 1 },
        { type: "addTrait", trait: "freshwater" },
      ],
      flavor: pickFlavor(rng, [
        "Water finds the lowest path and insists on it.",
        "A river begins its long argument with the land.",
        "Fresh water threads its way down from the heights.",
      ]),
    }),
  },

  // 11. Form Lake — fresh water pools in a genuine low BASIN. Fed by a river /
  //     wetland / meltwater, OR simply collected in a hollow ringed by land —
  //     so you can branch a brand-new lake into shaped continent.
  {
    id: "form_lake",
    name: "Form Lake",
    age: "primordial",
    targets: ["empty", "plain", "wetland", "basalt"],
    canGenerate(ctx) {
      return (
        targetOk(this, ctx) &&
        ctx.averageElevation <= 5 &&
        (ctx.touchesFreshWater || ctx.touchesIce || ctx.isBasin)
      );
    },
    build: (ctx, _w, rng) => ({
      title: ctx.isBasin && !ctx.touchesFreshWater ? "Flood Basin" : "Form Lake",
      requirements: [
        { type: "targetTerrainIn", terrains: ["empty", "plain", "wetland", "basalt"] },
        { type: "maxElevation", value: 6 },
      ],
      effects: [
        { type: "setTerrain", terrain: "lake" },
        { type: "setElevation", value: elevationFor("lake", ctx.averageElevation) },
        { type: "adjustMoisture", amount: 5 },
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

  // 12. Form Spring — groundwater wells up on dry land that has some latent
  //     moisture and isn't already beside water. A marshy wetland, or a
  //     spring-fed pool if it sits in a basin. This is how you seed brand-new
  //     water into dry interior instead of being stuck with raise/erupt.
  {
    id: "form_spring",
    name: "Form Spring",
    age: "primordial",
    targets: ["empty", "plain"],
    canGenerate(ctx) {
      return (
        targetOk(this, ctx) &&
        ctx.touchesLand &&
        !ctx.touchesOcean &&
        !ctx.touchesLava &&
        !ctx.touchesFreshWater &&
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
          { type: "setElevation", value: clamp(ctx.targetElevation - 2) },
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

export const ARCHETYPES_BY_ID: Record<string, CardArchetype> = Object.fromEntries(
  ARCHETYPES.map((a) => [a.id, a]),
);
