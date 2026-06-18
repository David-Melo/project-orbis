import { Rng } from "../engine/rng";
import { type TileEntity } from "../engine/components";
import { orthogonalNeighbors, type WorldState } from "../engine/world";
import { ARCHETYPES } from "../cards/archetypes";
import { analyzeContext } from "./contextAnalysis";

/**
 * AssignmentSystem.
 *
 * The random daily ritual is mostly a GROWTH phase — it assigns an empty
 * frontier tile so the world grows outward — but OCCASIONALLY it assigns an
 * existing tile on the world's edge so transforms (uplift, erosion, eruption,
 * melt, sink) can happen without a human clicking. Only true edge tiles are
 * eligible for transformation (adjacent to empty space or open ocean), so the
 * dice never reach deep into the interior.
 *
 * Selection within a pool is ENTROPY-ORDERED (Wave Function Collapse): tiles
 * with the FEWEST legal cards are favored, resolving the most-constrained tiles
 * first to reduce dead-ends and produce more coherent growth.
 */

/** Roughly this share of random days act on an existing edge tile (a transform). */
const TRANSFORM_SHARE = 0.3;

/** An empty tile on the growing edge of the world. */
export function isFrontierEmpty(world: WorldState, tile: TileEntity): boolean {
  if (tile.terrain.kind !== "empty") return false;
  return orthogonalNeighbors(world, tile).some(
    (n) => n.terrain.kind !== "empty" && n.terrain.kind !== "void",
  );
}

/** An existing tile on the true edge: adjacent to empty space or open ocean. */
export function isModifiableEdgeTile(world: WorldState, tile: TileEntity): boolean {
  const k = tile.terrain.kind;
  if (k === "empty" || k === "void") return false;
  return orthogonalNeighbors(world, tile).some(
    (n) => n.terrain.kind === "empty" || n.terrain.kind === "ocean",
  );
}

/** Number of archetypes that can generate for this tile (its "domain size"). */
export function eligibleCount(world: WorldState, tile: TileEntity): number {
  if (tile.terrain.kind === "void") return 0;
  const ctx = analyzeContext(world, tile);
  let count = 0;
  for (const a of ARCHETYPES) if (a.canGenerate(ctx, world)) count++;
  return count;
}

/** Can any archetype generate a card for this tile right now? */
export function isEligibleTile(world: WorldState, tile: TileEntity): boolean {
  return eligibleCount(world, tile) > 0;
}

/** Empty frontier tiles with at least one legal card (the growth pool). */
export function findAssignableTiles(world: WorldState): TileEntity[] {
  return world.tiles.filter((t) => isFrontierEmpty(world, t) && isEligibleTile(world, t));
}

/** Existing edge tiles with at least one legal card (the transform pool). */
export function findTransformTiles(world: WorldState): TileEntity[] {
  return world.tiles.filter((t) => isModifiableEdgeTile(world, t) && isEligibleTile(world, t));
}

type Candidate = { tile: TileEntity; count: number };

/** Weighted pick favoring the fewest-option (lowest-entropy) tiles. */
function pickByEntropy(pool: Candidate[], rng: Rng): TileEntity {
  // weight = 1 / domainSize^2 — strongly favors the most-constrained tiles.
  const weights = pool.map((c) => 1 / (Math.max(1, c.count) * Math.max(1, c.count)));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng.next() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i].tile;
  }
  return pool[pool.length - 1].tile;
}

/**
 * Pick a tile deterministically from the world's RNG state: usually an empty
 * frontier tile (growth), occasionally an existing edge tile (transform), and
 * within the chosen pool, entropy-ordered. Returns undefined if nothing is
 * assignable.
 *
 * Single pass over the grid: cheap neighbor checks classify each tile, and the
 * (more expensive) eligibility count is computed at most once per candidate.
 */
export function assignFrontierTile(
  world: WorldState,
  opts: { allowTransforms?: boolean } = {},
): TileEntity | undefined {
  const allowTransforms = opts.allowTransforms !== false; // default on

  const growth: Candidate[] = [];
  const transforms: Candidate[] = [];

  for (const tile of world.tiles) {
    const k = tile.terrain.kind;
    if (k === "void") continue;
    const isGrowth = k === "empty";
    if (isGrowth) {
      if (!isFrontierEmpty(world, tile)) continue;
    } else {
      if (!allowTransforms || !isModifiableEdgeTile(world, tile)) continue;
    }
    const count = eligibleCount(world, tile);
    if (count === 0) continue;
    (isGrowth ? growth : transforms).push({ tile, count });
  }

  if (growth.length === 0 && transforms.length === 0) return undefined;

  const rng = new Rng(world.seed);
  rng.setState(world.rngState);

  const useTransform =
    transforms.length > 0 && (growth.length === 0 || rng.next() < TRANSFORM_SHARE);
  const pool = useTransform ? transforms : growth.length > 0 ? growth : transforms;

  const chosen = pickByEntropy(pool, rng);
  world.rngState = rng.getState();
  world.assignedTileId = chosen.id;
  return chosen;
}
