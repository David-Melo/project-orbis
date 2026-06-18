import { describe, it, expect } from "vitest";
import { generateWorld } from "./systems/worldGeneration";
import { assignFrontierTile } from "./systems/frontierAssignment";
import { analyzeContext } from "./systems/contextAnalysis";
import { generateCards } from "./systems/cardGeneration";
import { checkAllRequirements } from "./systems/requirementValidation";
import { applyEffects } from "./systems/effectApplication";
import { recordEvent } from "./systems/history";
import { exportWorldJson, importWorldJson } from "./persistence/storage";
import { ELEVATION_BANDS } from "./test/helpers";

/**
 * Plays many random growth days and asserts the loop stays coherent. This is
 * the end-to-end guard: it would have failed on bone-dry extends, on cards
 * that emit a future they can't legally play, and on elevation jumps.
 */
describe("integration: 80 days of random growth", () => {
  const world = generateWorld(12345);
  let played = 0;
  const seen = new Set<string>();
  let everyCardValid = true;
  let everyPlayedTileFilled = true;

  for (let day = 0; day < 80; day++) {
    const tile = assignFrontierTile(world);
    if (!tile) break;
    world.currentDay += 1;
    const ctx = analyzeContext(world, tile);
    const hand = generateCards(world, ctx);
    if (hand.length === 0) {
      world.assignedTileId = undefined;
      continue;
    }
    for (const card of hand) {
      seen.add(card.archetypeId);
      if (!checkAllRequirements(card.requirements, ctx, world)) everyCardValid = false;
    }
    const card = hand[0];
    applyEffects(world, tile, card.effects);
    recordEvent(world, tile, card, card.effects);
    if (tile.terrain.kind === "empty") everyPlayedTileFilled = false;
    world.assignedTileId = undefined;
    played++;
  }

  it("plays a long run of days", () => {
    expect(played).toBeGreaterThan(30);
    expect(world.events.length).toBe(played);
  });

  it("never offers a card that fails its own requirements", () => {
    expect(everyCardValid).toBe(true);
  });

  it("always fills the assigned empty tile when a card resolves", () => {
    expect(everyPlayedTileFilled).toBe(true);
  });

  it("exercises a wide variety of archetypes", () => {
    expect(seen.size).toBeGreaterThanOrEqual(6);
  });

  it("keeps every stat within 0-10", () => {
    for (const t of world.tiles) {
      for (const v of [t.elevation.value, t.moisture.value, t.temperature.value, t.fertility.value]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(10);
      }
    }
  });

  it("keeps elevation within each terrain's coherent band", () => {
    for (const t of world.tiles) {
      const band = ELEVATION_BANDS[t.terrain.kind];
      if (!band) continue;
      expect(t.elevation.value, `${t.terrain.kind} @ (${t.position.x},${t.position.y})`).toBeGreaterThanOrEqual(band[0]);
      expect(t.elevation.value).toBeLessThanOrEqual(band[1]);
    }
  });

  it("survives an export/import round-trip", () => {
    const back = importWorldJson(exportWorldJson(world));
    expect(back.tiles.length).toBe(world.tiles.length);
    expect(back.events.length).toBe(world.events.length);
  });
});
