import { describe, it, expect } from "vitest";
import { buildTileScene, UNIT } from "./scene";
import { emptyWorld, setTile } from "../test/helpers";

describe("buildTileScene (backend-agnostic draw list)", () => {
  it("an all-empty world draws only the background", () => {
    const scene = buildTileScene(emptyWorld(5), false);
    expect(scene.vbWidth).toBe(5 * UNIT);
    expect(scene.vbHeight).toBe(5 * UNIT);
    // Every display cell is off-map/empty (skipped); only the background rect.
    expect(scene.prims).toHaveLength(1);
    expect(scene.prims[0]).toMatchObject({ t: "rect", x: 0, y: 0 });
  });

  it("a land tile produces terrain cells and a glyph, derived from state", () => {
    const w = emptyWorld(5);
    setTile(w, 2, 2, "plain", 4, 5);
    const scene = buildTileScene(w, false);
    // Background + the four display cells touching the tile's corners, etc.
    expect(scene.prims.length).toBeGreaterThan(1);
    expect(scene.prims.some((p) => p.t === "rect" && p.crisp === true)).toBe(true);
    // The plain's glyph is drawn at its tile center.
    const glyph = scene.prims.find((p) => p.t === "text");
    expect(glyph).toMatchObject({ t: "text", s: "_", x: 2.5 * UNIT });
  });

  it("a river tile draws a linear path/line over the terrain", () => {
    const w = emptyWorld(5);
    setTile(w, 2, 2, "river", 3, 8);
    setTile(w, 3, 2, "lake", 2, 8); // a water neighbor to connect toward
    const scene = buildTileScene(w, false);
    expect(scene.prims.some((p) => p.t === "path" || p.t === "line")).toBe(true);
  });
});
