import { Rng } from "../engine/rng";
import { nextId } from "../engine/ids";
import type { GeneratedCard, TileContext } from "../engine/card";
import type { WorldState } from "../engine/world";
import { ARCHETYPES } from "../cards/archetypes";
import { checkAllRequirements } from "./requirementValidation";

export const HAND_SIZE = 3;

/**
 * CardGenerationSystem.
 *
 * Walks every archetype, keeps the ones whose canGenerate predicate accepts
 * the local context, builds concrete cards, then validates each built card's
 * requirements (a belt-and-suspenders check so an archetype can never emit a
 * card that would be illegal to play). Up to HAND_SIZE cards are returned,
 * chosen deterministically from the world RNG.
 */
export function generateCards(world: WorldState, ctx: TileContext): GeneratedCard[] {
  const rng = new Rng(world.seed);
  rng.setState(world.rngState);

  const eligible = ARCHETYPES.filter((a) => a.canGenerate(ctx, world));

  const built: GeneratedCard[] = [];
  for (const archetype of rng.shuffle(eligible)) {
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
    if (checkAllRequirements(card.requirements, ctx, world)) {
      built.push(card);
    }
    if (built.length >= HAND_SIZE) break;
  }

  world.rngState = rng.getState();
  return built;
}
