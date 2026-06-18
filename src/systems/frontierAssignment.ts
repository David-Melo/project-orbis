import { Rng } from "../engine/rng";
import { WATER_TERRAINS, type TileEntity } from "../engine/components";
import { orthogonalNeighbors, type WorldState } from "../engine/world";
import { ARCHETYPES } from "../cards/archetypes";
import { analyzeContext } from "./contextAnalysis";

/**
 * AssignmentSystem (formerly frontier-only).
 *
 * The world is now reversible, so a session may be assigned an empty frontier
 * tile OR an existing "lively" edge tile (a coastline, riverbank, border, or
 * frontier) where change is physically plausible. Deep, homogeneous interior
 * tiles are left stable. A tile is only a candidate if at least one archetype
 * can actually generate a card for it.
 */

/** True if the tile sits on an active edge where transformation makes sense. */
export function isLivelyTile(world: WorldState, tile: TileEntity): boolean {
  if (tile.terrain.kind === "void") return false;
  const neighbors = orthogonalNeighbors(world, tile);

  if (tile.terrain.kind === "empty") {
    // Frontier: an empty tile touching something non-empty.
    return neighbors.some((n) => n.terrain.kind !== "empty" && n.terrain.kind !== "void");
  }

  // Existing tile: lively if it borders empty space, water, or different terrain.
  return neighbors.some(
    (n) =>
      n.terrain.kind === "empty" ||
      WATER_TERRAINS.has(n.terrain.kind) ||
      n.terrain.kind !== tile.terrain.kind,
  );
}

/** Can any archetype generate a card for this tile right now? */
export function isEligibleTile(world: WorldState, tile: TileEntity): boolean {
  if (tile.terrain.kind === "void") return false;
  const ctx = analyzeContext(world, tile);
  return ARCHETYPES.some((a) => a.canGenerate(ctx, world));
}

/** All tiles that may be handed to a session by the random daily ritual. */
export function findAssignableTiles(world: WorldState): TileEntity[] {
  return world.tiles.filter((t) => isLivelyTile(world, t) && isEligibleTile(world, t));
}

/**
 * Pick an assignable tile deterministically from the world's RNG state.
 * Returns undefined if nothing is currently assignable.
 */
export function assignFrontierTile(world: WorldState): TileEntity | undefined {
  const candidates = findAssignableTiles(world);
  if (candidates.length === 0) return undefined;

  const rng = new Rng(world.seed);
  rng.setState(world.rngState);
  const chosen = rng.pick(candidates);
  world.rngState = rng.getState();
  world.assignedTileId = chosen.id;
  return chosen;
}
