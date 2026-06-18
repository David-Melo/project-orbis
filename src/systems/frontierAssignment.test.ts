import { describe, it, expect } from "vitest";
import {
  findAssignableTiles,
  findTransformTiles,
  isFrontierEmpty,
  isModifiableEdgeTile,
  isEligibleTile,
  eligibleCount,
  assignFrontierTile,
} from "./frontierAssignment";
import { generateWorld } from "./worldGeneration";
import { emptyWorld, setTile } from "../test/helpers";

describe("AssignmentSystem", () => {
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

  it("the GROWTH pool is only empty frontier tiles", () => {
    const w = generateWorld(1);
    const candidates = findAssignableTiles(w);
    expect(candidates.length).toBeGreaterThan(0);
    for (const t of candidates) expect(t.terrain.kind).toBe("empty");
  });

  it("isModifiableEdgeTile flags existing EDGE land (next to empty/ocean), not deep interior", () => {
    const w = emptyWorld();
    // A 3-wide strip of plains; the middle one is interior, the ends are edge.
    setTile(w, 2, 3, "plain", 4);
    setTile(w, 3, 3, "plain", 4);
    setTile(w, 4, 3, "plain", 4);
    setTile(w, 2, 2, "plain", 4);
    setTile(w, 3, 2, "plain", 4);
    setTile(w, 4, 2, "plain", 4);
    const edge = w.tiles.find((t) => t.position.x === 3 && t.position.y === 3)!; // touches empty below
    expect(isModifiableEdgeTile(w, edge)).toBe(true);
    const interior = w.tiles.find((t) => t.position.x === 3 && t.position.y === 2)!;
    // (3,2) neighbors: (3,1) empty -> still edge here; build a truly-buried case instead
    const buried = makeBuried();
    expect(isModifiableEdgeTile(buried.world, buried.center)).toBe(false);
    expect(interior).toBeDefined();
  });

  it("the TRANSFORM pool is existing edge tiles only", () => {
    const w = generateWorld(1);
    for (const t of findTransformTiles(w)) {
      expect(t.terrain.kind).not.toBe("empty");
      expect(isModifiableEdgeTile(w, t)).toBe(true);
    }
  });

  it("eligibleCount returns the tile's domain size (how many cards it can offer)", () => {
    const w = emptyWorld();
    setTile(w, 3, 3, "plain", 4);
    setTile(w, 3, 2, "plain", 4);
    const land = w.tiles.find((t) => t.position.x === 3 && t.position.y === 3)!;
    expect(eligibleCount(w, land)).toBeGreaterThan(0);
    expect(isEligibleTile(w, land)).toBe(true);
  });

  it("assignFrontierTile is deterministic and records the assignment", () => {
    const a = generateWorld(555);
    const b = generateWorld(555);
    const ta = assignFrontierTile(a)!;
    const tb = assignFrontierTile(b)!;
    expect(ta.position).toEqual(tb.position);
    expect(a.assignedTileId).toBe(ta.id);
    expect(isEligibleTile(a, ta)).toBe(true);
  });

  it("over many random states, the ritual eventually assigns BOTH growth and transform tiles", () => {
    const w = generateWorld(1);
    let sawEmpty = false;
    let sawExisting = false;
    for (let i = 0; i < 80; i++) {
      w.rngState = (w.rngState * 1664525 + 1013904223) >>> 0; // jitter the state
      const t = assignFrontierTile(w);
      if (!t) break;
      if (t.terrain.kind === "empty") sawEmpty = true;
      else sawExisting = true;
    }
    expect(sawEmpty).toBe(true);
    expect(sawExisting).toBe(true); // transforms now happen in the random ritual
  });

  it("allowTransforms:false makes the ritual assign ONLY empty frontier tiles", () => {
    const w = generateWorld(1);
    for (let i = 0; i < 80; i++) {
      w.rngState = (w.rngState * 1664525 + 1013904223) >>> 0;
      const t = assignFrontierTile(w, { allowTransforms: false });
      if (!t) break;
      expect(t.terrain.kind).toBe("empty");
    }
  });
});

/** A plain fully ringed by plains (no empty/ocean neighbor) — a buried interior tile. */
function makeBuried() {
  const world = emptyWorld(7);
  for (let y = 2; y <= 4; y++) for (let x = 2; x <= 4; x++) setTile(world, x, y, "plain", 4);
  const center = world.tiles.find((t) => t.position.x === 3 && t.position.y === 3)!;
  return { world, center };
}
