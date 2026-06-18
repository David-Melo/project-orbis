// Targeted checks for the five reported issues. Builds synthetic TileContexts
// and asserts which archetypes may/may not generate.
import { ARCHETYPES_BY_ID } from "../src/cards/archetypes";
import type { TileContext } from "../src/engine/card";
import type { TerrainKind } from "../src/engine/components";

let failures = 0;
function expect(id: string, ctx: TileContext, allowed: boolean, label: string) {
  const got = ARCHETYPES_BY_ID[id].canGenerate(ctx, {} as never);
  const ok = got === allowed;
  if (!ok) failures++;
  console.log(`${ok ? "ok" : "FAIL"}: ${label} — ${id} ${allowed ? "should" : "should NOT"} generate (got ${got})`);
}

function ctx(adjacent: TerrainKind[], over: Partial<TileContext> = {}): TileContext {
  const has = (k: TerrainKind) => adjacent.includes(k);
  const water: TerrainKind[] = ["ocean", "coast", "river", "lake", "wetland"];
  const fresh: TerrainKind[] = ["river", "lake", "wetland"];
  const high: TerrainKind[] = ["hill", "mountain", "volcano"];
  const land: TerrainKind[] = ["coast", "plain", "hill", "mountain", "volcano", "basalt"];
  return {
    targetTileId: "t", targetX: 0, targetY: 0,
    adjacentTerrains: adjacent, nearbyTerrains: adjacent,
    touchesWater: adjacent.some((k) => water.includes(k)),
    touchesOcean: has("ocean"), touchesRiver: has("river"), touchesLake: has("lake"),
    touchesLava: has("lava"), touchesIce: has("ice"), touchesVolcano: has("volcano"),
    touchesMountain: has("mountain"),
    touchesLand: adjacent.some((k) => land.includes(k)),
    touchesFreshWater: adjacent.some((k) => fresh.includes(k)),
    touchesHighGround: adjacent.some((k) => high.includes(k)),
    landNeighborCount: adjacent.length,
    averageElevation: 4, averageMoisture: 5, averageTemperature: 7,
    ...over,
  };
}

// Issue #1: oceans can be extended.
expect("spread_ocean", ctx(["ocean"], { averageElevation: 1 }), true, "#1 ocean-adjacent low tile");

// Spread Ocean and Sink Land must produce DIFFERENT terrain on the same tile
// (regression: "Drown the Shore" used to duplicate Spread Ocean).
function terrainOf(id: string, c: TileContext): string {
  const built = ARCHETYPES_BY_ID[id].build(c, {} as never, { pick: (a: unknown[]) => a[0] } as never);
  const set = built.effects.find((e) => e.type === "setTerrain");
  return set && set.type === "setTerrain" ? set.terrain : "?";
}
{
  const shore = ctx(["ocean"], { averageElevation: 1 });
  const so = terrainOf("spread_ocean", shore);
  const sl = terrainOf("sink_land", shore);
  const ok = so === "ocean" && sl === "wetland" && so !== sl;
  if (!ok) failures++;
  console.log(`${ok ? "ok" : "FAIL"}: Spread Ocean (${so}) != Sink Land (${sl}) on the same shore tile`);
}

// Issue #2: ocean -> land requires a coast (no plain directly on ocean).
expect("raise_land", ctx(["ocean"], { averageElevation: 1 }), false, "#2 raise_land on ocean tile");
expect("form_coast", ctx(["ocean"], { averageElevation: 1 }), true, "#2 form_coast on ocean tile");
expect("raise_land", ctx(["coast", "plain"], { averageElevation: 4 }), true, "#2 raise_land inland");

// Issue #3: no river without a source.
expect("carve_river", ctx(["plain"], { averageElevation: 4, averageTemperature: 7 }), false, "#3 river on bare plain");
expect("carve_river", ctx(["mountain"], { averageElevation: 6 }), true, "#3 river from a mountain spring");
expect("carve_river", ctx(["river"], { averageElevation: 4 }), true, "#3 river extends existing river");

// Issue #4: no lake without a low basin + fresh source.
expect("form_lake", ctx(["plain"], { averageElevation: 5 }), false, "#4 lake on high dry plain");
expect("form_lake", ctx(["river"], { averageElevation: 2 }), true, "#4 lake in low river basin");

// Issue #5: no freezing temperate ground.
expect("freeze", ctx(["plain"], { averageTemperature: 7 }), false, "#5 freeze temperate plain");
expect("freeze", ctx(["coast"], { averageTemperature: 7 }), false, "#5 freeze temperate coast");
expect("freeze", ctx(["coast"], { averageTemperature: 2 }), true, "#5 freeze at a cold latitude");
expect("freeze", ctx(["ice"], { averageTemperature: 3 }), true, "#5 freeze beside existing ice");

console.log(failures === 0 ? "\nALL SCENARIOS PASS" : `\n${failures} SCENARIO FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
