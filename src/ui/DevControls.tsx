import { useRef, useState } from "react";
import { useGame } from "../state/useGame";

/**
 * Dev Controls: generate/reset world, export/import JSON. Daily lockout is
 * intentionally absent — the prototype advances days manually so the loop can
 * be exercised freely.
 */
export function DevControls() {
  const { state, store } = useGame();
  const [seed, setSeed] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const json = store.exportJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orbis-world-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => store.importJson(String(reader.result));
    reader.readAsText(file);
  };

  return (
    <section className="panel dev-controls">
      <header className="panel__header">
        <h2>Dev Controls</h2>
      </header>

      <div className="view-toggle">
        <button
          className={`view-toggle__btn ${state.viewMode === "terrain" ? "is-active" : ""}`}
          onClick={() => store.setViewMode("terrain")}
        >
          Terrain
        </button>
        <button
          className={`view-toggle__btn ${state.viewMode === "elevation" ? "is-active" : ""}`}
          onClick={() => store.setViewMode("elevation")}
        >
          Elevation
        </button>
      </div>

      <div className="dev-row">
        <input
          className="seed-input"
          placeholder="seed (optional)"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
        />
        <button className="btn" onClick={() => store.newWorld(seed)}>
          New World
        </button>
      </div>

      <div className="dev-row">
        <button className="btn btn--danger" onClick={() => store.resetWorld()}>
          Reset World
        </button>
      </div>

      <label className="dev-toggle" title="When on, Start Day occasionally transforms an existing edge tile (uplift, erode, erupt, melt). When off, it only grows empty frontier tiles.">
        <input
          type="checkbox"
          checked={state.allowTransforms}
          onChange={(e) => store.setAllowTransforms(e.target.checked)}
        />
        <span>Transform existing tiles on Start Day</span>
      </label>

      <div className="dev-row">
        <button className="btn" onClick={handleExport}>
          Export JSON
        </button>
        <button className="btn" onClick={() => fileInput.current?.click()}>
          Import JSON
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImportFile(file);
            e.target.value = "";
          }}
        />
      </div>
    </section>
  );
}
