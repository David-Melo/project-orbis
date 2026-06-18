import { describe, it, expect, beforeEach } from "vitest";
import {
  saveWorld,
  loadWorld,
  clearSavedWorld,
  exportWorldJson,
  importWorldJson,
} from "./storage";
import { generateWorld } from "../systems/worldGeneration";

describe("persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    clearSavedWorld();
  });

  it("round-trips a world through localStorage", () => {
    const world = generateWorld(2024);
    world.events.push({
      id: "event_1",
      day: 1,
      title: "Test",
      description: "x",
      actor: "local-player",
      targetTileId: world.tiles[0].id,
      effects: [],
      createdAt: "now",
    });
    saveWorld(world);
    const loaded = loadWorld()!;
    expect(loaded).toBeDefined();
    expect(loaded.tiles.length).toBe(world.tiles.length);
    expect(loaded.events.length).toBe(1);
    expect(loaded.seed).toBe(world.seed);
  });

  it("returns undefined when nothing is saved", () => {
    expect(loadWorld()).toBeUndefined();
  });

  it("exports and re-imports JSON losslessly", () => {
    const world = generateWorld(99);
    const json = exportWorldJson(world);
    const back = importWorldJson(json);
    expect(back.tiles.length).toBe(world.tiles.length);
    expect(back.seed).toBe(world.seed);
  });

  it("throws on malformed import data", () => {
    expect(() => importWorldJson("{not valid")).toThrow();
    expect(() => importWorldJson(JSON.stringify({ version: 1 }))).toThrow();
  });
});
