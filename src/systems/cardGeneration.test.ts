import { describe, it, expect } from "vitest";
import { generateCards, HAND_SIZE, NO_CHANGE_ID } from "./cardGeneration";
import { analyzeContext } from "./contextAnalysis";
import { assignFrontierTile } from "./frontierAssignment";
import { checkAllRequirements } from "./requirementValidation";
import { generateWorld } from "./worldGeneration";
import { emptyWorld, setTile } from "../test/helpers";

describe("CardGenerationSystem", () => {
  it("deals a non-empty hand of <= HAND_SIZE cards that all pass their own requirements", () => {
    const w = generateWorld(31);
    const tile = assignFrontierTile(w)!;
    const ctx = analyzeContext(w, tile);
    const hand = generateCards(w, ctx);
    expect(hand.length).toBeGreaterThan(0);
    expect(hand.length).toBeLessThanOrEqual(HAND_SIZE);
    for (const card of hand) {
      expect(card.targetTileId).toBe(tile.id);
      expect(checkAllRequirements(card.requirements, ctx, w)).toBe(true);
    }
  });

  it("offers a 'No Change' option on existing tiles, but not on empty frontier", () => {
    const w = emptyWorld();
    setTile(w, 3, 3, "plain", 4);
    setTile(w, 3, 2, "plain", 4);
    setTile(w, 4, 3, "plain", 4);

    // Existing tile -> hand includes No Change.
    const land = w.tiles.find((t) => t.position.x === 3 && t.position.y === 3)!;
    const existingHand = generateCards(w, analyzeContext(w, land));
    expect(existingHand.some((c) => c.archetypeId === NO_CHANGE_ID)).toBe(true);
    expect(existingHand.length).toBeLessThanOrEqual(HAND_SIZE);
    const noChange = existingHand.find((c) => c.archetypeId === NO_CHANGE_ID)!;
    expect(noChange.effects).toEqual([]);

    // Empty frontier tile -> no No Change (you're growing, not editing).
    const empty = w.tiles.find((t) => t.position.x === 2 && t.position.y === 3)!;
    const growthHand = generateCards(w, analyzeContext(w, empty));
    expect(growthHand.some((c) => c.archetypeId === NO_CHANGE_ID)).toBe(false);
  });

  it("is deterministic for a given world RNG state", () => {
    const a = generateWorld(31);
    const b = generateWorld(31);
    const ta = assignFrontierTile(a)!;
    const tb = assignFrontierTile(b)!;
    const ha = generateCards(a, analyzeContext(a, ta)).map((c) => c.archetypeId);
    const hb = generateCards(b, analyzeContext(b, tb)).map((c) => c.archetypeId);
    expect(ha).toEqual(hb);
  });

  it("the look-ahead never strands: a full random playthrough leaves no empty tiles", { timeout: 30000 }, () => {
    // If a card stranded an empty neighbor with 0 options, the world could not
    // fill completely. Playing greedily to exhaustion proves no dead pockets.
    const w = generateWorld(31);
    for (let i = 0; i < 4000; i++) {
      const tile = assignFrontierTile(w);
      if (!tile) break;
      const ctx = analyzeContext(w, tile);
      const hand = generateCards(w, ctx);
      if (hand.length === 0) {
        w.assignedTileId = undefined;
        continue;
      }
      // apply first card
      for (const e of hand[0].effects) {
        if (e.type === "setTerrain") tile.terrain.kind = e.terrain;
        if (e.type === "setElevation") tile.elevation.value = e.value;
      }
      w.assignedTileId = undefined;
    }
    const emptyLeft = w.tiles.filter((t) => t.terrain.kind === "empty").length;
    expect(emptyLeft).toBe(0);
  });
});
