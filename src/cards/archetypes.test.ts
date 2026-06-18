import { describe, it, expect } from "vitest";
import type { TileContext } from "../engine/card";
import type { TerrainKind } from "../engine/components";
import type { WorldState } from "../engine/world";
import { ARCHETYPES, ARCHETYPES_BY_ID } from "./archetypes";
import {
  makeContext,
  canGen,
  build,
  resultTerrain,
  resultElevation,
  ELEVATION_BANDS,
} from "../test/helpers";

/** All archetype ids that can generate for a given context. */
function actions(ctx: TileContext): string[] {
  return ARCHETYPES.filter((a) => a.canGenerate(ctx, {} as WorldState)).map((a) => a.id);
}

describe("archetype registry", () => {
  it("every archetype has a unique id and at least one target terrain", () => {
    const ids = ARCHETYPES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ARCHETYPES) expect(a.targets.length).toBeGreaterThan(0);
  });

  it("a card only generates on a terrain it targets", () => {
    const allTerrains: TerrainKind[] = [
      "empty", "ocean", "coast", "plain", "hill", "mountain",
      "volcano", "lava", "basalt", "river", "lake", "wetland", "ice",
    ];
    for (const a of ARCHETYPES) {
      for (const terrain of allTerrains) {
        const ctx = makeContext(["plain", "ocean", "lava", "ice", "river", "mountain"], {
          targetTerrain: terrain,
          averageTemperature: 2,
          isBasin: true,
        });
        if (a.canGenerate(ctx, {} as WorldState)) {
          expect(a.targets).toContain(terrain);
        }
      }
    }
  });

  it("every generated card sets a terrain and a coherent elevation", () => {
    // Use a rich neighborhood so most archetypes generate, then sanity-check
    // each card it produces.
    const ctx = makeContext(["plain", "hill", "mountain", "coast", "ocean", "river", "lava", "ice"], {
      isBasin: true,
      averageTemperature: 2,
    });
    for (const a of ARCHETYPES) {
      if (!a.canGenerate(ctx, {} as WorldState)) continue;
      const terrain = resultTerrain(a.id, ctx)!;
      const elevation = resultElevation(a.id, ctx);
      expect(terrain, `${a.id} sets a terrain`).toBeTruthy();
      if (elevation !== undefined) {
        const band = ELEVATION_BANDS[terrain];
        if (band) {
          expect(elevation, `${a.id} -> ${terrain} elevation in band`).toBeGreaterThanOrEqual(band[0]);
          expect(elevation).toBeLessThanOrEqual(band[1]);
        }
      }
    }
  });

  it("every card sets/clamps elevation to 0-10", () => {
    const ctx = makeContext(["plain", "ocean", "river", "lava", "ice", "mountain"], {
      isBasin: true,
      targetElevation: 8,
      averageElevation: 8,
      averageTemperature: 2,
    });
    for (const a of ARCHETYPES) {
      if (!a.canGenerate(ctx, {} as WorldState)) continue;
      const e = resultElevation(a.id, ctx);
      if (e !== undefined) {
        expect(e).toBeGreaterThanOrEqual(0);
        expect(e).toBeLessThanOrEqual(10);
      }
    }
  });
});

describe("raise_land (vertical uplift)", () => {
  it("targets existing land only, not empty frontier", () => {
    expect(ARCHETYPES_BY_ID.raise_land.targets).toEqual(["coast", "plain", "hill"]);
    expect(canGen("raise_land", makeContext(["plain"], { targetTerrain: "empty" }))).toBe(false);
  });

  it("steps coast -> plain -> hill -> mountain", () => {
    expect(resultTerrain("raise_land", makeContext(["plain"], { targetTerrain: "coast", targetElevation: 2 }))).toBe("plain");
    expect(resultTerrain("raise_land", makeContext(["plain"], { targetTerrain: "plain", targetElevation: 4 }))).toBe("hill");
    expect(resultTerrain("raise_land", makeContext(["hill"], { targetTerrain: "hill", targetElevation: 6 }))).toBe("mountain");
  });

  it("does not uplift land that touches open ocean", () => {
    expect(canGen("raise_land", makeContext(["ocean", "plain"], { targetTerrain: "plain" }))).toBe(false);
  });
});

describe("extend archetypes (lateral feature growth)", () => {
  const cases: Array<[string, TerrainKind]> = [
    ["extend_plain", "plain"],
    ["extend_hill", "hill"],
    ["extend_mountain", "mountain"],
    ["extend_basalt", "basalt"],
    ["extend_wetland", "wetland"],
  ];

  for (const [id, kind] of cases) {
    it(`${id} copies an adjacent ${kind} into empty frontier`, () => {
      const ctx = makeContext([kind], { averageElevation: kind === "mountain" ? 8 : 4 });
      expect(canGen(id, ctx)).toBe(true);
      expect(resultTerrain(id, ctx)).toBe(kind);
    });

    it(`${id} sets moisture (regression: extends used to leave land bone-dry)`, () => {
      const effects = build(id, makeContext([kind])).effects;
      expect(effects.some((e) => e.type === "adjustMoisture" || e.type === "spreadMoisture")).toBe(true);
    });

    it(`${id} refuses with no source terrain adjacent`, () => {
      expect(canGen(id, makeContext(["ocean"]))).toBe(false);
    });

    it(`${id} refuses across open ocean (coast must separate land and sea)`, () => {
      expect(canGen(id, makeContext([kind, "ocean"]))).toBe(false);
    });
  }
});

describe("coast & ocean", () => {
  it("form_coast turns an ocean-adjacent empty tile into coast", () => {
    expect(resultTerrain("form_coast", makeContext(["ocean"]))).toBe("coast");
  });

  it("extend_coast continues a coast inland but not across ocean", () => {
    expect(canGen("extend_coast", makeContext(["coast", "plain"], { averageElevation: 3 }))).toBe(true);
    expect(canGen("extend_coast", makeContext(["coast", "ocean"], { averageElevation: 1 }))).toBe(false);
  });

  it("form_shore begins a coastline from dry land with no sea nearby", () => {
    expect(resultTerrain("form_shore", makeContext(["plain", "plain"], { averageElevation: 4 }))).toBe("coast");
    // Defers to the dedicated cards when ocean or coast is already adjacent.
    expect(canGen("form_shore", makeContext(["plain", "ocean"]))).toBe(false);
    expect(canGen("form_shore", makeContext(["plain", "coast"]))).toBe(false);
  });

  it("spread_ocean grows the sea and erodes coast/wetland back to ocean", () => {
    expect(resultTerrain("spread_ocean", makeContext(["ocean"], { averageElevation: 1 }))).toBe("ocean");
    expect(resultTerrain("spread_ocean", makeContext(["ocean"], { targetTerrain: "coast", averageElevation: 1 }))).toBe("ocean");
  });

  it("spread_ocean can place sea next to a shoreline (coast/wetland), not only open ocean", () => {
    expect(canGen("spread_ocean", makeContext(["coast"], { averageElevation: 2 }))).toBe(true);
    expect(canGen("spread_ocean", makeContext(["wetland"], { averageElevation: 2 }))).toBe(true);
  });

  it("form_cliff makes a tall shoreline where high land meets the sea", () => {
    // High land + at the water's edge -> cliff, not a low beach.
    const high = makeContext(["ocean", "hill"], { averageElevation: 6 });
    expect(canGen("form_cliff", high)).toBe(true);
    expect(resultTerrain("form_cliff", high)).toBe("cliff");
    expect(resultElevation("form_cliff", high)!).toBeGreaterThanOrEqual(5);
    // Low land at the shore stays a coast, no cliff.
    expect(canGen("form_cliff", makeContext(["ocean"], { averageElevation: 2 }))).toBe(false);
  });

  it("spread_ocean and form_shore are NOT the same as each other (distinct outcomes)", () => {
    // Regression for the old "Drown the Shore == Spread Ocean" duplication.
    const shore = makeContext(["ocean"], { averageElevation: 1 });
    expect(resultTerrain("spread_ocean", shore)).toBe("ocean");
    expect(resultTerrain("sink_land", makeContext(["plain"], { targetTerrain: "plain" }))).toBe("coast");
  });
});

describe("sink_land (downward ladder)", () => {
  it("never targets empty frontier — it is a deliberate transform, not growth", () => {
    expect(ARCHETYPES_BY_ID.sink_land.targets).not.toContain("empty");
    expect(canGen("sink_land", makeContext(["river"], { targetTerrain: "empty", averageElevation: 3 }))).toBe(false);
  });

  it("steps plain -> coast -> (ocean by sea / wetland inland) -> lake", () => {
    expect(resultTerrain("sink_land", makeContext(["plain"], { targetTerrain: "plain", averageElevation: 4 }))).toBe("coast");
    expect(resultTerrain("sink_land", makeContext(["plain"], { targetTerrain: "coast", averageElevation: 3 }))).toBe("wetland");
    expect(resultTerrain("sink_land", makeContext(["ocean"], { targetTerrain: "coast", averageElevation: 1 }))).toBe("ocean");
    expect(resultTerrain("sink_land", makeContext(["plain"], { targetTerrain: "wetland", averageElevation: 3 }))).toBe("lake");
  });
});

describe("volcano & lava", () => {
  it("erupt_volcano belongs to the heights: a mountain erupts, vents form near volcanic ground, NOT on bare plains", () => {
    // A mountain grows into a volcano.
    expect(canGen("erupt_volcano", makeContext([], { targetTerrain: "mountain" }))).toBe(true);
    expect(resultTerrain("erupt_volcano", makeContext([], { targetTerrain: "mountain", targetElevation: 8 }))).toBe("volcano");
    // New vents only within an existing volcanic neighborhood.
    expect(canGen("erupt_volcano", makeContext(["mountain"]))).toBe(true);
    expect(canGen("erupt_volcano", makeContext(["volcano"]))).toBe(true);
    expect(canGen("erupt_volcano", makeContext(["lava"]))).toBe(true);
    // The bug we are fixing: NO volcano on a random plain with no volcanic neighbor.
    expect(canGen("erupt_volcano", makeContext(["plain", "plain"]))).toBe(false);
    expect(canGen("erupt_volcano", makeContext(["coast"]))).toBe(false);
    // It is still tall.
    const e = resultElevation("erupt_volcano", makeContext(["mountain"], { averageElevation: 6 }))!;
    expect(e).toBeGreaterThanOrEqual(7);
  });

  it("spread_lava needs lava/volcano nearby", () => {
    expect(canGen("spread_lava", makeContext(["lava"]))).toBe(true);
    expect(canGen("spread_lava", makeContext(["plain"]))).toBe(false);
    expect(resultTerrain("spread_lava", makeContext(["volcano"]))).toBe("lava");
  });

  it("cool_lava solidifies lava to basalt by water/ice or in cool air", () => {
    expect(canGen("cool_lava", makeContext(["lava", "ocean"]))).toBe(true);
    expect(canGen("cool_lava", makeContext([], { targetTerrain: "lava", averageTemperature: 5 }))).toBe(true);
    expect(resultTerrain("cool_lava", makeContext(["lava", "ice"]))).toBe("basalt");
    // Hot, dry, no lava nearby: nothing to cool.
    expect(canGen("cool_lava", makeContext(["plain"], { averageTemperature: 9 }))).toBe(false);
  });
});

describe("ice (cold gating)", () => {
  it("freeze refuses temperate ground (regression: 'freeze the void')", () => {
    expect(canGen("freeze", makeContext(["plain"], { averageTemperature: 7 }))).toBe(false);
    expect(canGen("freeze", makeContext(["coast"], { averageTemperature: 7 }))).toBe(false);
  });

  it("freeze works in genuine cold or beside existing ice", () => {
    expect(canGen("freeze", makeContext(["coast"], { averageTemperature: 2 }))).toBe(true);
    expect(canGen("freeze", makeContext(["ice"], { averageTemperature: 3 }))).toBe(true);
    expect(resultTerrain("freeze", makeContext(["ocean"], { targetTerrain: "ocean", averageTemperature: 2 }))).toBe("ice");
  });

  it("melt_ice only acts on existing ice when warm enough", () => {
    expect(ARCHETYPES_BY_ID.melt_ice.targets).toEqual(["ice"]);
    expect(canGen("melt_ice", makeContext(["plain"], { targetTerrain: "ice", averageTemperature: 6 }))).toBe(true);
    expect(canGen("melt_ice", makeContext(["plain"], { targetTerrain: "ice", averageTemperature: 2 }))).toBe(false);
  });
});

describe("rivers, lakes, springs", () => {
  it("carve_river needs a slope/meltwater/river source and stays linear (not water-boxed)", () => {
    expect(canGen("carve_river", makeContext(["plain"], { averageElevation: 4 }))).toBe(false);
    expect(canGen("carve_river", makeContext(["mountain"], { averageElevation: 6 }))).toBe(true);
    expect(canGen("carve_river", makeContext(["river"]))).toBe(true);
    expect(canGen("carve_river", makeContext(["mountain", "lava"]))).toBe(false);
    // Boxed in by water -> would fill a blob, so no new river.
    expect(canGen("carve_river", makeContext(["river", "river", "lake"]))).toBe(false);
  });

  it("form_lake needs a fresh-water source AND a low basin, and won't fill a water blob", () => {
    expect(canGen("form_lake", makeContext(["plain"], { averageElevation: 5 }))).toBe(false);
    // River feeding a genuine low spot -> lake.
    expect(canGen("form_lake", makeContext(["river"], { averageElevation: 2 }))).toBe(true);
    // River next to mid-elevation ground that is NOT a basin -> no lake (was the bias).
    expect(canGen("form_lake", makeContext(["river"], { averageElevation: 4, isBasin: false }))).toBe(false);
    // A dry basin with no source is NOT a lake (that is Form Spring's pool).
    expect(canGen("form_lake", makeContext(["plain", "plain", "plain"], { isBasin: true, averageElevation: 4 }))).toBe(false);
    expect(resultTerrain("form_lake", makeContext(["river"], { averageElevation: 2 }))).toBe("lake");
  });

  it("form_floodplain is the way OUT of water: fertile land beside fresh water", () => {
    expect(resultTerrain("form_floodplain", makeContext(["river"], { averageElevation: 3 }))).toBe("plain");
    expect(canGen("form_floodplain", makeContext(["lake", "wetland"], { averageElevation: 3 }))).toBe(true);
    // Defers to extend_plain when there is a plain to extend, and needs water.
    expect(canGen("form_floodplain", makeContext(["river", "plain"]))).toBe(false);
    expect(canGen("form_floodplain", makeContext(["plain", "plain"]))).toBe(false);
  });

  it("form_spring seeds water in a dry basin/land but never beside ANY water (incl. coast)", () => {
    expect(canGen("form_spring", makeContext(["plain"], { averageMoisture: 5, averageElevation: 4 }))).toBe(true);
    expect(resultTerrain("form_spring", makeContext(["plain", "plain", "plain"], { isBasin: true, averageMoisture: 5 }))).toBe("lake");
    expect(canGen("form_spring", makeContext(["plain"], { averageMoisture: 1 }))).toBe(false);
    expect(canGen("form_spring", makeContext(["lake", "plain"], { averageMoisture: 6 }))).toBe(false);
    expect(canGen("form_spring", makeContext(["coast", "plain"], { averageMoisture: 6 }))).toBe(false);
  });
});

describe("wear_down (erosion of heights)", () => {
  it("lowers volcano -> mountain -> hill -> plain", () => {
    expect(resultTerrain("wear_down", makeContext([], { targetTerrain: "volcano", targetElevation: 9 }))).toBe("mountain");
    expect(resultTerrain("wear_down", makeContext([], { targetTerrain: "mountain", targetElevation: 8 }))).toBe("hill");
    expect(resultTerrain("wear_down", makeContext([], { targetTerrain: "hill", targetElevation: 6 }))).toBe("plain");
  });

  it("only targets heights", () => {
    expect(ARCHETYPES_BY_ID.wear_down.targets).toEqual(["hill", "mountain", "volcano"]);
    expect(canGen("wear_down", makeContext([], { targetTerrain: "plain" }))).toBe(false);
  });
});

describe("available actions by neighborhood (the rule the player feels)", () => {
  it("a dry inland plain frontier offers building AND a way to start water", () => {
    const ctx = makeContext(["plain", "plain"], { averageElevation: 4, averageMoisture: 5 });
    const a = actions(ctx);
    expect(a).toContain("extend_plain"); // grow the plain sideways
    expect(a).toContain("form_shore"); // begin a coastline
    expect(a).toContain("form_spring"); // seed water
    expect(a).not.toContain("raise_land"); // uplift is for existing land, not empty
    expect(a).not.toContain("erupt_volcano"); // volcanoes don't speckle bare plains
  });

  it("an ocean-adjacent frontier resolves through coast or sea, never instant plain", () => {
    const ctx = makeContext(["ocean", "plain"], { averageElevation: 2 });
    const a = actions(ctx);
    expect(a).toContain("form_coast");
    expect(a).toContain("spread_ocean");
    expect(a).not.toContain("extend_plain"); // no plain straight onto the sea
    expect(a).not.toContain("form_shore");
  });
});

describe("hand composition (no weird or duplicate options)", () => {
  it("REGRESSION: a frontier tile beside a coast (no fresh water) offers no lake/pool", () => {
    // The reported case: Plain(5) -> Coast(3), then the next empty tile beside
    // coast+plain was offering Flood Basin AND Spring-fed Pool. It must not.
    const ctx = makeContext(["coast", "plain"], { averageElevation: 4, averageMoisture: 4, isBasin: true });
    const a = actions(ctx);
    expect(a).not.toContain("form_lake");
    expect(a).not.toContain("form_spring");
    expect(a).toContain("extend_coast");
    expect(a).toContain("extend_plain");
  });

  it("REGRESSION: you can grow a plain inland from a shore (coast) or a hill, not only from a plain", () => {
    expect(canGen("extend_plain", makeContext(["coast"], { averageElevation: 3 }))).toBe(true);
    expect(resultTerrain("extend_plain", makeContext(["coast"], { averageElevation: 3 }))).toBe("plain");
    expect(canGen("extend_plain", makeContext(["hill"], { averageElevation: 5 }))).toBe(true);
    // but never a plain straight onto the open sea
    expect(canGen("extend_plain", makeContext(["coast", "ocean"], { averageElevation: 2 }))).toBe(false);
  });

  it("INVARIANT: any empty tile touching walkable land (not open ocean) can grow more land", () => {
    const landKinds: Array<Parameters<typeof makeContext>[0]> = [
      ["plain"], ["coast"], ["hill"], ["mountain"], ["basalt"], ["wetland"],
    ];
    const landOutputs = new Set(["plain", "coast", "cliff", "hill", "mountain", "basalt"]);
    for (const adj of landKinds) {
      const ctx = makeContext(adj, { averageElevation: 4, averageMoisture: 4 });
      const grows = ARCHETYPES.filter((a) => a.canGenerate(ctx, {} as WorldState)).some((a) =>
        landOutputs.has(resultTerrain(a.id, ctx) ?? ""),
      );
      expect(grows, `no land-growth option beside ${adj.join("+")}`).toBe(true);
    }
  });

  it("form_lake and form_spring are mutually exclusive (one needs a source, the other needs none)", () => {
    const sampleAdjacencies: Array<Parameters<typeof makeContext>[0]> = [
      ["river"], ["wetland"], ["lake"], ["ice"], ["plain"], ["plain", "plain", "plain"],
      ["coast", "plain"], ["river", "plain"], ["wetland", "plain"],
    ];
    for (const adj of sampleAdjacencies) {
      for (const isBasin of [false, true]) {
        const ctx = makeContext(adj, { isBasin, averageMoisture: 5, averageElevation: 3 });
        const both = canGen("form_lake", ctx) && canGen("form_spring", ctx);
        expect(both, `both fired on ${adj.join("+")} basin=${isBasin}`).toBe(false);
      }
    }
  });

  it("no two generated cards produce the SAME terrain on the same frontier tile", () => {
    // The general invariant that would have caught both Drown-vs-Spread-Ocean
    // and Flood-Basin-vs-Spring-fed-Pool duplications.
    const adjacencies: Array<Parameters<typeof makeContext>[0]> = [
      ["ocean"], ["ocean", "plain"], ["coast"], ["coast", "plain"], ["plain"],
      ["plain", "plain", "plain"], ["river"], ["river", "plain"], ["wetland"],
      ["wetland", "plain"], ["mountain"], ["hill"], ["lava"], ["lava", "ocean"],
      ["volcano"], ["ice"], ["mountain", "plain"], ["coast", "plain", "plain"],
    ];
    for (const adj of adjacencies) {
      for (const temp of [7, 2]) {
        for (const isBasin of [false, true]) {
          const ctx = makeContext(adj, { averageTemperature: temp, isBasin, averageMoisture: 5, averageElevation: 3 });
          const terrains = ARCHETYPES.filter((x) => x.canGenerate(ctx, {} as WorldState))
            .map((x) => resultTerrain(x.id, ctx))
            .filter((t): t is NonNullable<typeof t> => t !== undefined);
          const dupes = terrains.filter((t, i) => terrains.indexOf(t) !== i);
          expect(dupes, `duplicate terrain(s) on ${adj.join("+")} t${temp} basin=${isBasin}: ${dupes.join(",")}`).toEqual([]);
        }
      }
    }
  });
});
