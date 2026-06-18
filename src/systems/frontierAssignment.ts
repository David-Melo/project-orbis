import { Rng } from "../engine/rng";
import type { TileEntity } from "../engine/components";
import { orthogonalNeighbors, type WorldState } from "../engine/world";
import { ARCHETYPES } from "../cards/archetypes";
import { analyzeContext } from "./contextAnalysis";

/**
 * AssignmentSystem.
 *
 * The random daily ritual (Start Day) is a GROWTH phase: it only ever assigns
 * an EMPTY frontier tile — an empty cell orthogonally adjacent to something
 * non-empty — so the world grows outward at its edge and existing terrain is
 * never disturbed by chance.
 *
 * Existing tiles can still be transformed, but only when the player
 * DELIBERATELY clicks one (see isEligibleTile + gameStore.handleTileClick).
 * That keeps reversibility available on demand without the dice ever reaching
 * into the interior.
 */

/** An empty tile on the growing edge of the world. */
export function isFrontierEmpty(world: WorldState, tile: TileEntity): boolean {
  if (tile.terrain.kind !== "empty") return false;
  return orthogonalNeighbors(world, tile).some(
    (n) => n.terrain.kind !== "empty" && n.terrain.kind !== "void",
  );
}

/** Can any archetype generate a card for this tile right now? */
export function isEligibleTile(world: WorldState, tile: TileEntity): boolean {
  if (tile.terrain.kind === "void") return false;
  const ctx = analyzeContext(world, tile);
  return ARCHETYPES.some((a) => a.canGenerate(ctx, world));
}

/** Growth candidates for the random ritual: empty frontier tiles with a hand. */
export function findAssignableTiles(world: WorldState): TileEntity[] {
  return world.tiles.filter((t) => isFrontierEmpty(world, t) && isEligibleTile(world, t));
}

/**
 * Pick a frontier tile deterministically from the world's RNG state.
 * Returns undefined if there is no eligible growth frontier.
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
