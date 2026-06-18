// Headless smoke test of the core loop. Not part of the app build.
import { generateWorld } from "../src/systems/worldGeneration";
import { assignFrontierTile, findFrontierTiles } from "../src/systems/frontierAssignment";
import { analyzeContext } from "../src/systems/contextAnalysis";
import { generateCards } from "../src/systems/cardGeneration";
import { checkAllRequirements } from "../src/systems/requirementValidation";
import { applyEffects } from "../src/systems/effectApplication";
import { recordEvent } from "../src/systems/history";
import { exportWorldJson, importWorldJson } from "../src/persistence/storage";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

const world = generateWorld(12345);
assert(world.tiles.length === 32 * 32, "world has 1024 tiles");
assert(findFrontierTiles(world).length > 0, "seeded world has frontier tiles");

let played = 0;
const seenArchetypes = new Set<string>();
for (let day = 0; day < 60; day++) {
  world.currentDay += 1;
  const tile = assignFrontierTile(world);
  if (!tile) break;
  const ctx = analyzeContext(world, tile);
  const hand = generateCards(world, ctx);
  if (hand.length === 0) {
    world.assignedTileId = undefined;
    continue;
  }
  assert(hand.length <= 3, `day ${day}: hand size <= 3 (got ${hand.length})`);
  // Every generated card must pass its own requirements.
  for (const card of hand) {
    if (!checkAllRequirements(card.requirements, ctx, world)) {
      assert(false, `day ${day}: card ${card.title} failed its own requirements`);
    }
    seenArchetypes.add(card.archetypeId);
  }
  // Play the first card.
  const card = hand[0];
  const before = tile.terrain.kind;
  applyEffects(world, tile, card.effects);
  recordEvent(world, tile, card, card.effects);
  assert(tile.terrain.kind !== "empty", `day ${day}: tile is no longer empty after play (${before} -> ${tile.terrain.kind})`);
  world.assignedTileId = undefined;
  played++;
}

assert(played > 20, `played many days (${played})`);
assert(world.events.length === played, `event count matches plays (${world.events.length} === ${played})`);
assert(seenArchetypes.size >= 4, `variety of archetypes appeared (${seenArchetypes.size}): ${[...seenArchetypes].join(", ")}`);

// Stats stay clamped to 0-10.
for (const t of world.tiles) {
  for (const v of [t.elevation.value, t.moisture.value, t.temperature.value, t.fertility.value]) {
    if (v < 0 || v > 10) assert(false, `stat out of range at (${t.position.x},${t.position.y}): ${v}`);
  }
}
assert(true, "all stats within 0-10");

// Export / import round-trip.
const json = exportWorldJson(world);
const reloaded = importWorldJson(json);
assert(reloaded.events.length === world.events.length, "export/import preserves events");
assert(reloaded.tiles.length === world.tiles.length, "export/import preserves tiles");

console.log(`\nArchetypes seen: ${[...seenArchetypes].sort().join(", ")}`);
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
