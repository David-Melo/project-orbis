import type { EntityId } from "./ids";
import type { Effect } from "./effects";
import type { Direction, TileEntity } from "./components";

export type WorldEvent = {
  id: EntityId;
  day: number;
  title: string;
  description: string;
  actor: "local-player" | "system";
  cardId?: EntityId;
  targetTileId: EntityId;
  effects: Effect[];
  createdAt: string;
};

/**
 * The complete serializable world. Tiles are stored in a flat array indexed by
 * y * width + x; positions are also carried on each tile so the array is never
 * the source of truth on its own.
 */
export type WorldState = {
  id: EntityId;
  width: number;
  height: number;
  seed: number;
  rngState: number;
  currentDay: number;
  tiles: TileEntity[];
  events: WorldEvent[];
  /** Tile assigned to the active session, if a day is in progress. */
  assignedTileId?: EntityId;
};

export function tileIndex(world: Pick<WorldState, "width">, x: number, y: number): number {
  return y * world.width + x;
}

export function inBounds(world: WorldState, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < world.width && y < world.height;
}

export function getTileAt(world: WorldState, x: number, y: number): TileEntity | undefined {
  if (!inBounds(world, x, y)) return undefined;
  return world.tiles[tileIndex(world, x, y)];
}

export function getTile(world: WorldState, id: EntityId): TileEntity | undefined {
  return world.tiles.find((t) => t.id === id);
}

const DIRECTION_DELTAS: Record<Direction, { dx: number; dy: number }> = {
  n: { dx: 0, dy: -1 },
  e: { dx: 1, dy: 0 },
  s: { dx: 0, dy: 1 },
  w: { dx: -1, dy: 0 },
};

export function neighborInDirection(
  world: WorldState,
  tile: TileEntity,
  dir: Direction,
): TileEntity | undefined {
  const d = DIRECTION_DELTAS[dir];
  return getTileAt(world, tile.position.x + d.dx, tile.position.y + d.dy);
}

/** Orthogonal (4-way) neighbors. */
export function orthogonalNeighbors(world: WorldState, tile: TileEntity): TileEntity[] {
  const out: TileEntity[] = [];
  for (const dir of ["n", "e", "s", "w"] as Direction[]) {
    const n = neighborInDirection(world, tile, dir);
    if (n) out.push(n);
  }
  return out;
}

/** All tiles within Chebyshev distance `radius` (excluding the center). */
export function tilesWithinRadius(world: WorldState, tile: TileEntity, radius: number): TileEntity[] {
  const out: TileEntity[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue;
      const n = getTileAt(world, tile.position.x + dx, tile.position.y + dy);
      if (n) out.push(n);
    }
  }
  return out;
}
