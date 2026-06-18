import { describe, it, expect } from "vitest";
import {
  findAssignableTiles,
  isFrontierEmpty,
  isEligibleTile,
  assignFrontierTile,
} from "./frontierAssignment";
import { generateWorld } from "./worldGeneration";
import { emptyWorld, setTile } from "../test/helpers";

describe("AssignmentSystem (growth phase)", () => {
  it("isFrontierEmpty is true only for empty tiles touching something", () => {
    const w = emptyWorld();
    setTile(w, 3, 3, "plain", 4);
    const frontier = w.tiles.find((t) => t.position.x === 4 && t.position.y === 3)!;
    const island = w.tiles.find((t) => t.position.x === 3 && t.position.y === 3)!;
    const isolated = w.tiles.find((t) => t.position.x === 0 && t.position.y === 0)!;
    expect(isFrontierEmpty(w, frontier)).toBe(true);
    expect(isFrontierEmpty(w, island)).toBe(false); // not empty
    expect(isFrontierEmpty(w, isolated)).toBe(false); // empty but touches nothing
  });

  it("the random ritual ONLY assigns empty frontier tiles (never the interior)", () => {
    const w = generateWorld(1);
    const candidates = findAssignableTiles(w);
    expect(candidates.length).toBeGreaterThan(0);
    for (const t of candidates) {
      expect(t.terrain.kind).toBe("empty");
    }
  });

  it("isEligibleTile is true for existing land (so it can be click-targeted)", () => {
    const w = emptyWorld();
    setTile(w, 3, 3, "plain", 4);
    setTile(w, 3, 2, "plain", 4);
    const land = w.tiles.find((t) => t.position.x === 3 && t.position.y === 3)!;
    expect(isEligibleTile(w, land)).toBe(true);
  });

  it("assignFrontierTile picks deterministically and records the assignment", () => {
    const a = generateWorld(555);
    const b = generateWorld(555);
    const ta = assignFrontierTile(a)!;
    const tb = assignFrontierTile(b)!;
    expect(ta.position).toEqual(tb.position);
    expect(a.assignedTileId).toBe(ta.id);
    expect(ta.terrain.kind).toBe("empty");
  });
});
