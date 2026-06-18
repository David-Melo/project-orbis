import { describe, it, expect } from "vitest";
import { generateWorld, latitudeTemperature, DEFAULT_WORLD_SIZE } from "./worldGeneration";
import { getTileAt, orthogonalNeighbors } from "../engine/world";

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
