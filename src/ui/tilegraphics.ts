import {
  ELEVATION_COLORS,
  TERRAIN_COLOR,
  type TerrainKind,
  type TileEntity,
} from "../engine/components";

/**
 * Visual "stacking height" per terrain, used for corner blending: a tile cuts a
 * diagonal corner wherever it sits ABOVE its neighbors, revealing the lower
 * terrain beneath. Water is low, land rises, peaks are highest. Empty/void are
 * the background (lowest), so coastlines and islands get diagonal silhouettes.
 */
const BLEND_HEIGHT: Record<TerrainKind, number> = {
  void: -1,
  empty: -1,
  ocean: 0,
  lake: 1,
  river: 1,
  wetland: 1,
  ice: 2,
  coast: 2,
  plain: 3,
  basalt: 3,
  lava: 3,
  cliff: 4,
  hill: 4,
  mountain: 5,
  volcano: 5,
};

export function blendHeight(kind: TerrainKind): number {
  return BLEND_HEIGHT[kind] ?? 0;
}

/** Muted bank color a river tile rests on, so the river reads as a thin line. */
const RIVERBANK = "#5e7245";
export const RIVER_LINE = "#3f86c4";

/** Terrains a river visually connects to (so the line joins up across tiles). */
export const WATER_CONNECT: ReadonlySet<TerrainKind> = new Set<TerrainKind>([
  "river",
  "lake",
  "ocean",
  "coast",
  "wetland",
]);

const clampE = (v: number) => Math.max(0, Math.min(10, v));

/** Darken/brighten a hex color by elevation so the grid reads as a heightmap. */
export function shadeByElevation(hex: string, elevation: number): string {
  const factor = 0.7 + (clampE(elevation) / 10) * 0.55; // 0.70 .. 1.25
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((n & 255) * factor));
  return `rgb(${r}, ${g}, ${b})`;
}

/** The base fill for a tile, honoring the elevation-heatmap view and river banks. */
export function baseColor(tile: TileEntity, elevationMode: boolean): string {
  const k = tile.terrain.kind;
  if (k === "empty" || k === "void") return TERRAIN_COLOR[k];
  if (elevationMode) return ELEVATION_COLORS[clampE(tile.elevation.value)];
  if (k === "river") return shadeByElevation(RIVERBANK, tile.elevation.value);
  return shadeByElevation(TERRAIN_COLOR[k], tile.elevation.value);
}
