import { nextId } from "../engine/ids";
import { Rng } from "../engine/rng";
import {
  defaultSurfaceFor,
  type TerrainKind,
  type TileEntity,
} from "../engine/components";
import { tileIndex, type WorldState } from "../engine/world";

export const DEFAULT_WORLD_SIZE = 32;

/**
 * WorldGenerationSystem.
 *
 * Creates a fresh grid that is mostly empty frontier, with a single small
 * seed of land/coast/ocean near the center so the player always has a
 * frontier to grow from on day one. The terrain seed is deliberately tiny:
 * the world is meant to be authored through cards, not pre-generated.
 */
export function generateWorld(seed: number, size = DEFAULT_WORLD_SIZE): WorldState {
  const rng = new Rng(seed);
  const tiles: TileEntity[] = new Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      tiles[tileIndex({ width: size }, x, y)] = makeTile(x, y, "empty");
    }
  }

  const world: WorldState = {
    id: nextId("world"),
    width: size,
    height: size,
    seed,
    rngState: rng.getState(),
    currentDay: 0,
    tiles,
    events: [],
  };

  seedPrimordialIsland(world, rng);
  world.rngState = rng.getState();
  return world;
}

function makeTile(x: number, y: number, kind: TerrainKind): TileEntity {
  return {
    id: nextId("tile"),
    position: { x, y },
    terrain: { kind },
    elevation: { value: kind === "ocean" ? 0 : kind === "coast" ? 2 : 3 },
    moisture: { value: kind === "empty" ? 0 : 5 },
    temperature: { value: 5 },
    fertility: { value: 0 },
    surface: defaultSurfaceFor(kind),
    connections: {},
    traits: { traits: [] },
    history: { eventIds: [] },
  };
}

/**
 * Drop a tiny island near the center: a few plains ringed loosely by coast,
 * with ocean just beyond. This guarantees a varied set of frontier tiles
 * (land, coast, water) for the first cards.
 */
function seedPrimordialIsland(world: WorldState, rng: Rng): void {
  const cx = Math.floor(world.width / 2);
  const cy = Math.floor(world.height / 2);

  setTerrain(world, cx, cy, "plain", 4);
  setTerrain(world, cx + 1, cy, "plain", 4);
  setTerrain(world, cx, cy + 1, "plain", 3);
  setTerrain(world, cx - 1, cy, rng.next() > 0.5 ? "hill" : "plain", 4);

  const coastRing: Array<[number, number]> = [
    [cx + 2, cy],
    [cx - 2, cy],
    [cx, cy + 2],
    [cx, cy - 1],
    [cx + 1, cy + 1],
    [cx - 1, cy + 1],
  ];
  for (const [x, y] of coastRing) setTerrain(world, x, y, "coast", 2);

  const oceanRing: Array<[number, number]> = [
    [cx + 3, cy],
    [cx - 3, cy],
    [cx, cy + 3],
    [cx, cy - 2],
    [cx + 2, cy + 2],
    [cx - 2, cy + 2],
  ];
  for (const [x, y] of oceanRing) setTerrain(world, x, y, "ocean", 0);
}

function setTerrain(
  world: WorldState,
  x: number,
  y: number,
  kind: TerrainKind,
  elevation: number,
): void {
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return;
  const tile = world.tiles[tileIndex(world, x, y)];
  tile.terrain.kind = kind;
  tile.elevation.value = elevation;
  tile.moisture.value = kind === "ocean" || kind === "coast" ? 8 : 5;
  tile.surface = defaultSurfaceFor(kind);
}
