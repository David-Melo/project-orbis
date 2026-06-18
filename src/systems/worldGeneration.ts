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
 * LAYERED island near the center: a mountain peak stepping down through hills,
 * plains, a coast ring and an ocean ring. The gradient matters — it gives the
 * card rules real elevation/terrain to read so early actions form coherent
 * slopes and shorelines rather than arbitrary jumps.
 *
 * Every tile (including empty ones) is assigned a latitude-based temperature:
 * cold near the poles (top/bottom rows), warm near the equator (middle). This
 * is what gives ice a natural home and keeps "freeze" out of temperate land.
 */
export function generateWorld(seed: number, size = DEFAULT_WORLD_SIZE): WorldState {
  const rng = new Rng(seed);
  const tiles: TileEntity[] = new Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      tiles[tileIndex({ width: size }, x, y)] = makeTile(x, y, "empty", size);
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

/** Temperature 1 (poles) .. 7 (equator), by latitude. */
export function latitudeTemperature(y: number, height: number): number {
  const mid = (height - 1) / 2;
  const dist = Math.abs(y - mid) / mid; // 0 at equator, 1 at the poles
  return Math.round(1 + 6 * (1 - dist));
}

function makeTile(x: number, y: number, kind: TerrainKind, height: number): TileEntity {
  return {
    id: nextId("tile"),
    position: { x, y },
    terrain: { kind },
    elevation: { value: 0 },
    moisture: { value: 0 },
    temperature: { value: latitudeTemperature(y, height) },
    fertility: { value: 0 },
    surface: defaultSurfaceFor(kind),
    connections: {},
    traits: { traits: [] },
    history: { eventIds: [] },
  };
}

/**
 * A small layered landmass centered on the map: a mountain core stepping down
 * through hills to plains. Most of the land's edge borders empty frontier (so
 * features can be extended outward during the growth phase), while a small bay
 * of coast and ocean on one side seeds the water-based cards.
 */
function seedPrimordialIsland(world: WorldState, _rng: Rng): void {
  const cx = Math.floor(world.width / 2);
  const cy = Math.floor(world.height / 2);

  const bands: Array<{ max: number; kind: TerrainKind; elevation: number; moisture: number }> = [
    { max: 0.6, kind: "mountain", elevation: 8, moisture: 3 },
    { max: 1.8, kind: "hill", elevation: 6, moisture: 4 },
    { max: 2.9, kind: "plain", elevation: 4, moisture: 5 },
  ];

  // Land blob — its outer plains border empty frontier on most sides.
  const reach = Math.ceil(bands[bands.length - 1].max);
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      const band = bands.find((b) => dist < b.max);
      if (!band) continue;
      setTerrain(world, cx + dx, cy + dy, band.kind, band.elevation, band.moisture);
    }
  }

  // A small bay on the eastern edge: a coast strip backed by open ocean.
  for (let dy = -2; dy <= 2; dy++) {
    setTerrain(world, cx + 2, cy + dy, "coast", 2, 8);
    setTerrain(world, cx + 3, cy + dy, "ocean", 0, 9);
    setTerrain(world, cx + 4, cy + dy, "ocean", 0, 9);
  }
}

function setTerrain(
  world: WorldState,
  x: number,
  y: number,
  kind: TerrainKind,
  elevation: number,
  moisture: number,
): void {
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return;
  const tile = world.tiles[tileIndex(world, x, y)];
  tile.terrain.kind = kind;
  tile.elevation.value = elevation;
  tile.moisture.value = moisture;
  tile.surface = defaultSurfaceFor(kind);
}
