export type EntityId = string;

let counter = 0;

/**
 * Monotonic id generator. Prefixed so different entity kinds are recognizable
 * in logs and exported JSON. Ids are unique within a single runtime session;
 * the counter is reset when a world is loaded so saved ids are respected.
 */
export function nextId(prefix: string): EntityId {
  counter += 1;
  return `${prefix}_${counter.toString(36)}`;
}

/** Reset the counter, used after loading a world so new ids don't collide. */
export function seedIdCounter(value: number): void {
  counter = value;
}

export function currentIdCounter(): number {
  return counter;
}
