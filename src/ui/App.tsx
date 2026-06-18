import { useGame } from "../state/useGame";
import { MapView } from "./MapView";
import { SessionPanel } from "./SessionPanel";
import { TileInspector } from "./TileInspector";
import { HistoryLog } from "./HistoryLog";
import { DevControls } from "./DevControls";

export function App() {
  const { state } = useGame();

  return (
    <div className="app">
      <header className="app__header">
        <h1>Project Orbis</h1>
        <span className="version">v0.0.1 · primordial</span>
        <p className="status-line">{state.message}</p>
      </header>

      <main className="app__main">
        <div className="app__map">
          <MapView />
          <Legend />
        </div>

        <aside className="app__side">
          <SessionPanel />
          <TileInspector />
          <DevControls />
          <HistoryLog />
        </aside>
      </main>
    </div>
  );
}

function Legend() {
  const items: Array<[string, string]> = [
    [".", "empty"],
    ["~", "ocean"],
    ["=", "coast"],
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
