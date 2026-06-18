import { useSyncExternalStore } from "react";
import { gameStore } from "./gameStore";

/** Subscribe a component to the game store; re-renders on any state change. */
export function useGame() {
  const state = useSyncExternalStore(gameStore.subscribe, gameStore.getState);
  return { state, store: gameStore };
}
