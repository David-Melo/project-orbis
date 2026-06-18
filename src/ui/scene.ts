import {
  TERRAIN_COLOR,
  TERRAIN_GLYPH,
  type TileEntity,
} from "../engine/components";
import { getTileAt, type WorldState } from "../engine/world";
import { baseColor, terrainLayer, RIVER_LINE, WATER_CONNECT } from "./tilegraphics";
import { cellShapes, type CornerSample } from "./dualGrid";

/**
 * Backend-agnostic tile scene.
 *
 * `buildTileScene` turns world state into an ordered list of flat drawing
 * primitives in viewBox units (UNIT per tile) — no SVG, no React, no Canvas.
 * A renderer backend (today `SvgScene`, tomorrow a Canvas/Pixi one) consumes
 * the SAME scene, so swapping the draw target never touches the geometry that
 * is derived from state. This is the "state is the source of truth" boundary:
 * everything visual is computed here once and merely painted downstream.
 */

export const UNIT = 32; // viewBox units per tile

export type ScenePrim =
  | { t: "rect"; x: number; y: number; w: number; h: number; fill: string; crisp?: boolean }
  | {
      t: "poly";
      pts: ReadonlyArray<readonly [number, number]>;
      fill: string;
      stroke?: string;
      strokeWidth?: number;
    }
  | { t: "path"; d: string; stroke: string; strokeWidth: number }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; strokeWidth: number }
  | { t: "circle"; cx: number; cy: number; r: number; fill: string }
  | { t: "text"; x: number; y: number; s: string; fill: string; size: number };

export type TileScene = {
  /** viewBox extent in units. */
  vbWidth: number;
  vbHeight: number;
  prims: ScenePrim[];
};

/** Any component that paints a TileScene at a given pixel size is a renderer backend. */
export type TileRendererProps = {
  scene: TileScene;
  className?: string;
};

/** Sample a world tile (or off-map background) into a dual-grid corner. */
function sample(tile: TileEntity | undefined, elevationMode: boolean): CornerSample {
  if (!tile) return { layer: -1, color: TERRAIN_COLOR.void };
  return { layer: terrainLayer(tile.terrain.kind), color: baseColor(tile, elevationMode) };
}

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

/**
 * Build the full draw list for the world: dual-grid terrain (base + diagonal
 * transition bands), rivers as port-to-port paths, then faint glyphs — in paint
 * order, low to high.
 */
export function buildTileScene(world: WorldState, elevationMode: boolean): TileScene {
  const { width: W, height: H } = world;
  const U = UNIT;
  const prims: ScenePrim[] = [];

  // Background where nothing is drawn (early game, off-map overhang).
  prims.push({ t: "rect", x: 0, y: 0, w: W * U, h: H * U, fill: TERRAIN_COLOR.empty });

  const cell = (i: number, j: number) => sample(getTileAt(world, i, j), elevationMode);

  // Dual grid: each display cell straddles the corner where 4 world tiles meet.
  for (let j = 0; j <= H; j++) {
    for (let i = 0; i <= W; i++) {
      const nw = cell(i - 1, j - 1);
      const ne = cell(i, j - 1);
      const sw = cell(i - 1, j);
      const se = cell(i, j);
      if (nw.layer < 0 && ne.layer < 0 && se.layer < 0 && sw.layer < 0) continue;
      const ox = (i - 0.5) * U;
      const oy = (j - 0.5) * U;
      const [base, ...bands] = cellShapes(nw, ne, se, sw);
      // Base as a pixel-snapped rect so adjacent cells tile with no AA seam.
      prims.push({ t: "rect", x: ox, y: oy, w: U, h: U, fill: base.color, crisp: true });
      // Diagonal transition bands, stroked in their own color to close cracks.
      for (const s of bands) {
        prims.push({
          t: "poly",
          fill: s.color,
          stroke: s.color,
          strokeWidth: 1,
          pts: s.points.map(([lx, ly]) => [ox + lx * U, oy + ly * U] as const),
        });
      }
    }
  }

  // Rivers: linear features over the terrain (Carcassonne road model).
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
      prims.push({
        t: "path",
        d: `M ${a[0]} ${a[1]} Q ${cx} ${cy} ${b[0]} ${b[1]}`,
        stroke: RIVER_LINE,
        strokeWidth: 5,
      });
    } else {
      for (const d of dirs) {
        const p = port[d];
        prims.push({ t: "line", x1: cx, y1: cy, x2: p[0], y2: p[1], stroke: RIVER_LINE, strokeWidth: 5 });
      }
      prims.push({ t: "circle", cx, cy, r: 2.6, fill: RIVER_LINE });
    }
  }

  // Faint terrain glyphs so the map stays readable at small tile sizes.
  for (const t of world.tiles) {
    const k = t.terrain.kind;
    if (k === "empty" || k === "void" || k === "river") continue;
    prims.push({
      t: "text",
      x: (t.position.x + 0.5) * U,
      y: (t.position.y + 0.5) * U + 4,
      s: TERRAIN_GLYPH[k],
      fill: "rgba(0,0,0,0.3)",
      size: 11,
    });
  }

  return { vbWidth: W * U, vbHeight: H * U, prims };
}
