import { defaultSurfaceFor, type Direction, type TileEntity } from "../engine/components";
import type { Effect } from "../engine/effects";
import { getTile, neighborInDirection, tilesWithinRadius, type WorldState } from "../engine/world";

function clamp(value: number, min = 0, max = 10): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * EffectApplicationSystem.
 *
 * Applies a list of effects to a target tile, mutating its components in place.
 * Setting terrain resets the surface capabilities to the defaults for that
 * terrain (the surface is derived state, not authored), after which any
 * explicit trait/connection effects layer on top. Numeric stats are clamped
 * to the documented 0-10 range. Returns the list of effects actually applied
 * so the HistorySystem can record exactly what happened.
 */
export function applyEffects(
  world: WorldState,
  tile: TileEntity,
  effects: Effect[],
): Effect[] {
  for (const effect of effects) {
    switch (effect.type) {
      case "setTerrain":
        tile.terrain.kind = effect.terrain;
        tile.surface = defaultSurfaceFor(effect.terrain);
        break;
      case "setElevation":
        tile.elevation.value = clamp(effect.value);
        break;
      case "adjustElevation":
        tile.elevation.value = clamp(tile.elevation.value + effect.amount);
        break;
      case "adjustMoisture":
        tile.moisture.value = clamp(tile.moisture.value + effect.amount);
        break;
      case "adjustTemperature":
        tile.temperature.value = clamp(tile.temperature.value + effect.amount);
        break;
      case "adjustFertility":
        tile.fertility.value = clamp(tile.fertility.value + effect.amount);
        break;
      case "addConnection": {
        const list = tile.connections[effect.direction] ?? [];
        list.push(effect.connection);
        tile.connections[effect.direction] = list;
        break;
      }
      case "addTrait":
        if (!tile.traits.traits.includes(effect.trait)) {
          tile.traits.traits.push(effect.trait);
        }
        break;
      case "removeTrait":
        tile.traits.traits = tile.traits.traits.filter((t) => t !== effect.trait);
        break;
      case "spreadMoisture":
        // Distance-weighted falloff (Red Blob's moisture-from-water idea): full
        // amount adjacent, less further out, so wetness fades with distance.
        for (const neighbor of tilesWithinRadius(world, tile, effect.radius)) {
          const dist = Math.max(
            Math.abs(neighbor.position.x - tile.position.x),
            Math.abs(neighbor.position.y - tile.position.y),
          );
          const amt = Math.max(1, Math.round((effect.amount * (effect.radius - dist + 1)) / effect.radius));
          neighbor.moisture.value = clamp(neighbor.moisture.value + amt);
        }
        break;
      case "flowDownhill": {
        // D8-lite: record a flow connection toward the lowest orthogonal
        // neighbor (deterministic n,e,s,w tie-break), so rivers have a direction.
        let bestDir: Direction | undefined;
        let bestElev = Infinity;
        for (const dir of ["n", "e", "s", "w"] as Direction[]) {
          const nb = neighborInDirection(world, tile, dir);
          if (nb && nb.elevation.value < bestElev) {
            bestElev = nb.elevation.value;
            bestDir = dir;
          }
        }
        if (bestDir && bestElev <= tile.elevation.value) {
          const list = tile.connections[bestDir] ?? [];
          list.push({ kind: "river" });
          tile.connections[bestDir] = list;
          const trait = `flows-${bestDir}`;
          if (!tile.traits.traits.includes(trait)) tile.traits.traits.push(trait);
        }
        break;
      }
      case "createEvent":
        // Narrative-only; handled by the HistorySystem, no component change.
        break;
    }
  }
  return effects;
}

export function getTargetTile(world: WorldState): TileEntity | undefined {
  if (!world.assignedTileId) return undefined;
  return getTile(world, world.assignedTileId);
}
