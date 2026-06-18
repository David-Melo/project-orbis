import { memo } from "react";
import { RIVER_LINE } from "./tilegraphics";

export type Corner = { cut: boolean; color: string };
export type RiverDir = "n" | "e" | "s" | "w";

export type SvgTileProps = {
  /** Visual signature — everything that affects the drawing. Used for memo. */
  sig: string;
  base: string;
  glyph: string;
  /** Corner cuts in order NE, SE, SW, NW. */
  corners: [Corner, Corner, Corner, Corner];
  river: RiverDir[];
};

const C = 14; // corner-cut size (of 32)
const CORNER_POINTS = [
  `${32 - C},0 32,0 32,${C}`, // NE
  `32,${32 - C} 32,32 ${32 - C},32`, // SE
  `0,${32 - C} 0,32 ${C},32`, // SW
  `0,0 ${C},0 0,${C}`, // NW
];
const PORT: Record<RiverDir, [number, number]> = {
  n: [16, 0],
  e: [32, 16],
  s: [16, 32],
  w: [0, 16],
};

/**
 * One map tile drawn as procedural SVG: a base fill, diagonal corner cuts that
 * reveal lower neighboring terrain (so coastlines and boundaries are diagonal,
 * not square), an optional connected river line, and a faint terrain glyph.
 * Memoized on `sig` so only tiles whose look changed re-render.
 */
function SvgTileImpl({ base, glyph, corners, river }: SvgTileProps) {
  const riverPath =
    river.length === 2
      ? `M ${PORT[river[0]][0]} ${PORT[river[0]][1]} Q 16 16 ${PORT[river[1]][0]} ${PORT[river[1]][1]}`
      : null;

  return (
    <svg viewBox="0 0 32 32" className="svgtile" shapeRendering="geometricPrecision">
      <rect width="32" height="32" fill={base} />
      {corners.map((c, i) =>
        c.cut ? <polygon key={i} points={CORNER_POINTS[i]} fill={c.color} /> : null,
      )}
      {glyph && (
        <text x="16" y="21" textAnchor="middle" fontSize="11" fill="rgba(0,0,0,0.32)">
          {glyph}
        </text>
      )}
      {river.length > 0 &&
        (riverPath ? (
          <path d={riverPath} fill="none" stroke={RIVER_LINE} strokeWidth="5" strokeLinecap="round" />
        ) : (
          river.map((d) => (
            <line
              key={d}
              x1="16"
              y1="16"
              x2={PORT[d][0]}
              y2={PORT[d][1]}
              stroke={RIVER_LINE}
              strokeWidth="5"
              strokeLinecap="round"
            />
          ))
        ))}
      {river.length > 0 && <circle cx="16" cy="16" r="2.6" fill={RIVER_LINE} />}
    </svg>
  );
}

export const SvgTile = memo(SvgTileImpl, (a, b) => a.sig === b.sig);
