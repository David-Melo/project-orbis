import { memo } from "react";
import { useGame } from "../state/useGame";
import {
  TERRAIN_COLOR,
  TERRAIN_GLYPH,
  TERRAIN_LABEL,
  type TileEntity,
} from "../engine/components";
import { getTileAt } from "../engine/world";
import type { WorldState } from "../engine/world";
import { baseColor, terrainLayer, RIVER_LINE, WATER_CONNECT } from "./tilegraphics";
import { cellShapes, type CornerSample } from "./dualGrid";

const U = 32; // viewBox units per tile

/** Sample a world tile (or off-map background) into a dual-grid corner. */
function sample(tile: TileEntity | undefined, elevationMode: boolean): CornerSample {
  if (!tile) return { layer: -1, color: TERRAIN_COLOR.void };
  return { layer: terrainLayer(tile.terrain.kind), color: baseColor(tile, elevationMode) };
}

/**
 * One display cell of the dual grid, centered on the corner shared by its 4
 * world tiles. Memoized on a signature of those corners so only cells touching a
 * changed tile re-render.
 */
const DualCell = memo(function DualCell({
  i,
  j,
  nw,
  ne,
  se,
  sw,
}: {
  i: number;
  j: number;
  nw: CornerSample;
  ne: CornerSample;
  se: CornerSample;
  sw: CornerSample;
}) {
  // Off-map / empty everywhere → background shows through; nothing to draw.
  if (nw.layer < 0 && ne.layer < 0 && se.layer < 0 && sw.layer < 0) return null;
  const ox = (i - 0.5) * U;
  const oy = (j - 0.5) * U;
  const shapes = cellShapes(nw, ne, se, sw);
  return (
    <>
      {shapes.map((s, k) => (
        <polygon
          key={k}
          fill={s.color}
          stroke={s.color}
          strokeWidth={1}
          strokeLinejoin="round"
          points={s.points.map(([lx, ly]) => `${ox + lx * U},${oy + ly * U}`).join(" ")}
        />
      ))}
    </>
  );
});

/** Directions a river tile connects toward: adjacent water + stored flow dirs. */
function riverDirs(world: WorldState, tile: TileEntity): Array<"n" | "e" | "s" | "w"> {
  const { x, y } = tile.position;
  const flows = new Set(
    tile.traits.traits.filter((t) => t.startsWith("flows-")).map((t) => t.slice(6)),
  );
  const dirs: Array<["n" | "e" | "s" | "w", TileEntity | undefined]> = [
    ["n", getTileAt(world, x, y - 1)],
    ["e", getTileAt(world, x + 1, y)],
    ["s", getTileAt(world, x, y + 1)],
    ["w", getTileAt(world, x - 1, y)],
  ];
  return dirs
    .filter(([d, n]) => (n && WATER_CONNECT.has(n.terrain.kind)) || flows.has(d))
    .map(([d]) => d);
}

/** Rivers as port-to-port linear features drawn over the terrain (the Carcassonne road model). */
const RiverLayer = memo(function RiverLayer({ world }: { world: WorldState }) {
  const paths: React.ReactNode[] = [];
  for (const tile of world.tiles) {
    if (tile.terrain.kind !== "river") continue;
    const dirs = riverDirs(world, tile);
    if (dirs.length === 0) continue;
    const { x, y } = tile.position;
    const cx = (x + 0.5) * U;
    const cy = (y + 0.5) * U;
    const port: Record<string, [number, number]> = {
      n: [cx, y * U],
      e: [(x + 1) * U, cy],
      s: [cx, (y + 1) * U],
      w: [x * U, cy],
    };
    if (dirs.length === 2) {
      const a = port[dirs[0]];
      const b = port[dirs[1]];
      paths.push(
        <path
          key={tile.id}
          d={`M ${a[0]} ${a[1]} Q ${cx} ${cy} ${b[0]} ${b[1]}`}
          fill="none"
          stroke={RIVER_LINE}
          strokeWidth={5}
          strokeLinecap="round"
        />,
      );
    } else {
      for (const d of dirs) {
        const p = port[d];
        paths.push(
          <line
            key={`${tile.id}-${d}`}
            x1={cx}
            y1={cy}
            x2={p[0]}
            y2={p[1]}
            stroke={RIVER_LINE}
            strokeWidth={5}
            strokeLinecap="round"
          />,
        );
      }
      paths.push(<circle key={`${tile.id}-c`} cx={cx} cy={cy} r={2.6} fill={RIVER_LINE} />);
    }
  }
  return <g>{paths}</g>;
});

/** Faint terrain glyphs so the map stays readable at small tile sizes. */
const GlyphLayer = memo(function GlyphLayer({ world }: { world: WorldState }) {
  return (
    <g fill="rgba(0,0,0,0.3)" fontSize={11} textAnchor="middle">
      {world.tiles.map((t) => {
        const k = t.terrain.kind;
        if (k === "empty" || k === "void" || k === "river") return null;
        return (
          <text key={t.id} x={(t.position.x + 0.5) * U} y={(t.position.y + 0.5) * U + 4}>
            {TERRAIN_GLYPH[k]}
          </text>
        );
      })}
    </g>
  );
});

/**
 * MapView renders the grid with dual-grid corner autotiling: terrain is drawn on
 * a half-tile-offset display grid so coastlines and terrain bands come out
 * diagonal/curved, rivers ride over it as port-to-port paths, and a transparent
 * button overlay handles clicks and selection. Everything is derived from tile
 * state — the renderer is not the source of truth.
 */
export function MapView() {
  const { state, store } = useGame();
  const { world } = state;
  const { width: W, height: H } = world;
  const elevationMode = state.viewMode === "elevation";

  // Pre-sample every world corner once; off-map reads as background.
  const cell = (i: number, j: number): CornerSample =>
    sample(getTileAt(world, i, j), elevationMode);

  const cells: React.ReactNode[] = [];
  for (let j = 0; j <= H; j++) {
    for (let i = 0; i <= W; i++) {
      const nw = cell(i - 1, j - 1);
      const ne = cell(i, j - 1);
      const sw = cell(i - 1, j);
      const se = cell(i, j);
      cells.push(<DualCell key={`${i},${j}`} i={i} j={j} nw={nw} ne={ne} se={se} sw={sw} />);
    }
  }

  return (
    <div className="map-view">
      <div className="map-stage" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg
          className="map-terrain"
          viewBox={`0 0 ${W * U} ${H * U}`}
          width="100%"
          height="100%"
          shapeRendering="geometricPrecision"
        >
          <rect width={W * U} height={H * U} fill={TERRAIN_COLOR.empty} />
          {cells}
          <RiverLayer world={world} />
          <GlyphLayer world={world} />
        </svg>
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
