import { describe, it, expect } from "vitest";
import { generateWorld, latitudeTemperature, DEFAULT_WORLD_SIZE } from "./worldGeneration";
import { getTileAt, orthogonalNeighbors } from "../engine/world";
import { TERRAIN_DEFAULTS, type TerrainKind } from "../engine/components";
import { ELEVATION_BANDS, MOISTURE_BANDS } from "../test/helpers";

describe("WorldGenerationSystem", () => {
  it("creates a full 32x32 grid", () => {
    const w = generateWorld(1);
    expect(w.width).toBe(DEFAULT_WORLD_SIZE);
    expect(w.tiles.length).toBe(DEFAULT_WORLD_SIZE * DEFAULT_WORLD_SIZE);
  });

  it("is deterministic for a given seed", () => {
    const a = generateWorld(777).tiles.map((t) => t.terrain.kind);
    const b = generateWorld(777).tiles.map((t) => t.terrain.kind);
    expect(a).toEqual(b);
  });

  it("seeds a layered island with a mountain core stepping down to plains", () => {
    const w = generateWorld(1);
    const kinds = new Set(w.tiles.map((t) => t.terrain.kind));
    expect(kinds.has("mountain")).toBe(true);
    expect(kinds.has("hill")).toBe(true);
    expect(kinds.has("plain")).toBe(true);
    expect(kinds.has("ocean")).toBe(true);
  });

  it("leaves land at the frontier so it can be extended during growth", () => {
    const w = generateWorld(1);
    const landAtFrontier = w.tiles.some(
      (t) =>
        t.terrain.kind === "plain" &&
        orthogonalNeighbors(w, t).some((n) => n.terrain.kind === "empty"),
    );
    expect(landAtFrontier).toBe(true);
  });

  it("temperature follows latitude: cold poles, warm equator", () => {
    const h = DEFAULT_WORLD_SIZE;
    expect(latitudeTemperature(0, h)).toBeLessThan(latitudeTemperature(Math.floor(h / 2), h));
    expect(latitudeTemperature(h - 1, h)).toBeLessThan(latitudeTemperature(Math.floor(h / 2), h));
    const top = getTileAt(generateWorld(1), 0, 0)!;
    expect(top.temperature.value).toBeLessThanOrEqual(3);
  });
});

const DRY_LAND = new Set<TerrainKind>(["plain", "hill", "mountain", "volcano", "basalt"]);
const WATER = new Set<TerrainKind>(["ocean", "coast", "lake", "river", "wetland"]);

/**
 * The seed is hand-authored, so it is the strictest thing to verify: every
 * starting tile must obey the same rules card-generated terrain obeys, and it
 * must stay in sync with the rules automatically. The seed derives its values
 * from TERRAIN_DEFAULTS, and these tests fail the moment a rule (band) change
 * makes the defaults or the seed inconsistent — forcing a re-sync.
 */
describe("seed coherence — the first tiles must follow every rule exactly", () => {
  it("TERRAIN_DEFAULTS sit inside the documented elevation and moisture bands", () => {
    for (const kind of Object.keys(TERRAIN_DEFAULTS) as TerrainKind[]) {
      const d = TERRAIN_DEFAULTS[kind];
      const eb = ELEVATION_BANDS[kind];
      const mb = MOISTURE_BANDS[kind];
      if (eb) {
        expect(d.elevation, `${kind} default elevation in band`).toBeGreaterThanOrEqual(eb[0]);
        expect(d.elevation).toBeLessThanOrEqual(eb[1]);
      }
      if (mb) {
        expect(d.moisture, `${kind} default moisture in band`).toBeGreaterThanOrEqual(mb[0]);
        expect(d.moisture).toBeLessThanOrEqual(mb[1]);
      }
    }
  });

  it("every seeded tile is within its terrain's elevation and moisture band", () => {
    const w = generateWorld(1);
    for (const t of w.tiles) {
      const eb = ELEVATION_BANDS[t.terrain.kind];
      const mb = MOISTURE_BANDS[t.terrain.kind];
      const where = `${t.terrain.kind}@(${t.position.x},${t.position.y})`;
      if (eb) {
        expect(t.elevation.value, `${where} elev`).toBeGreaterThanOrEqual(eb[0]);
        expect(t.elevation.value, `${where} elev`).toBeLessThanOrEqual(eb[1]);
      }
      if (mb) {
        expect(t.moisture.value, `${where} moisture`).toBeGreaterThanOrEqual(mb[0]);
        expect(t.moisture.value, `${where} moisture`).toBeLessThanOrEqual(mb[1]);
      }
    }
  });

  it("no dry land touches open ocean — the sea meets land only through a shore", () => {
    const w = generateWorld(1);
    for (const t of w.tiles) {
      if (!DRY_LAND.has(t.terrain.kind)) continue;
      const touchesOcean = orthogonalNeighbors(w, t).some((n) => n.terrain.kind === "ocean");
      expect(touchesOcean, `${t.terrain.kind}@(${t.position.x},${t.position.y}) touches ocean`).toBe(false);
    }
  });

  it("every seeded coast is a real shore (adjacent to water)", () => {
    const w = generateWorld(1);
    for (const t of w.tiles) {
      if (t.terrain.kind !== "coast") continue;
      const atWater = orthogonalNeighbors(w, t).some((n) => WATER.has(n.terrain.kind));
      expect(atWater, `coast@(${t.position.x},${t.position.y}) is landlocked`).toBe(true);
    }
  });

  it("is reproducible — same seed, identical starting tiles incl. elevation & moisture", () => {
    const a = generateWorld(1).tiles.map((t) => `${t.terrain.kind}:${t.elevation.value}:${t.moisture.value}`);
    const b = generateWorld(1).tiles.map((t) => `${t.terrain.kind}:${t.elevation.value}:${t.moisture.value}`);
    expect(a).toEqual(b);
  });
});
