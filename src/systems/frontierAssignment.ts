import { Rng } from "../engine/rng";
import { orthogonalNeighbors, type WorldState } from "../engine/world";
import type { TileEntity } from "../engine/components";

/**
 * FrontierAssignmentSystem.
 *
 * A frontier tile is an empty tile orthogonally adjacent to at least one
 * non-empty tile. These are the only tiles a player may be assigned: the
 * world grows outward from what already exists, never in a vacuum.
 */
export function findFrontierTiles(world: WorldState): TileEntity[] {
  const out: TileEntity[] = [];
  for (const tile of world.tiles) {
    if (tile.terrain.kind !== "empty") continue;
    const hasNonEmptyNeighbor = orthogonalNeighbors(world, tile).some(
      (n) => n.terrain.kind !== "empty" && n.terrain.kind !== "void",
    );
    if (hasNonEmptyNeighbor) out.push(tile);
  }
  return out;
}

/**
 * Pick a frontier tile deterministically from the world's RNG state. Returns
 * undefined if the world has no frontier (e.g. fully filled or fully empty).
 */
export function assignFrontierTile(world: WorldState): TileEntity | undefined {
  const candidates = findFrontierTiles(world);
  if (candidates.length === 0) return undefined;

  const rng = new Rng(world.seed);
  rng.setState(world.rngState);
  const chosen = rng.pick(candidates);
  world.rngState = rng.getState();
  world.assignedTileId = chosen.id;
  return chosen;
}
