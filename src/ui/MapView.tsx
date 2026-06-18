import { useGame } from "../state/useGame";
import {
  TERRAIN_COLOR,
  TERRAIN_GLYPH,
  TERRAIN_LABEL,
} from "../engine/components";

/**
 * MapView renders the 32x32 grid as colored, glyph-labelled cells. Colors and
 * glyphs are derived entirely from each tile's terrain component — the
 * renderer is not the source of truth. The assigned tile gets a gold ring;
 * the inspected tile gets a white ring.
 */
export function MapView() {
  const { state, store } = useGame();
  const { world } = state;

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
              style={{ background: TERRAIN_COLOR[tile.terrain.kind] }}
              title={`(${tile.position.x}, ${tile.position.y}) ${TERRAIN_LABEL[tile.terrain.kind]}`}
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
