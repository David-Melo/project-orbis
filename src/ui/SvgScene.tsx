import { memo } from "react";
import type { ScenePrim, TileRendererProps } from "./scene";

/**
 * SVG renderer backend: paints a TileScene's primitives as SVG. It is the only
 * backend today; a Canvas/Pixi backend would implement the same
 * `TileRendererProps` contract and consume the identical scene, so the swap is
 * a draw-layer change, not a rewrite. Memoized on the scene object so it only
 * repaints when the scene is rebuilt (a move), not on selection changes.
 */
function prim(p: ScenePrim, key: number) {
  switch (p.t) {
    case "rect":
      return (
        <rect
          key={key}
          x={p.x}
          y={p.y}
          width={p.w}
          height={p.h}
          fill={p.fill}
          shapeRendering={p.crisp ? "crispEdges" : undefined}
        />
      );
    case "poly":
      return (
        <polygon
          key={key}
          points={p.pts.map(([x, y]) => `${x},${y}`).join(" ")}
          fill={p.fill}
          stroke={p.stroke}
          strokeWidth={p.strokeWidth}
          strokeLinejoin="round"
        />
      );
    case "path":
      return (
        <path key={key} d={p.d} fill="none" stroke={p.stroke} strokeWidth={p.strokeWidth} strokeLinecap="round" />
      );
    case "line":
      return (
        <line key={key} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeLinecap="round" />
      );
    case "circle":
      return <circle key={key} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill} />;
    case "text":
      return (
        <text key={key} x={p.x} y={p.y} fill={p.fill} fontSize={p.size} textAnchor="middle">
          {p.s}
        </text>
      );
  }
}

export const SvgScene = memo(function SvgScene({ scene, className }: TileRendererProps) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${scene.vbWidth} ${scene.vbHeight}`}
      width="100%"
      height="100%"
      shapeRendering="geometricPrecision"
    >
      {scene.prims.map(prim)}
    </svg>
  );
});
