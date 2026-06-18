import { describe, it, expect } from "vitest";
import { analyzeContext } from "./contextAnalysis";
import { emptyWorld, setTile } from "../test/helpers";

function contextFor(build: (w: ReturnType<typeof emptyWorld>) => void, x = 3, y = 3) {
  const w = emptyWorld();
  build(w);
  const tile = w.tiles.find((t) => t.position.x === x && t.position.y === y)!;
  return analyzeContext(w, tile);
}

describe("ContextAnalysisSystem", () => {
  it("records the target's own terrain and elevation", () => {
    const ctx = contextFor((w) => setTile(w, 3, 3, "plain", 4));
    expect(ctx.targetTerrain).toBe("plain");
    expect(ctx.targetElevation).toBe(4);
  });

  it("averages elevation over NON-EMPTY neighbors only (empty void must not skew it)", () => {
    const ctx = contextFor((w) => {
      setTile(w, 3, 3, "empty");
      setTile(w, 3, 2, "mountain", 8);
      // everything else around stays empty (elevation 0) and must be ignored
    });
    expect(ctx.averageElevation).toBe(8);
    expect(ctx.landNeighborCount).toBe(1);
  });

  it("computes touch flags for adjacency", () => {
    const ctx = contextFor((w) => {
      setTile(w, 3, 3, "empty");
      setTile(w, 3, 2, "ocean");
      setTile(w, 4, 3, "river");
      setTile(w, 2, 3, "mountain", 8);
    });
    expect(ctx.touchesOcean).toBe(true);
    expect(ctx.touchesRiver).toBe(true);
    expect(ctx.touchesFreshWater).toBe(true);
    expect(ctx.touchesHighGround).toBe(true);
    expect(ctx.touchesLava).toBe(false);
  });

  it("flags a basin: a low spot ringed by land", () => {
    const ctx = contextFor((w) => {
      setTile(w, 3, 3, "empty");
      setTile(w, 3, 2, "plain", 4);
      setTile(w, 3, 4, "plain", 4);
      setTile(w, 2, 3, "plain", 4);
      setTile(w, 4, 3, "plain", 4);
    });
    expect(ctx.isBasin).toBe(true);
  });

  it("does NOT flag a basin when barely ringed by land", () => {
    const ctx = contextFor((w) => {
      setTile(w, 3, 3, "empty");
      setTile(w, 3, 2, "plain", 4); // only one land neighbor
    });
    expect(ctx.isBasin).toBe(false);
  });
});
