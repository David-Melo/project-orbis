import type { GeneratedCard, TileContext } from "../engine/card";
import type { TileEntity } from "../engine/components";
import type { WorldState } from "../engine/world";
import { getTile } from "../engine/world";
import { generateWorld } from "../systems/worldGeneration";
import { assignFrontierTile, isEligibleTile } from "../systems/frontierAssignment";
import { analyzeContext } from "../systems/contextAnalysis";
import { generateCards } from "../systems/cardGeneration";
import { checkAllRequirements } from "../systems/requirementValidation";
import { applyEffects } from "../systems/effectApplication";
import { recordEvent } from "../systems/history";
import {
  clearSavedWorld,
  exportWorldJson,
  importWorldJson,
  loadWorld,
  saveWorld,
} from "../persistence/storage";
import { Rng, hashSeed } from "../engine/rng";

export type Phase = "idle" | "choosing";

export type GameState = {
  world: WorldState;
  phase: Phase;
  hand: GeneratedCard[];
  context?: TileContext;
  selectedCardId?: string;
  inspectedTileId?: string;
  message: string;
};

type Listener = () => void;

/**
 * Vanilla observable store that owns the single WorldState and drives the
 * core loop by calling the systems in order. React subscribes via
 * useSyncExternalStore. The store always replaces `state` with a new object
 * (and clones the world reference) so React re-renders, even though the
 * systems mutate the world in place.
 */
export class GameStore {
  private state: GameState;
  private listeners = new Set<Listener>();

  constructor() {
    const loaded = loadWorld();
    const world = loaded ?? generateWorld(defaultSeed());
    this.state = {
      world,
      phase: "idle",
      hand: [],
      message: loaded
        ? "Loaded saved world. Press Start Day to continue."
        : "New world created. Press Start Day to grow it.",
    };
    if (!loaded) saveWorld(world);
  }

  getState = (): GameState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<GameState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  private persist(): void {
    saveWorld(this.state.world);
  }

  /** Random daily ritual: pick a lively/eligible tile and deal its hand. */
  startDay = (): void => {
    if (this.state.phase === "choosing") return;
    const tile = assignFrontierTile(this.state.world);
    if (!tile) {
      this.set({ message: "No assignable tiles available. Reset or edit the world." });
      return;
    }
    this.beginSession(tile.id);
  };

  /**
   * Begin a session on a specific tile (random or player-chosen). Advances the
   * day, analyzes context and deals the hand. On a barren tile it rolls the
   * day back so days only count when a future is actually offered.
   */
  private beginSession(tileId: string): void {
    const world = this.state.world;
    const tile = getTile(world, tileId);
    if (!tile) return;

    world.currentDay += 1;
    world.assignedTileId = tile.id;
    const context = analyzeContext(world, tile);
    const hand = generateCards(world, context);

    if (hand.length === 0) {
      world.currentDay -= 1;
      world.assignedTileId = undefined;
      this.persist();
      this.set({
        message: `Tile (${tile.position.x}, ${tile.position.y}) offered no plausible futures.`,
      });
      return;
    }

    // Default-select a random card so a second Space is a quick random move.
    const rng = new Rng(world.seed);
    rng.setState(world.rngState);
    const defaultCard = rng.pick(hand);
    world.rngState = rng.getState();

    this.persist();
    this.set({
      phase: "choosing",
      hand,
      context,
      selectedCardId: defaultCard.id,
      inspectedTileId: tile.id,
      message: `Day ${world.currentDay}: tile (${tile.position.x}, ${tile.position.y}) [${tile.terrain.kind}] offers ${hand.length} futures.`,
    });
  }

  /** Player-driven: click a tile to act on it directly (when idle). */
  handleTileClick = (tileId: string): void => {
    this.inspectTile(tileId);
    if (this.state.phase !== "idle") return;

    const tile = getTile(this.state.world, tileId);
    if (!tile || !isEligibleTile(this.state.world, tile)) {
      this.set({
        message: tile
          ? `(${tile.position.x}, ${tile.position.y}) [${tile.terrain.kind}] offers no actions right now.`
          : this.state.message,
      });
      return;
    }
    this.beginSession(tileId);
  };

  selectCard = (cardId: string): void => {
    if (this.state.phase !== "choosing") return;
    this.set({ selectedCardId: cardId });
  };

  /** Step 6-10: validate, apply, record, persist. */
  confirmCard = (): void => {
    const { world, hand, selectedCardId, context } = this.state;
    if (this.state.phase !== "choosing" || !selectedCardId || !context) return;

    const card = hand.find((c) => c.id === selectedCardId);
    const tile = getTile(world, card?.targetTileId ?? "");
    if (!card || !tile) {
      this.set({ message: "Selected card is no longer valid." });
      return;
    }

    if (!checkAllRequirements(card.requirements, context, world)) {
      this.set({ message: "Card requirements no longer met. Pick another." });
      return;
    }

    const applied = applyEffects(world, tile, card.effects);
    recordEvent(world, tile, card, applied);
    world.assignedTileId = undefined;
    this.persist();

    this.set({
      phase: "idle",
      hand: [],
      context: undefined,
      selectedCardId: undefined,
      inspectedTileId: tile.id,
      message: `${card.title} resolved at (${tile.position.x}, ${tile.position.y}). The world is permanently different.`,
    });
  };

  cancelDay = (): void => {
    if (this.state.phase !== "choosing") return;
    // No action was taken, so give the day back.
    this.state.world.currentDay = Math.max(0, this.state.world.currentDay - 1);
    this.state.world.assignedTileId = undefined;
    this.persist();
    this.set({
      phase: "idle",
      hand: [],
      context: undefined,
      selectedCardId: undefined,
      message: "Day cancelled. The assigned tile was left untouched.",
    });
  };

  inspectTile = (tileId: string): void => {
    this.set({ inspectedTileId: tileId });
  };

  newWorld = (seedInput?: string): void => {
    const seed = seedInput && seedInput.trim() ? hashSeed(seedInput.trim()) : defaultSeed();
    const world = generateWorld(seed);
    saveWorld(world);
    this.set({
      world,
      phase: "idle",
      hand: [],
      context: undefined,
      selectedCardId: undefined,
      inspectedTileId: undefined,
      message: `New world created (seed ${seed >>> 0}). Press Start Day.`,
    });
  };

  resetWorld = (): void => {
    clearSavedWorld();
    this.newWorld();
    this.set({ message: "World reset." });
  };

  exportJson = (): string => exportWorldJson(this.state.world);

  importJson = (json: string): void => {
    try {
      const world = importWorldJson(json);
      saveWorld(world);
      this.set({
        world,
        phase: "idle",
        hand: [],
        context: undefined,
        selectedCardId: undefined,
        inspectedTileId: undefined,
        message: "World imported from JSON.",
      });
    } catch (err) {
      this.set({ message: `Import failed: ${(err as Error).message}` });
    }
  };

  getInspectedTile = (): TileEntity | undefined => {
    if (!this.state.inspectedTileId) return undefined;
    return getTile(this.state.world, this.state.inspectedTileId);
  };
}

function defaultSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

export const gameStore = new GameStore();
