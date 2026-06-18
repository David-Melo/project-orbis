import { useGame } from "../state/useGame";
import {
  TERRAIN_COLOR,
  TERRAIN_GLYPH,
  TERRAIN_LABEL,
  type TileEntity,
} from "../engine/components";
import { getTileAt } from "../engine/world";
import type { WorldState } from "../engine/world";
import { baseColor, blendHeight, WATER_CONNECT } from "./tilegraphics";
import { SvgTile, type Corner, type RiverDir } from "./SvgTile";

/**
 * A corner cut between two orthogonal neighbors A and B: cut (diagonal) when
 * this tile stacks ABOVE both, revealing the lower neighbor's color — this is
 * what turns square coastlines and terrain boundaries into diagonals.
 */
function corner(
  self: TileEntity,
  a: TileEntity | undefined,
  b: TileEntity | undefined,
  elevationMode: boolean,
): Corner {
  const h = blendHeight(self.terrain.kind);
  const ha = a ? blendHeight(a.terrain.kind) : -1; // off-map = background
  const hb = b ? blendHeight(b.terrain.kind) : -1;
  if (h > ha && h > hb) {
    const lower = ha <= hb ? a : b;
    return { cut: true, color: lower ? baseColor(lower, elevationMode) : TERRAIN_COLOR.empty };
  }
  return { cut: false, color: "" };
}

function riverDirs(world: WorldState, tile: TileEntity): RiverDir[] {
  if (tile.terrain.kind !== "river") return [];
  const { x, y } = tile.position;
  // Connect to adjacent water, and to the stored flow direction (so a river
  // mouth/delta still draws even where it spills onto land).
  const flows = new Set(
    tile.traits.traits.filter((t) => t.startsWith("flows-")).map((t) => t.slice(6)),
  );
  const dirs: Array<[RiverDir, TileEntity | undefined]> = [
    ["n", getTileAt(world, x, y - 1)],
    ["e", getTileAt(world, x + 1, y)],
    ["s", getTileAt(world, x, y + 1)],
    ["w", getTileAt(world, x - 1, y)],
  ];
  return dirs
    .filter(([d, n]) => (n && WATER_CONNECT.has(n.terrain.kind)) || flows.has(d))
    .map(([d]) => d);
}

/**
 * MapView renders the grid as procedural SVG tiles whose edges blend with their
 * neighbors. Everything is still derived from tile state — terrain, elevation,
 * connections — so the renderer is not the source of truth.
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
          const { x, y } = tile.position;
          const n = getTileAt(world, x, y - 1);
          const e = getTileAt(world, x + 1, y);
          const s = getTileAt(world, x, y + 1);
          const w = getTileAt(world, x - 1, y);
          const corners: [Corner, Corner, Corner, Corner] = [
            corner(tile, n, e, elevationMode), // NE
            corner(tile, e, s, elevationMode), // SE
            corner(tile, s, w, elevationMode), // SW
            corner(tile, w, n, elevationMode), // NW
          ];
          const base = baseColor(tile, elevationMode);
          const glyph = tile.terrain.kind === "river" ? "" : TERRAIN_GLYPH[tile.terrain.kind];
          const river = riverDirs(world, tile);
          const sig = `${base}|${corners.map((c) => (c.cut ? c.color : "")).join(",")}|${river.join("")}|${glyph}`;

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
              title={`(${x}, ${y}) ${TERRAIN_LABEL[tile.terrain.kind]} · elev ${tile.elevation.value}`}
              onClick={() => store.handleTileClick(tile.id)}
            >
              <SvgTile sig={sig} base={base} glyph={glyph} corners={corners} river={river} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
