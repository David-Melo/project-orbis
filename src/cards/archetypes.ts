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
 * Cards are GROWN from the map. Every archetype's canGenerate reads only the
 * TileContext, so the same neighborhood always offers the same possibilities.
 *
 * Two design rules drive this primordial set:
 *  1. Terrain transitions respect neighbors — the ocean meets land only
 *     through a coast; rivers need a source; ice needs cold.
 *  2. Elevation is continuous — a new tile's height is derived from the
 *     average height of its existing neighbors, stepped per terrain, never an
 *     arbitrary jump. See elevationFor().
 */
export type CardArchetype = {
  id: string;
  name: string;
  age: WorldAge;
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

const clamp = (v: number, lo = 0, hi = 10) => Math.max(lo, Math.min(hi, Math.round(v)));

/**
 * Derive a continuous elevation for a new tile of `kind` from the average
 * height of its existing neighbors (`base`). Each terrain steps relative to
 * that base and is clamped to a believable band, so heights flow smoothly:
 * a plain rises one step above the land behind it, a coast settles near sea
 * level, a volcano towers, a river cuts slightly below its surroundings.
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
  // 1. Raise Land — INLAND growth only. Touches land but NOT open ocean, so
  //    you can never get a plain directly against the sea (coast must come
  //    first). Rises one step above the surrounding land.
  {
    id: "raise_land",
    name: "Raise Land",
    age: "primordial",
    canGenerate: (ctx) => ctx.touchesLand && !ctx.touchesOcean,
    build: (ctx, _w, rng) => {
      const becomesHill = ctx.averageElevation >= 5;
      const kind: TerrainKind = becomesHill ? "hill" : "plain";
      return {
        title: becomesHill ? "Raise Hill" : "Raise Land",
        requirements: [
          { type: "targetIsEmpty" },
          { type: "touchesAnyTerrain", terrains: LAND_TOUCH },
        ],
        effects: [
          { type: "setTerrain", terrain: kind },
          { type: "setElevation", value: elevationFor(kind, ctx.averageElevation) },
          { type: "adjustMoisture", amount: -1 },
        ],
        flavor: pickFlavor(rng, [
          "The land rises another step from the ground behind it.",
          "New earth swells gently above its neighbors.",
          "The continent reaches a little further inland.",
        ]),
      };
    },
  },

  // 2. Form Coast — the ONLY way an ocean-adjacent empty tile becomes solid.
  //    Resolves the land/water boundary into a shoreline near sea level.
  {
    id: "form_coast",
    name: "Form Coast",
    age: "primordial",
    canGenerate: (ctx) => ctx.touchesOcean,
    build: (ctx, _w, rng) => ({
      title: "Form Coast",
      requirements: [
        { type: "targetIsEmpty" },
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

  // 3. Spread Ocean — lets the sea grow into low, ocean-adjacent frontier.
  {
    id: "spread_ocean",
    name: "Spread Ocean",
    age: "primordial",
    canGenerate: (ctx) => ctx.touchesOcean && ctx.averageElevation <= 3,
    build: (_ctx, _w, rng) => ({
      title: "Spread Ocean",
      requirements: [
        { type: "targetIsEmpty" },
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
        "Open water deepens and widens.",
        "The ocean remembers it was here first.",
      ]),
    }),
  },

  // 4. Sink Land — low ground beside water subsides into marshy WETLAND (not
  //    open ocean; growing the sea is Spread Ocean's job). This is the only
  //    way to get marsh next to salt water, and it reads distinctly: reeds and
  //    mud rather than open water.
  {
    id: "sink_land",
    name: "Sink Land",
    age: "primordial",
    canGenerate: (ctx) =>
      (ctx.touchesOcean || ctx.touchesFreshWater) && ctx.averageElevation <= 4,
    build: (ctx, _w, rng) => ({
      title: "Sink Land",
      requirements: [
        { type: "targetIsEmpty" },
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

  // 5. Erupt Volcano — a frontier tile near land/lava erupts into a towering
  //    peak. A future source for rivers and lava.
  {
    id: "erupt_volcano",
    name: "Erupt Volcano",
    age: "primordial",
    canGenerate: (ctx) => ctx.touchesLand || ctx.touchesLava || ctx.touchesVolcano,
    build: (ctx, _w, rng) => ({
      title: "Erupt Volcano",
      requirements: [{ type: "targetIsEmpty" }],
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

  // 6. Spread Lava — lava/volcano spills onto an adjacent tile, flowing at a
  //    similar height to its source.
  {
    id: "spread_lava",
    name: "Spread Lava",
    age: "primordial",
    canGenerate: (ctx) => ctx.touchesLava || ctx.touchesVolcano,
    build: (ctx, _w, rng) => ({
      title: "Spread Lava",
      requirements: [
        { type: "targetIsEmpty" },
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
  {
    id: "cool_lava",
    name: "Cool Lava",
    age: "primordial",
    canGenerate: (ctx) =>
      ctx.touchesLava && (ctx.touchesWater || ctx.touchesIce || ctx.averageTemperature <= 6),
    build: (ctx, _w, rng) => ({
      title: ctx.touchesWater ? "Quench Lava" : "Cool Lava",
      requirements: [
        { type: "targetIsEmpty" },
        { type: "touchesTerrain", terrain: "lava" },
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

  // 8. Freeze — needs GENUINE cold: already-icy neighbors or a cold latitude,
  //    plus something freezable adjacent. No more freezing temperate frontier.
  {
    id: "freeze",
    name: "Freeze",
    age: "primordial",
    canGenerate: (ctx) =>
      (ctx.touchesIce || ctx.averageTemperature <= 3) &&
      ctx.adjacentTerrains.some((t) => FREEZABLE_TOUCH.includes(t)),
    build: (ctx, _w, rng) => ({
      title: "Freeze",
      requirements: [
        { type: "targetIsEmpty" },
        { type: "maxTemperature", value: 4 },
        { type: "touchesAnyTerrain", terrains: FREEZABLE_TOUCH },
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

  // 9. Melt Ice — ice in a warm-enough neighborhood returns to water. Low
  //    ground becomes a lake, higher ground a wetland.
  {
    id: "melt_ice",
    name: "Melt Ice",
    age: "primordial",
    canGenerate: (ctx) => ctx.touchesIce && ctx.averageTemperature >= 4,
    build: (ctx, _w, rng) => {
      const low = ctx.averageElevation <= 3;
      const kind: TerrainKind = low ? "lake" : "wetland";
      return {
        title: "Melt Ice",
        requirements: [
          { type: "targetIsEmpty" },
          { type: "touchesTerrain", terrain: "ice" },
        ],
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

  // 10. Carve River — needs a SOURCE: adjacent high ground (a spring) or
  //     existing fresh water/ice to extend. Never spawns from the salt ocean.
  //     Cuts slightly below the surrounding land.
  {
    id: "carve_river",
    name: "Carve River",
    age: "primordial",
    canGenerate: (ctx) =>
      !ctx.touchesLava && (ctx.touchesHighGround || ctx.touchesFreshWater || ctx.touchesIce),
    build: (ctx, _w, rng) => ({
      title: "Carve River",
      requirements: [
        { type: "targetIsEmpty" },
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

  // 11. Form Lake — fresh water pools in a genuine LOW basin fed by a river,
  //     wetland or meltwater.
  {
    id: "form_lake",
    name: "Form Lake",
    age: "primordial",
    canGenerate: (ctx) =>
      ctx.averageElevation <= 3 && (ctx.touchesFreshWater || ctx.touchesIce),
    build: (ctx, _w, rng) => ({
      title: "Form Lake",
      requirements: [
        { type: "targetIsEmpty" },
        { type: "maxElevation", value: 3 },
        { type: "touchesAnyTerrain", terrains: ["river", "lake", "wetland", "ice"] },
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
];

export const ARCHETYPES_BY_ID: Record<string, CardArchetype> = Object.fromEntries(
  ARCHETYPES.map((a) => [a.id, a]),
);
