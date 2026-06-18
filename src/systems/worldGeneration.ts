import { nextId } from "../engine/ids";
import { Rng } from "../engine/rng";
import {
  defaultSurfaceFor,
  TERRAIN_DEFAULTS,
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
      tiles[tileIndex({ width: size }, x, y)] = makeTile(x, y, "empty", size, seed);
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

/** Continuous latitude base (unrounded), 1 at the poles .. 7 at the equator. */
function latitudeBase(y: number, height: number): number {
  const mid = (height - 1) / 2;
  const dist = Math.abs(y - mid) / mid;
  return 1 + 6 * (1 - dist);
}

/** Deterministic lattice hash in [-1, 1] from integer coords + seed. */
function hash2(ix: number, iy: number, seed: number): number {
  let h = (seed ^ Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967296) * 2 - 1;
}

/** Smooth (smoothstep-interpolated) 2D value noise in ~[-1, 1]. */
function valueNoise(x: number, y: number, freq: number, seed: number): number {
  const fx = x * freq;
  const fy = y * freq;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const sx = ((t) => t * t * (3 - 2 * t))(fx - ix);
  const sy = ((t) => t * t * (3 - 2 * t))(fy - iy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}

/**
 * Seeded climate temperature: the latitude gradient (cold poles, warm equator)
 * perturbed by low-frequency seeded noise, so warm tongues and cold pockets fall
 * in different places each seed and the freezable band is no longer a flat,
 * identical line every run. The perturbation is bounded so the extreme poles
 * stay cold (<= 3) and the equator stays unfreezable.
 */
export function climateTemperature(x: number, y: number, height: number, seed: number): number {
  const noise =
    valueNoise(x, y, 0.13, seed) * 0.8 + valueNoise(x, y, 0.31, seed ^ 0x9e3779b9) * 0.3;
  const t = latitudeBase(y, height) + noise * 2.2;
  return Math.max(1, Math.min(7, Math.round(t)));
}

function makeTile(
  x: number,
  y: number,
  kind: TerrainKind,
  height: number,
  seed: number,
): TileEntity {
  const d = TERRAIN_DEFAULTS[kind];
  return {
    id: nextId("tile"),
    position: { x, y },
    terrain: { kind },
    elevation: { value: d.elevation },
    moisture: { value: d.moisture },
    temperature: { value: climateTemperature(x, y, height, seed) },
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
 *
 * Only TERRAIN KINDS are placed here; every tile's elevation and moisture come
 * from TERRAIN_DEFAULTS, so the seed can never drift from the rules.
 */
function seedPrimordialIsland(world: WorldState, _rng: Rng): void {
  const cx = Math.floor(world.width / 2);
  const cy = Math.floor(world.height / 2);

  const bands: Array<{ max: number; kind: TerrainKind }> = [
    { max: 0.6, kind: "mountain" },
    { max: 1.8, kind: "hill" },
    { max: 2.9, kind: "plain" },
  ];

  // Land blob — its outer plains border empty frontier on most sides.
  const reach = Math.ceil(bands[bands.length - 1].max);
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      const band = bands.find((b) => dist < b.max);
      if (!band) continue;
      setTerrain(world, cx + dx, cy + dy, band.kind);
    }
  }

  // A small bay on the eastern edge: a coast strip backed by open ocean.
  for (let dy = -2; dy <= 2; dy++) {
    setTerrain(world, cx + 2, cy + dy, "coast");
    setTerrain(world, cx + 3, cy + dy, "ocean");
    setTerrain(world, cx + 4, cy + dy, "ocean");
  }
}

/** Paint a tile to a terrain kind, taking its elevation/moisture from defaults. */
function setTerrain(world: WorldState, x: number, y: number, kind: TerrainKind): void {
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return;
  const tile = world.tiles[tileIndex(world, x, y)];
  const d = TERRAIN_DEFAULTS[kind];
  tile.terrain.kind = kind;
  tile.elevation.value = d.elevation;
  tile.moisture.value = d.moisture;
  tile.surface = defaultSurfaceFor(kind);
}
