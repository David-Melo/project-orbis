import { currentIdCounter, seedIdCounter } from "../engine/ids";
import type { WorldState } from "../engine/world";

const STORAGE_KEY = "project-orbis:v0.0.1";
const SAVE_VERSION = 1;

type SaveFile = {
  version: number;
  savedAt: string;
  idCounter: number;
  world: WorldState;
};

/** Persist the world (and the id counter) to localStorage. */
export function saveWorld(world: WorldState): void {
  const payload: SaveFile = {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    idCounter: currentIdCounter(),
    world,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("Project Orbis: failed to save world", err);
  }
}

/** Load the world from localStorage, or undefined if none/invalid. */
export function loadWorld(): WorldState | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const payload = JSON.parse(raw) as SaveFile;
    if (payload.version !== SAVE_VERSION || !payload.world) return undefined;
    restoreIdCounter(payload.idCounter, payload.world);
    return payload.world;
  } catch (err) {
    console.warn("Project Orbis: failed to load world", err);
    return undefined;
  }
}

export function clearSavedWorld(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Serialize a world to a pretty JSON string for download/sharing. */
export function exportWorldJson(world: WorldState): string {
  const payload: SaveFile = {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    idCounter: currentIdCounter(),
    world,
  };
  return JSON.stringify(payload, null, 2);
}

/** Parse an exported JSON string back into a world, restoring id state. */
export function importWorldJson(json: string): WorldState {
  const payload = JSON.parse(json) as SaveFile;
  if (!payload.world) throw new Error("Invalid Orbis save: missing world");
  restoreIdCounter(payload.idCounter ?? 0, payload.world);
  return payload.world;
}

/**
 * After loading, make sure new ids won't collide with loaded ones. We advance
 * the counter past whatever the save recorded (and past any id we can see).
 */
function restoreIdCounter(saved: number, world: WorldState): void {
  let max = saved;
  for (const tile of world.tiles) {
    max = Math.max(max, parseSuffix(tile.id));
  }
  for (const event of world.events) {
    max = Math.max(max, parseSuffix(event.id));
  }
  if (currentIdCounter() < max) seedIdCounter(max);
}

function parseSuffix(id: string): number {
  const part = id.split("_")[1];
  if (!part) return 0;
  const n = parseInt(part, 36);
  return Number.isFinite(n) ? n : 0;
}
