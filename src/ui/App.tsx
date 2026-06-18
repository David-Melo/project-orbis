import { useEffect } from "react";
import { useGame } from "../state/useGame";
import { gameStore } from "../state/gameStore";
import { MapView } from "./MapView";
import { SessionDock } from "./SessionDock";
import { TileInspector } from "./TileInspector";
import { HistoryLog } from "./HistoryLog";
import { DevControls } from "./DevControls";

export function App() {
  const { state } = useGame();
  useKeyboardShortcuts();

  return (
    <div className="app">
      <header className="app__header">
        <h1>Project Orbis</h1>
        <span className="version">v0.0.1 · primordial</span>
        <span className="day-badge">Day {state.world.currentDay}</span>
        <p className="status-line">{state.message}</p>
      </header>

      <div className="app__body">
        <aside className="app__left">
          <DevControls />
          <HistoryLog />
        </aside>

        <div className="app__center">
          <MapView />
          <Legend />
        </div>

        <aside className="app__right">
          <TileInspector />
        </aside>
      </div>

      <footer className="app__dock">
        <SessionDock />
      </footer>
    </div>
  );
}

/**
 * Global keyboard shortcuts for fast manual testing:
 *   Space / S → Start Day (when idle)
 *   1..9      → select the Nth card in the hand
 *   Enter     → confirm (auto-picks the first card if none selected)
 *   Esc       → cancel the day
 * Reads store state live in the handler to avoid stale closures, and ignores
 * keystrokes while typing in an input.
 */
function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      const { phase, hand, selectedCardId } = gameStore.getState();

      if (phase === "idle") {
        if (e.key === " " || e.key.toLowerCase() === "s" || e.key === "Enter") {
          gameStore.startDay();
          e.preventDefault();
        }
        return;
      }

      // phase === "choosing"
      if (e.key >= "1" && e.key <= "9") {
        const idx = Number(e.key) - 1;
        if (hand[idx]) {
          gameStore.selectCard(hand[idx].id);
          e.preventDefault();
        }
      } else if (e.key === " " || e.key === "Enter") {
        // Space (or Enter) confirms — auto-picking the first card if none is
        // selected — so the loop is Space, number, Space, Space…
        if (!selectedCardId && hand[0]) gameStore.selectCard(hand[0].id);
        gameStore.confirmCard();
        e.preventDefault();
      } else if (e.key === "Escape") {
        gameStore.cancelDay();
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

function Legend() {
  const items: Array<[string, string]> = [
    [".", "empty"],
    ["~", "ocean"],
    ["=", "coast"],
    ["/", "cliff"],
    ["_", "plain"],
    ["n", "hill"],
    ["^", "mountain"],
    ["V", "volcano"],
    ["*", "lava"],
    ["#", "basalt"],
    ["|", "river"],
    ["O", "lake"],
    [",", "wetland"],
    ["I", "ice"],
  ];
  return (
    <div className="legend">
      {items.map(([glyph, label]) => (
        <span key={label} className="legend__item">
          <code>{glyph}</code> {label}
        </span>
      ))}
    </div>
  );
}
