/**
 * Dual-grid corner autotiling (the production technique for diagonal/organic
 * tile boundaries). Instead of drawing one fill per world tile, we draw a
 * display grid offset by half a tile: every display cell straddles the point
 * where FOUR world tiles meet at a shared corner. Reading those 4 corners gives
 * a 4-bit marching-squares index (16 cases) whose contour cuts corner-to-corner
 * — so coastlines and terrain bands come out diagonal/curved, derived from
 * state, with no authored art.
 *
 * Multi-layer terrain (ocean < coast < plain < hill < peak) is rendered as a
 * stack of binary marching-squares passes, low layer to high: fill the whole
 * cell with the lowest corner's color, then for each higher layer present draw
 * the "this layer and above" region with that band's color on top. The result
 * is nested isobands — each sub-region shows the color of the highest terrain
 * that reaches it.
 */

/** A point in a display cell's local space, where (0,0)=NW and (1,1)=SE. */
type Pt = readonly [number, number];

// Corner + edge-midpoint anchors in local 0..1 space.
const NW: Pt = [0, 0];
const NE: Pt = [1, 0];
const SE: Pt = [1, 1];
const SW: Pt = [0, 1];
const TOP: Pt = [0.5, 0]; // NW–NE edge
const RIGHT: Pt = [1, 0.5]; // NE–SE edge
const BOTTOM: Pt = [0.5, 1]; // SE–SW edge
const LEFT: Pt = [0, 0.5]; // SW–NW edge

/**
 * Marching-squares lookup: mask bit NW=8, NE=4, SE=2, SW=1 → the polygon(s) of
 * the region that is "in" (at/above the threshold). The two saddle cases (5, 10)
 * yield two opposite triangles.
 */
export const MS_CASES: ReadonlyArray<ReadonlyArray<ReadonlyArray<Pt>>> = [
  [], // 0000 — empty
  [[SW, BOTTOM, LEFT]], // 0001 SW
  [[RIGHT, SE, BOTTOM]], // 0010 SE
  [[LEFT, RIGHT, SE, SW]], // 0011 S band
  [[TOP, NE, RIGHT]], // 0100 NE
  [[TOP, NE, RIGHT], [SW, BOTTOM, LEFT]], // 0101 saddle NE+SW
  [[TOP, NE, SE, BOTTOM]], // 0110 E band
  [[TOP, NE, SE, SW, LEFT]], // 0111 all but NW
  [[NW, TOP, LEFT]], // 1000 NW
  [[NW, TOP, BOTTOM, SW]], // 1001 W band
  [[NW, TOP, LEFT], [RIGHT, SE, BOTTOM]], // 1010 saddle NW+SE
  [[NW, TOP, RIGHT, SE, SW]], // 1011 all but NE
  [[NW, NE, RIGHT, LEFT]], // 1100 N band
  [[NW, NE, RIGHT, BOTTOM, SW]], // 1101 all but SE
  [[NW, NE, SE, BOTTOM, LEFT]], // 1110 all but SW
  [[NW, NE, SE, SW]], // 1111 full
];

/** One corner sample of a display cell. */
export type CornerSample = { layer: number; color: string };

/** A polygon to draw for a display cell: fill color + local-space points. */
export type CellShape = { color: string; points: ReadonlyArray<Pt> };

/**
 * Build the draw list for a display cell from its 4 corner samples
 * (NW, NE, SE, SW). Returns back-to-front shapes in local 0..1 coords.
 */
export function cellShapes(
  nw: CornerSample,
  ne: CornerSample,
  se: CornerSample,
  sw: CornerSample,
): CellShape[] {
  const corners = [nw, ne, se, sw];
  // Distinct layers present, ascending.
  const layers = [...new Set(corners.map((c) => c.layer))].sort((a, b) => a - b);
  const colorAt = (layer: number) => corners.find((c) => c.layer === layer)!.color;

  // Base fill = the lowest corner's color across the whole cell.
  const shapes: CellShape[] = [{ color: colorAt(layers[0]), points: MS_CASES[15][0] }];

  // Each higher layer paints its "this-or-above" isoband on top.
  for (let li = 1; li < layers.length; li++) {
    const v = layers[li];
    const mask =
      (nw.layer >= v ? 8 : 0) |
      (ne.layer >= v ? 4 : 0) |
      (se.layer >= v ? 2 : 0) |
      (sw.layer >= v ? 1 : 0);
    const color = colorAt(v);
    for (const poly of MS_CASES[mask]) shapes.push({ color, points: poly });
  }
  return shapes;
}
