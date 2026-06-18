import { describe, it, expect } from "vitest";
import { checkRequirement, checkAllRequirements } from "./requirementValidation";
import { analyzeContext } from "./contextAnalysis";
import { emptyWorld, setTile } from "../test/helpers";

/** Build a real context for a painted tile in a small world. */
function ctxAt(buildWorld: (w: ReturnType<typeof emptyWorld>) => { x: number; y: number }) {
  const w = emptyWorld();
  const { x, y } = buildWorld(w);
  const tile = w.tiles.find((t) => t.position.x === x && t.position.y === y)!;
  return { world: w, ctx: analyzeContext(w, tile) };
}

describe("RequirementValidationSystem", () => {
  it("targetTerrainIn checks the target's current terrain", () => {
    const { world, ctx } = ctxAt((w) => {
      setTile(w, 3, 3, "plain", 4);
      return { x: 3, y: 3 };
    });
    expect(checkRequirement({ type: "targetTerrainIn", terrains: ["plain"] }, ctx, world)).toBe(true);
    expect(checkRequirement({ type: "targetTerrainIn", terrains: ["ocean"] }, ctx, world)).toBe(false);
  });

  it("touchesTerrain / touchesAnyTerrain read adjacency", () => {
    const { world, ctx } = ctxAt((w) => {
      setTile(w, 3, 3, "empty");
      setTile(w, 3, 2, "ocean");
      return { x: 3, y: 3 };
    });
    expect(checkRequirement({ type: "touchesTerrain", terrain: "ocean" }, ctx, world)).toBe(true);
    expect(checkRequirement({ type: "touchesTerrain", terrain: "lava" }, ctx, world)).toBe(false);
    expect(checkRequirement({ type: "touchesAnyTerrain", terrains: ["lava", "ocean"] }, ctx, world)).toBe(true);
  });

  it("elevation/temperature thresholds compare against the neighborhood average", () => {
    const { world, ctx } = ctxAt((w) => {
      setTile(w, 3, 3, "empty");
      setTile(w, 3, 2, "mountain", 8);
      return { x: 3, y: 3 };
    });
    expect(ctx.averageElevation).toBe(8);
    expect(checkRequirement({ type: "minElevation", value: 6 }, ctx, world)).toBe(true);
    expect(checkRequirement({ type: "maxElevation", value: 6 }, ctx, world)).toBe(false);
  });

  it("checkAllRequirements requires every requirement to pass", () => {
    const { world, ctx } = ctxAt((w) => {
      setTile(w, 3, 3, "empty");
      setTile(w, 3, 2, "ocean");
      return { x: 3, y: 3 };
    });
    expect(
      checkAllRequirements(
        [{ type: "targetTerrainIn", terrains: ["empty"] }, { type: "touchesTerrain", terrain: "ocean" }],
        ctx,
        world,
      ),
    ).toBe(true);
    expect(
      checkAllRequirements(
        [{ type: "targetTerrainIn", terrains: ["empty"] }, { type: "touchesTerrain", terrain: "ice" }],
        ctx,
        world,
      ),
    ).toBe(false);
  });
});
