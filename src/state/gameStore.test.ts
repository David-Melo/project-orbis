import { describe, it, expect, beforeEach } from "vitest";
import { GameStore } from "./gameStore";

describe("GameStore — the core loop", () => {
  beforeEach(() => localStorage.clear());

  it("starts a fresh world at day 0 in the idle phase", () => {
    const store = new GameStore();
    const s = store.getState();
    expect(s.phase).toBe("idle");
    expect(s.world.currentDay).toBe(0);
  });

  it("Start Day assigns an empty frontier tile and deals a hand", () => {
    const store = new GameStore();
    store.startDay();
    const s = store.getState();
    expect(s.phase).toBe("choosing");
    expect(s.hand.length).toBeGreaterThan(0);
    expect(s.hand.length).toBeLessThanOrEqual(3);
    expect(s.world.currentDay).toBe(1);
    const assigned = s.world.tiles.find((t) => t.id === s.world.assignedTileId)!;
    expect(assigned).toBeDefined();
    expect(s.context!.targetTerrain).toBe("empty"); // growth-only
    // A card is pre-selected so a second Space is an instant random move.
    expect(s.selectedCardId).toBeDefined();
    expect(s.hand.some((c) => c.id === s.selectedCardId)).toBe(true);
  });

  it("confirming a card applies it, records an event, and keeps the day", () => {
    const store = new GameStore();
    store.startDay();
    const { hand, world } = store.getState();
    const card = hand[0];
    const tileId = card.targetTileId;
    store.selectCard(card.id);
    store.confirmCard();

    const s = store.getState();
    expect(s.phase).toBe("idle");
    expect(s.world.events.length).toBe(1);
    expect(s.world.currentDay).toBe(1);
    const tile = s.world.tiles.find((t) => t.id === tileId)!;
    expect(tile.terrain.kind).not.toBe("empty");
    expect(tile.history.eventIds.length).toBe(1);
    expect(world.assignedTileId).toBeUndefined();
  });

  it("cancelling a day rolls the day counter back", () => {
    const store = new GameStore();
    store.startDay();
    expect(store.getState().world.currentDay).toBe(1);
    store.cancelDay();
    const s = store.getState();
    expect(s.phase).toBe("idle");
    expect(s.world.currentDay).toBe(0);
  });

  it("clicking an existing land tile begins a transform session on it", () => {
    const store = new GameStore();
    // Find an existing plain in the seeded world and click it.
    const plain = store.getState().world.tiles.find((t) => t.terrain.kind === "plain")!;
    store.handleTileClick(plain.id);
    const s = store.getState();
    expect(s.phase).toBe("choosing");
    expect(s.world.assignedTileId).toBe(plain.id);
    expect(s.context!.targetTerrain).toBe("plain");
  });

  it("persists across store instances (localStorage)", () => {
    const a = new GameStore();
    a.startDay();
    const card = a.getState().hand[0];
    a.selectCard(card.id);
    a.confirmCard();
    const dayA = a.getState().world.currentDay;

    const b = new GameStore(); // reloads from localStorage
    expect(b.getState().world.currentDay).toBe(dayA);
    expect(b.getState().world.events.length).toBe(1);
  });
});
