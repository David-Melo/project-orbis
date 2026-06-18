import { describe, it, expect } from "vitest";
import { applyEffects } from "./effectApplication";
import { emptyWorld, setTile } from "../test/helpers";

describe("EffectApplicationSystem", () => {
  it("setTerrain replaces the surface with that terrain's defaults", () => {
    const w = emptyWorld();
    const t = setTile(w, 3, 3, "plain", 4)!;
    expect(t.surface.liquid).toBe(false);
    applyEffects(w, t, [{ type: "setTerrain", terrain: "ocean" }]);
    expect(t.terrain.kind).toBe("ocean");
    expect(t.surface.liquid).toBe(true);
    expect(t.surface.buildable).toBe(false);
  });

  it("setElevation and adjust* clamp to 0-10", () => {
    const w = emptyWorld();
    const t = setTile(w, 1, 1, "plain", 5, 5)!;
    applyEffects(w, t, [{ type: "setElevation", value: 99 }]);
    expect(t.elevation.value).toBe(10);
    applyEffects(w, t, [{ type: "adjustElevation", amount: -99 }]);
    expect(t.elevation.value).toBe(0);
    applyEffects(w, t, [{ type: "adjustMoisture", amount: 99 }]);
    expect(t.moisture.value).toBe(10);
    applyEffects(w, t, [{ type: "adjustTemperature", amount: -99 }]);
    expect(t.temperature.value).toBe(0);
  });

  it("addTrait de-duplicates and removeTrait removes", () => {
    const w = emptyWorld();
    const t = setTile(w, 2, 2, "plain")!;
    applyEffects(w, t, [{ type: "addTrait", trait: "sacred" }, { type: "addTrait", trait: "sacred" }]);
    expect(t.traits.traits).toEqual(["sacred"]);
    applyEffects(w, t, [{ type: "removeTrait", trait: "sacred" }]);
    expect(t.traits.traits).toEqual([]);
  });

  it("spreadMoisture raises moisture of nearby tiles", () => {
    const w = emptyWorld();
    const t = setTile(w, 3, 3, "river", 3, 5)!;
    applyEffects(w, t, [{ type: "spreadMoisture", amount: 3, radius: 1 }]);
    expect(setTile(w, 3, 2, "plain") && w.tiles.find((x) => x.position.x === 3 && x.position.y === 2)!.moisture.value).toBeGreaterThanOrEqual(0);
    // The neighbor at (4,3) should have gained moisture.
    const neighbor = w.tiles.find((x) => x.position.x === 4 && x.position.y === 3)!;
    expect(neighbor.moisture.value).toBe(3);
  });

  it("addConnection appends a directional connection", () => {
    const w = emptyWorld();
    const t = setTile(w, 1, 1, "river")!;
    applyEffects(w, t, [{ type: "addConnection", direction: "n", connection: { kind: "river" } }]);
    expect(t.connections.n).toEqual([{ kind: "river" }]);
  });

  it("spreadMoisture falls off with distance (more adjacent than two tiles out)", () => {
    const w = emptyWorld(9);
    const src = setTile(w, 4, 4, "river", 3, 5)!;
    applyEffects(w, src, [{ type: "spreadMoisture", amount: 4, radius: 2 }]);
    const near = w.tiles.find((t) => t.position.x === 5 && t.position.y === 4)!; // dist 1
    const far = w.tiles.find((t) => t.position.x === 6 && t.position.y === 4)!; // dist 2
    expect(near.moisture.value).toBeGreaterThan(far.moisture.value);
    expect(far.moisture.value).toBeGreaterThan(0);
  });

  it("flowDownhill records a river connection + trait toward the lowest neighbor", () => {
    const w = emptyWorld();
    const river = setTile(w, 3, 3, "river", 4)!;
    setTile(w, 3, 2, "plain", 6); // N higher
    setTile(w, 3, 4, "plain", 2); // S lower  <- flow target
    setTile(w, 2, 3, "plain", 5);
    setTile(w, 4, 3, "plain", 5);
    applyEffects(w, river, [{ type: "flowDownhill" }]);
    expect(river.connections.s).toEqual([{ kind: "river" }]);
    expect(river.traits.traits).toContain("flows-s");
  });

  it("flowDownhill does nothing when no neighbor is lower (a local pit)", () => {
    const w = emptyWorld();
    const river = setTile(w, 3, 3, "river", 1)!;
    // All four orthogonal neighbors stand higher than the river.
    setTile(w, 3, 2, "plain", 5);
    setTile(w, 3, 4, "plain", 5);
    setTile(w, 2, 3, "plain", 5);
    setTile(w, 4, 3, "plain", 5);
    applyEffects(w, river, [{ type: "flowDownhill" }]);
    expect(river.traits.traits.some((t) => t.startsWith("flows-"))).toBe(false);
  });
});
