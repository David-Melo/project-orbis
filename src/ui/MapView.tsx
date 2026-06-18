import { useGame } from "../state/useGame";
import {
  ELEVATION_COLORS,
  TERRAIN_COLOR,
  TERRAIN_GLYPH,
  TERRAIN_LABEL,
} from "../engine/components";

/** Tile background for the current view mode (terrain shading or heightmap). */
function tileColor(kind: keyof typeof TERRAIN_COLOR, elevation: number, elevationMode: boolean): string {
  if (kind === "empty" || kind === "void") return TERRAIN_COLOR[kind];
  if (elevationMode) return ELEVATION_COLORS[Math.max(0, Math.min(10, elevation))];
  return shadeByElevation(TERRAIN_COLOR[kind], elevation);
}

/**
 * Shade a terrain color by elevation so the grid reads as a heightmap: low
 * ground (and deep water) is darker, high ground brighter. Elevation is a
 * component on every tile, so this is just another view derived from state.
 */
function shadeByElevation(hex: string, elevation: number): string {
  const e = Math.max(0, Math.min(10, elevation));
  const factor = 0.7 + (e / 10) * 0.55; // 0.70 (lowest) .. 1.25 (highest)
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((n & 255) * factor));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * MapView renders the 32x32 grid as colored, glyph-labelled cells. Colors and
 * glyphs are derived entirely from each tile's terrain + elevation components —
 * the renderer is not the source of truth. The assigned tile gets a gold ring;
 * the inspected tile gets a white ring.
 */
export function MapView() {
  const { state, store } = useGame();
  const { world } = state;
  const elevationMode = state.viewMode === "elevation";

  return (
    <div className="map-view">
      <div
        className="map-grid"
        style={{
          gridTemplateColumns: `repeat(${world.width}, var(--tile))`,
          gridTemplateRows: `repeat(${world.height}, var(--tile))`,
        }}
      >
        {world.tiles.map((tile) => {
          const assigned = tile.id === world.assignedTileId;
          const inspected = tile.id === state.inspectedTileId;
          const className = [
            "tile",
            assigned ? "tile--assigned" : "",
            inspected ? "tile--inspected" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={tile.id}
              type="button"
              className={className}
              style={{ background: tileColor(tile.terrain.kind, tile.elevation.value, elevationMode) }}
              title={`(${tile.position.x}, ${tile.position.y}) ${TERRAIN_LABEL[tile.terrain.kind]} · elev ${tile.elevation.value}`}
              onClick={() => store.handleTileClick(tile.id)}
            >
              <span className="tile__glyph">{TERRAIN_GLYPH[tile.terrain.kind]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
