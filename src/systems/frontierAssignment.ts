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

/** Non-empty orthogonal neighbors of a tile (how "connected" the frontier is). */
function filledNeighborCount(world: WorldState, tile: TileEntity): number {
  return orthogonalNeighbors(world, tile).filter(
    (n) => n.terrain.kind !== "empty" && n.terrain.kind !== "void",
  ).length;
}

/**
 * Pick a frontier tile deterministically from the world's RNG state, WEIGHTED
 * toward better-connected tiles (more filled neighbors). This makes growth fill
 * concave gaps and run along existing edges rather than spiking out into the
 * void, so even the random ritual produces smoother, less noisy coastlines.
 * Returns undefined if there is no eligible growth frontier.
 */
export function assignFrontierTile(world: WorldState): TileEntity | undefined {
  const candidates = findAssignableTiles(world);
  if (candidates.length === 0) return undefined;

  const rng = new Rng(world.seed);
  rng.setState(world.rngState);

  const weights = candidates.map((t) => {
    const n = filledNeighborCount(world, t); // 1..4
    return n * n; // emphasize tiles that fill in
  });
  const total = weights.reduce((a, b) => a + b, 0);

  let roll = rng.next() * total;
  let chosen = candidates[candidates.length - 1];
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      chosen = candidates[i];
      break;
    }
  }

  world.rngState = rng.getState();
  world.assignedTileId = chosen.id;
  return chosen;
}
