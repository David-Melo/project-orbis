import type { Requirement } from "../engine/effects";
import type { TileContext } from "../engine/card";
import { getTile, type WorldState } from "../engine/world";

/**
 * RequirementValidationSystem.
 *
 * Checks a single requirement against the target tile and its context. Used
 * both when generating cards (to filter archetypes) and again at play time
 * (to ensure the world hasn't changed underneath a selected card).
 */
export function checkRequirement(
  req: Requirement,
  ctx: TileContext,
  world: WorldState,
): boolean {
  const tile = getTile(world, ctx.targetTileId);
  if (!tile) return false;

  switch (req.type) {
    case "targetIsEmpty":
      return tile.terrain.kind === "empty";
    case "targetTerrainIn":
      return req.terrains.includes(tile.terrain.kind);
    case "touchesTerrain":
      return ctx.adjacentTerrains.includes(req.terrain);
    case "touchesAnyTerrain":
      return ctx.adjacentTerrains.some((t) => req.terrains.includes(t));
    case "nearTerrain":
      return ctx.nearbyTerrains.includes(req.terrain);
    case "minElevation":
      return ctx.averageElevation >= req.value;
    case "maxElevation":
      return ctx.averageElevation <= req.value;
    case "minMoisture":
      return ctx.averageMoisture >= req.value;
    case "maxMoisture":
      return ctx.averageMoisture <= req.value;
    case "maxTemperature":
      return ctx.averageTemperature <= req.value;
    case "surfaceCapability":
      return tile.surface[req.capability] === true;
  }
}

export function checkAllRequirements(
  requirements: Requirement[],
  ctx: TileContext,
  world: WorldState,
): boolean {
  return requirements.every((req) => checkRequirement(req, ctx, world));
}
