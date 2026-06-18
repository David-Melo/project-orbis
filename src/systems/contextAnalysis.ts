import {
  FRESH_WATER_TERRAINS,
  HIGH_GROUND_TERRAINS,
  LAND_TERRAINS,
  WATER_TERRAINS,
  type TerrainKind,
  type TileEntity,
} from "../engine/components";
import {
  orthogonalNeighbors,
  tilesWithinRadius,
  type WorldState,
} from "../engine/world";
import type { TileContext } from "../engine/card";

/**
 * ContextAnalysisSystem.
 *
 * Summarizes the neighborhood around a tile so the card generator can decide
 * which futures are plausible. Elevation and moisture are averaged over
 * NON-EMPTY neighbors only: empty frontier tiles carry placeholder values and
 * would otherwise wash out the real local terrain (this is what made the old
 * "elevation >= 4" gate fire almost everywhere). Temperature is averaged over
 * all neighbors because every tile carries a meaningful latitude temperature.
 */
export function analyzeContext(world: WorldState, tile: TileEntity): TileContext {
  const adjacent = orthogonalNeighbors(world, tile);
  const nearby = tilesWithinRadius(world, tile, 2);

  const adjacentTerrains = adjacent.map((t) => t.terrain.kind);
  const nearbyTerrains = nearby.map((t) => t.terrain.kind);

  const touches = (kind: TerrainKind) => adjacentTerrains.includes(kind);
  const touchesSet = (set: ReadonlySet<TerrainKind>) =>
    adjacentTerrains.some((k) => set.has(k));

  const landNeighbors = nearby.filter((t) => t.terrain.kind !== "empty" && t.terrain.kind !== "void");
  const avgElevation = average(landNeighbors.map((t) => t.elevation.value));

  // A basin is a low spot ringed by land that could collect water: mostly
  // surrounded by land of low-to-moderate height, and (for existing tiles) not
  // standing higher than its surroundings.
  const isBasin =
    landNeighbors.length >= 3 &&
    avgElevation >= 2 &&
    avgElevation <= 6 &&
    (tile.terrain.kind === "empty" || tile.elevation.value <= avgElevation);

  return {
    targetTileId: tile.id,
    targetX: tile.position.x,
    targetY: tile.position.y,
    targetTerrain: tile.terrain.kind,
    targetElevation: tile.elevation.value,
    isBasin,
    adjacentTerrains,
    nearbyTerrains,
    touchesWater: touchesSet(WATER_TERRAINS),
    touchesOcean: touches("ocean"),
    touchesRiver: touches("river"),
    touchesLake: touches("lake"),
    touchesLava: touches("lava"),
    touchesIce: touches("ice"),
    touchesVolcano: touches("volcano"),
    touchesMountain: touches("mountain"),
    touchesLand: touchesSet(LAND_TERRAINS),
    touchesFreshWater: touchesSet(FRESH_WATER_TERRAINS),
    touchesHighGround: touchesSet(HIGH_GROUND_TERRAINS),
    landNeighborCount: landNeighbors.length,
    averageElevation: avgElevation,
    averageMoisture: average(landNeighbors.map((t) => t.moisture.value)),
    averageTemperature: average(nearby.map((t) => t.temperature.value)),
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 10) / 10;
}
