import type { Rng } from "../engine/rng";
import type { TileContext, WorldAge } from "../engine/card";
import type { Effect, Requirement } from "../engine/effects";
import type { WorldState } from "../engine/world";

/**
 * A card archetype is pure data + two functions:
 *  - canGenerate: would this card make sense on the assigned tile?
 *  - build:       produce the concrete title/requirements/effects/flavor.
 *
 * Cards are GROWN from the map. Every archetype's canGenerate reads only the
 * TileContext, so the same neighborhood always offers the same possibilities.
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

const pickFlavor = (rng: Rng, options: string[]): string => rng.pick(options);

export const ARCHETYPES: CardArchetype[] = [
  // 1. Raise Land — empty/ocean/coast tile next to land becomes solid ground.
  {
    id: "raise_land",
    name: "Raise Land",
    age: "primordial",
    canGenerate: (ctx) =>
      ctx.touchesLand || ctx.touchesOcean || ctx.touchesWater,
    build: (ctx, _w, rng) => {
      const becomesHill = ctx.averageElevation >= 4 && rng.next() > 0.5;
      return {
        title: becomesHill ? "Raise Hill" : "Raise Land",
        requirements: [{ type: "targetIsEmpty" }],
        effects: [
          { type: "setTerrain", terrain: becomesHill ? "hill" : "plain" },
          { type: "adjustElevation", amount: becomesHill ? 4 : 3 },
          { type: "adjustMoisture", amount: -1 },
        ],
        flavor: pickFlavor(rng, [
          "The seabed groans and lifts toward the light.",
          "New ground breaches the surface, raw and bare.",
          "The land remembers how to be solid.",
        ]),
      };
    },
  },

  // 2. Sink Land — drop a tile near water down toward coast/ocean.
  {
    id: "sink_land",
    name: "Sink Land",
    age: "primordial",
    canGenerate: (ctx) => ctx.touchesWater || ctx.touchesOcean,
    build: (ctx, _w, rng) => {
      const toOcean = ctx.touchesOcean && ctx.averageElevation <= 2;
      return {
        title: toOcean ? "Drown the Shore" : "Sink Land",
        requirements: [{ type: "targetIsEmpty" }, { type: "touchesAnyTerrain", terrains: ["ocean", "coast", "lake", "river", "wetland"] }],
        effects: [
          { type: "setTerrain", terrain: toOcean ? "ocean" : "coast" },
          { type: "adjustElevation", amount: toOcean ? -2 : -1 },
          { type: "adjustMoisture", amount: 3 },
        ],
        flavor: pickFlavor(rng, [
          "The ground loses its argument with the sea.",
          "Water claims what the land could not hold.",
          "The shore slips quietly under the tide.",
        ]),
      };
    },
  },

  // 3. Form Coast — a tile touching both land and ocean resolves into coast.
  {
    id: "form_coast",
    name: "Form Coast",
    age: "primordial",
    canGenerate: (ctx) => ctx.touchesOcean && ctx.touchesLand,
    build: (_ctx, _w, rng) => ({
      title: "Form Coast",
      requirements: [
        { type: "targetIsEmpty" },
        { type: "touchesTerrain", terrain: "ocean" },
      ],
      effects: [
        { type: "setTerrain", terrain: "coast" },
        { type: "adjustElevation", amount: 2 },
        { type: "adjustMoisture", amount: 4 },
      ],
      flavor: pickFlavor(rng, [
        "Land and water agree on a border, for now.",
        "A beach is negotiated between stone and surf.",
        "The edge of the world sharpens into shore.",
      ]),
    }),
  },

  // 4. Erupt Volcano — a frontier tile (esp. near mountains/lava) erupts.
  {
    id: "erupt_volcano",
    name: "Erupt Volcano",
    age: "primordial",
    canGenerate: (ctx) =>
      ctx.touchesLand || ctx.touchesMountain || ctx.touchesLava || ctx.touchesVolcano,
    build: (_ctx, _w, rng) => ({
      title: "Erupt Volcano",
      requirements: [{ type: "targetIsEmpty" }],
      effects: [
        { type: "setTerrain", terrain: "volcano" },
        { type: "adjustElevation", amount: 5 },
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

  // 5. Spread Lava — lava/volcano spills onto an adjacent tile.
  {
    id: "spread_lava",
    name: "Spread Lava",
    age: "primordial",
    canGenerate: (ctx) => ctx.touchesLava || ctx.touchesVolcano,
    build: (_ctx, _w, rng) => ({
      title: "Spread Lava",
      requirements: [
        { type: "targetIsEmpty" },
        { type: "touchesAnyTerrain", terrains: ["lava", "volcano"] },
      ],
      effects: [
        { type: "setTerrain", terrain: "lava" },
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

  // 6. Cool Lava — lava beside water (or that has aged) hardens to basalt.
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

  // 7. Freeze — water/coast/mountain or cold context turns to ice.
  {
    id: "freeze",
    name: "Freeze",
    age: "primordial",
    canGenerate: (ctx) =>
      (ctx.touchesWater || ctx.touchesMountain || ctx.touchesIce) &&
      ctx.averageTemperature <= 6,
    build: (_ctx, _w, rng) => ({
      title: "Freeze",
      requirements: [
        { type: "targetIsEmpty" },
        { type: "maxTemperature", value: 6 },
      ],
      effects: [
        { type: "setTerrain", terrain: "ice" },
        { type: "adjustTemperature", amount: -4 },
        { type: "addTrait", trait: "frozen" },
      ],
      flavor: pickFlavor(rng, [
        "The cold lays a still white hand over the world.",
        "Water forgets how to move and turns to glass.",
        "Winter writes its name across the tile.",
      ]),
    }),
  },

  // 8. Melt Ice — ice in a warm neighborhood returns to water/wetland/plain.
  {
    id: "melt_ice",
    name: "Melt Ice",
    age: "primordial",
    canGenerate: (ctx) => ctx.touchesIce && ctx.averageTemperature >= 4,
    build: (ctx, _w, rng) => {
      const low = ctx.averageElevation <= 3;
      return {
        title: "Melt Ice",
        requirements: [
          { type: "targetIsEmpty" },
          { type: "touchesTerrain", terrain: "ice" },
        ],
        effects: [
          { type: "setTerrain", terrain: low ? "lake" : "wetland" },
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

  // 9. Carve River — near high ground or a water source, channel a river.
  {
    id: "carve_river",
    name: "Carve River",
    age: "primordial",
    canGenerate: (ctx) =>
      (ctx.touchesWater || ctx.touchesMountain || ctx.averageElevation >= 4) &&
      !ctx.touchesLava,
    build: (_ctx, _w, rng) => ({
      title: "Carve River",
      requirements: [{ type: "targetIsEmpty" }],
      effects: [
        { type: "setTerrain", terrain: "river" },
        { type: "adjustElevation", amount: -1 },
        { type: "spreadMoisture", amount: 3, radius: 1 },
        { type: "addTrait", trait: "freshwater" },
      ],
      flavor: pickFlavor(rng, [
        "Water finds the lowest path and insists on it.",
        "A river begins its long argument with the land.",
        "Fresh water threads its way toward the sea.",
      ]),
    }),
  },

  // 10. Form Lake — low ground touching river/wetland/ice collects water.
  {
    id: "form_lake",
    name: "Form Lake",
    age: "primordial",
    canGenerate: (ctx) =>
      ctx.averageElevation <= 4 &&
      (ctx.touchesRiver || ctx.touchesIce || ctx.adjacentTerrains.includes("wetland")),
    build: (_ctx, _w, rng) => ({
      title: "Form Lake",
      requirements: [
        { type: "targetIsEmpty" },
        { type: "maxElevation", value: 5 },
      ],
      effects: [
        { type: "setTerrain", terrain: "lake" },
        { type: "adjustMoisture", amount: 5 },
        { type: "adjustFertility", amount: 1 },
        { type: "addTrait", trait: "freshwater" },
      ],
      flavor: pickFlavor(rng, [
        "The water gathers and decides to stay.",
        "A still mirror forms in the hollow of the land.",
        "Where water rests, life will one day follow.",
      ]),
    }),
  },
];

export const ARCHETYPES_BY_ID: Record<string, CardArchetype> = Object.fromEntries(
  ARCHETYPES.map((a) => [a.id, a]),
);
