import type { TileContext } from "../engine/card";
import { defaultSurfaceFor, type TerrainKind, type TileEntity } from "../engine/components";
import { getTileAt, type WorldState } from "../engine/world";
import { Rng } from "../engine/rng";
import { ARCHETYPES_BY_ID } from "../cards/archetypes";

const WATER: TerrainKind[] = ["ocean", "coast", "river", "lake", "wetland"];
const FRESH: TerrainKind[] = ["river", "lake", "wetland"];
const HIGH: TerrainKind[] = ["hill", "mountain", "volcano"];
const LAND: TerrainKind[] = ["coast", "plain", "hill", "mountain", "volcano", "basalt"];

/**
 * Build a synthetic TileContext from a list of adjacent terrains plus optional
 * overrides. Touch-flags are derived from `adjacent`; numeric defaults describe
 * a temperate, mid-elevation neighborhood. `targetTerrain` defaults to "empty"
 * (a frontier tile); pass it to test transforms of existing tiles.
 */
export function makeContext(adjacent: TerrainKind[], over: Partial<TileContext> = {}): TileContext {
  const has = (k: TerrainKind) => adjacent.includes(k);
  return {
    targetTileId: "t",
    targetX: 5,
    targetY: 5,
    targetTerrain: "empty",
    targetElevation: 0,
    isBasin: false,
    adjacentTerrains: adjacent,
    nearbyTerrains: adjacent,
    touchesWater: adjacent.some((k) => WATER.includes(k)),
    touchesOcean: has("ocean"),
    touchesRiver: has("river"),
    touchesLake: has("lake"),
    touchesLava: has("lava"),
    touchesIce: has("ice"),
    touchesVolcano: has("volcano"),
    touchesMountain: has("mountain"),
    touchesLand: adjacent.some((k) => LAND.includes(k)),
    touchesFreshWater: adjacent.some((k) => FRESH.includes(k)),
    touchesHighGround: adjacent.some((k) => HIGH.includes(k)),
    landNeighborCount: adjacent.length,
    averageElevation: 4,
    averageMoisture: 5,
    averageTemperature: 7,
    ...over,
  };
}

/** Does an archetype generate for this context? */
export function canGen(archetypeId: string, ctx: TileContext): boolean {
  return ARCHETYPES_BY_ID[archetypeId].canGenerate(ctx, {} as WorldState);
}

/** Build an archetype's card result with a deterministic RNG. */
export function build(archetypeId: string, ctx: TileContext) {
  return ARCHETYPES_BY_ID[archetypeId].build(ctx, {} as WorldState, new Rng(1));
}

/** The terrain a card would set, or undefined if it sets none. */
export function resultTerrain(archetypeId: string, ctx: TileContext): TerrainKind | undefined {
  const effect = build(archetypeId, ctx).effects.find((e) => e.type === "setTerrain");
  return effect && effect.type === "setTerrain" ? effect.terrain : undefined;
}

/** The elevation a card would set, or undefined if it sets none. */
export function resultElevation(archetypeId: string, ctx: TileContext): number | undefined {
  const effect = build(archetypeId, ctx).effects.find((e) => e.type === "setElevation");
  return effect && effect.type === "setElevation" ? effect.value : undefined;
}

/** A fully-empty world for system tests (no seeded island). */
export function emptyWorld(size = 7): WorldState {
  const tiles: TileEntity[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      tiles.push({
        id: `t_${x}_${y}`,
        position: { x, y },
        terrain: { kind: "empty" },
        elevation: { value: 0 },
        moisture: { value: 0 },
        temperature: { value: 5 },
        fertility: { value: 0 },
        surface: defaultSurfaceFor("empty"),
        connections: {},
        traits: { traits: [] },
        history: { eventIds: [] },
      });
    }
  }
  return { id: "w", width: size, height: size, seed: 1, rngState: 1, currentDay: 0, tiles, events: [] };
}

/** Paint a single tile in a test world. */
export function setTile(
  world: WorldState,
  x: number,
  y: number,
  kind: TerrainKind,
  elevation = 0,
  moisture = 0,
): TileEntity | undefined {
  const t = getTileAt(world, x, y);
  if (!t) return undefined;
  t.terrain.kind = kind;
  t.elevation.value = elevation;
  t.moisture.value = moisture;
  t.surface = defaultSurfaceFor(kind);
  return t;
}

/** Coherent elevation band per terrain (used to assert continuity). */
export const ELEVATION_BANDS: Partial<Record<TerrainKind, [number, number]>> = {
  ocean: [0, 1],
  coast: [1, 3],
  cliff: [5, 9],
  wetland: [1, 3],
  lake: [0, 4],
  river: [1, 7],
  plain: [3, 6],
  hill: [5, 8],
  mountain: [6, 10],
  volcano: [7, 10],
};

/**
 * Sensible moisture band per terrain — wet at the water, dry on the heights
 * and the volcanic rock. Used to assert the hand-authored seed is logically
 * consistent with how terrain "should" read, since everything derives from it.
 */
export const MOISTURE_BANDS: Partial<Record<TerrainKind, [number, number]>> = {
  ocean: [8, 10],
  coast: [5, 9],
  cliff: [2, 6],
  wetland: [7, 10],
  lake: [7, 10],
  river: [6, 10],
  plain: [3, 7],
  hill: [2, 6],
  mountain: [1, 4],
  volcano: [0, 3],
  lava: [0, 2],
  basalt: [1, 4],
  ice: [1, 5],
};
