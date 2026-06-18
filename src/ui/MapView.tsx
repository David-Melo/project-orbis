import { useMemo } from "react";
import { useGame } from "../state/useGame";
import { TERRAIN_LABEL } from "../engine/components";
import { buildTileScene } from "./scene";
import { SvgScene } from "./SvgScene";

/**
 * MapView lays out the map: a backend-agnostic tile SCENE (built from state in
 * scene.ts) painted by a renderer backend (SvgScene today), with a transparent
 * button grid on top for clicks and selection. The scene is the swap point — a
 * future Canvas/Pixi backend consumes the same scene without touching this file
 * beyond the one `<SvgScene>` line. The interaction overlay is backend-agnostic
 * (plain DOM), so it stays put regardless of how the terrain is drawn.
 */
export function MapView() {
  const { state, store } = useGame();
  const { world } = state;
  const { width: W, height: H } = world;
  const elevationMode = state.viewMode === "elevation";

  // Rebuild only when the world actually changes (a recorded move, a resize, or
  // a new/imported world) — not on selection/hover, so the terrain isn't
  // repainted when you merely click around. Memoizing the element keeps the
  // SvgScene subtree referentially stable so React skips it on those renders.
  const terrain = useMemo(
    () => <SvgScene className="map-terrain" scene={buildTileScene(world, elevationMode)} />,
    [world, world.events.length, world.tiles.length, elevationMode],
  );

  return (
    <div className="map-view">
      <div className="map-stage" style={{ aspectRatio: `${W} / ${H}` }}>
        {terrain}
        <div
          className="map-interact"
          style={{
            gridTemplateColumns: `repeat(${W}, 1fr)`,
            gridTemplateRows: `repeat(${H}, 1fr)`,
          }}
        >
          {world.tiles.map((tile) => {
            const { x, y } = tile.position;
            const assigned = tile.id === world.assignedTileId;
            const inspected = tile.id === state.inspectedTileId;
            const className = [
              "icell",
              assigned ? "icell--assigned" : "",
              inspected ? "icell--inspected" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={tile.id}
                type="button"
                className={className}
                title={`(${x}, ${y}) ${TERRAIN_LABEL[tile.terrain.kind]} · elev ${tile.elevation.value}`}
                onClick={() => store.handleTileClick(tile.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
