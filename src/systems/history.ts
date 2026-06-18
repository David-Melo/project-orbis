import { nextId } from "../engine/ids";
import type { GeneratedCard } from "../engine/card";
import type { Effect } from "../engine/effects";
import type { TileEntity } from "../engine/components";
import type { WorldEvent, WorldState } from "../engine/world";

/**
 * HistorySystem.
 *
 * Records an accepted action as a WorldEvent and links it to the affected
 * tile. The event log is the world's memory: the current map is only the
 * latest materialized state, while the ordered events are the true artwork.
 */
export function recordEvent(
  world: WorldState,
  tile: TileEntity,
  card: GeneratedCard,
  effects: Effect[],
): WorldEvent {
  const flavor = card.flavor ? ` ${card.flavor}` : "";
  const event: WorldEvent = {
    id: nextId("event"),
    day: world.currentDay,
    title: card.title,
    description: `(${tile.position.x}, ${tile.position.y}) became ${tile.terrain.kind}.${flavor}`,
    actor: "local-player",
    cardId: card.id,
    targetTileId: tile.id,
    effects,
    createdAt: new Date().toISOString(),
  };

  world.events.push(event);
  tile.history.eventIds.push(event.id);
  return event;
}

export function eventsForTile(world: WorldState, tileId: string): WorldEvent[] {
  return world.events.filter((e) => e.targetTileId === tileId);
}
