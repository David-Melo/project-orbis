import { WATER_TERRAINS, type TerrainKind, type TileEntity } from "../engine/components";
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
 * which futures are plausible. This is the heart of "the map tells the player
 * what is possible": cards are derived purely from this context object.
 */
export function analyzeContext(world: WorldState, tile: TileEntity): TileContext {
  const adjacent = orthogonalNeighbors(world, tile);
  const nearby = tilesWithinRadius(world, tile, 2);

  const adjacentTerrains = adjacent.map((t) => t.terrain.kind);
  const nearbyTerrains = nearby.map((t) => t.terrain.kind);

  const touches = (kind: TerrainKind) => adjacentTerrains.includes(kind);
  const touchesAny = (kinds: TerrainKind[]) =>
    adjacentTerrains.some((k) => kinds.includes(k));

  const landKinds: TerrainKind[] = ["plain", "hill", "mountain", "basalt", "coast"];

  return {
    targetTileId: tile.id,
    targetX: tile.position.x,
    targetY: tile.position.y,
    adjacentTerrains,
    nearbyTerrains,
    touchesWater: touchesAny([...WATER_TERRAINS]),
    touchesOcean: touches("ocean"),
    touchesRiver: touches("river"),
    touchesLake: touches("lake"),
    touchesLava: touches("lava"),
    touchesIce: touches("ice"),
    touchesVolcano: touches("volcano"),
    touchesMountain: touches("mountain"),
    touchesLand: touchesAny(landKinds),
    averageElevation: average(nearby.map((t) => t.elevation.value)),
    averageMoisture: average(nearby.map((t) => t.moisture.value)),
    averageTemperature: average(nearby.map((t) => t.temperature.value)),
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 10) / 10;
}
