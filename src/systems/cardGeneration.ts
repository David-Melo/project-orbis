import { Rng } from "../engine/rng";
import { nextId } from "../engine/ids";
import type { GeneratedCard, TileContext } from "../engine/card";
import type { TerrainKind, TileEntity } from "../engine/components";
import { getTile, orthogonalNeighbors, type WorldState } from "../engine/world";
import { ARCHETYPES } from "../cards/archetypes";
import { analyzeContext } from "./contextAnalysis";
import { checkAllRequirements } from "./requirementValidation";

export const HAND_SIZE = 3;

/** Archetype id of the synthetic "leave this tile as it is" option. */
export const NO_CHANGE_ID = "no_change";

/** A card that changes nothing — offered when acting on an existing tile. */
function makeNoChangeCard(ctx: TileContext): GeneratedCard {
  return {
    id: nextId("card"),
    archetypeId: NO_CHANGE_ID,
    title: "No Change",
    age: "primordial",
    targetTileId: ctx.targetTileId,
    requirements: [],
    effects: [],
    flavor: "Leave this place as it is.",
  };
}

/**
 * Would committing `newTerrain`/`newElevation` on `target` leave an adjacent
 * EMPTY tile with zero legal cards (a dead pocket)? One-step constraint
 * propagation / look-ahead, à la Wave Function Collapse: we temporarily apply
 * the change, re-check empty neighbors, then revert.
 */
function strandsNeighbor(
  world: WorldState,
  target: TileEntity,
  newTerrain: TerrainKind,
  newElevation: number | undefined,
): boolean {
  const savedKind = target.terrain.kind;
  const savedElev = target.elevation.value;
  target.terrain.kind = newTerrain;
  if (newElevation !== undefined) target.elevation.value = newElevation;

  let stranded = false;
  for (const nb of orthogonalNeighbors(world, target)) {
    if (nb.terrain.kind !== "empty") continue;
    const ctx = analyzeContext(world, nb);
    if (!ARCHETYPES.some((a) => a.canGenerate(ctx, world))) {
      stranded = true;
      break;
    }
  }

  target.terrain.kind = savedKind;
  target.elevation.value = savedElev;
  return stranded;
}

/**
 * CardGenerationSystem.
 *
 * Walks every archetype, keeps the ones whose canGenerate predicate accepts the
 * local context, builds concrete cards, and validates each built card's
 * requirements. Cards that would strand an empty neighbor (a dead pocket) are
 * de-prioritized but still kept as fallback, so a hand is never empty while a
 * legal move exists. Up to HAND_SIZE cards are returned, deterministically.
 */
export function generateCards(world: WorldState, ctx: TileContext): GeneratedCard[] {
  const rng = new Rng(world.seed);
  rng.setState(world.rngState);

  const eligible = ARCHETYPES.filter((a) => a.canGenerate(ctx, world));
  const target = getTile(world, ctx.targetTileId);

  // Acting on an EXISTING tile reserves a slot for the "No Change" option, so a
  // transform never forces you to alter a tile you'd rather keep.
  const existingTile = ctx.targetTerrain !== "empty";
  const cap = existingTile ? HAND_SIZE - 1 : HAND_SIZE;

  const safe: GeneratedCard[] = [];
  const risky: GeneratedCard[] = [];

  for (const archetype of rng.shuffle(eligible)) {
    if (safe.length >= cap) break;
    const result = archetype.build(ctx, world, rng);
    const card: GeneratedCard = {
      id: nextId("card"),
      archetypeId: archetype.id,
      title: result.title,
      age: archetype.age,
      targetTileId: ctx.targetTileId,
      requirements: result.requirements,
      effects: result.effects,
      flavor: result.flavor,
    };
    if (!checkAllRequirements(card.requirements, ctx, world)) continue;

    const setTerrain = card.effects.find((e) => e.type === "setTerrain");
    const setElevation = card.effects.find((e) => e.type === "setElevation");
    const newTerrain: TerrainKind =
      setTerrain && setTerrain.type === "setTerrain"
        ? setTerrain.terrain
        : target?.terrain.kind ?? "plain";
    const newElevation =
      setElevation && setElevation.type === "setElevation" ? setElevation.value : undefined;

    const isRisky = target ? strandsNeighbor(world, target, newTerrain, newElevation) : false;
    (isRisky ? risky : safe).push(card);
  }

  world.rngState = rng.getState();
  // Prefer safe cards; fall back to risky ones so a legal move is never hidden.
  const hand = [...safe, ...risky].slice(0, cap);
  if (existingTile) hand.push(makeNoChangeCard(ctx));
  return hand;
}
