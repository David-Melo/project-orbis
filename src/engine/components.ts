import type { EntityId } from "./ids";

export type TerrainKind =
  | "empty"
  | "ocean"
  | "coast"
  | "plain"
  | "hill"
  | "mountain"
  | "volcano"
  | "lava"
  | "basalt"
  | "river"
  | "lake"
  | "wetland"
  | "ice"
  | "void";

export type Direction = "n" | "e" | "s" | "w";

export type ConnectionKind =
  | "land"
  | "water"
  | "coast"
  | "river"
  | "road"
  | "wall"
  | "void";

export type Connection = {
  kind: ConnectionKind;
  featureId?: EntityId;
};

export type PositionComponent = {
  x: number;
  y: number;
};

export type TerrainComponent = {
  kind: TerrainKind;
};

export type ElevationComponent = { value: number }; // 0-10
export type MoistureComponent = { value: number }; // 0-10
export type TemperatureComponent = { value: number }; // 0-10
export type FertilityComponent = { value: number }; // 0-10

export type SurfaceComponent = {
  solid: boolean;
  liquid: boolean;
  walkable: boolean;
  buildable: boolean;
  floodable: boolean;
  burnable: boolean;
  freezable: boolean;
};

export type ConnectionComponent = {
  n?: Connection[];
  e?: Connection[];
  s?: Connection[];
  w?: Connection[];
};

export type TraitComponent = {
  traits: string[];
};

export type HistoryComponent = {
  eventIds: EntityId[];
};

/**
 * A Tile entity is the aggregate of all the components above. In a "pure" ECS
 * these would live in separate component stores; for a 32x32 prototype we keep
 * them co-located on a TileEntity for clarity while still treating each field
 * as an independent component that systems read/write in isolation.
 */
export type TileEntity = {
  id: EntityId;
  position: PositionComponent;
  terrain: TerrainComponent;
  elevation: ElevationComponent;
  moisture: MoistureComponent;
  temperature: TemperatureComponent;
  fertility: FertilityComponent;
  surface: SurfaceComponent;
  connections: ConnectionComponent;
  traits: TraitComponent;
  history: HistoryComponent;
};

export const SURFACE_KEYS: (keyof SurfaceComponent)[] = [
  "solid",
  "liquid",
  "walkable",
  "buildable",
  "floodable",
  "burnable",
  "freezable",
];

export const OPPOSITE: Record<Direction, Direction> = {
  n: "s",
  s: "n",
  e: "w",
  w: "e",
};

/** Symbolic glyph used by the Prototype-0 ASCII renderer (see PRD visuals). */
export const TERRAIN_GLYPH: Record<TerrainKind, string> = {
  empty: ".",
  ocean: "~",
  coast: "=",
  plain: "_",
  hill: "n",
  mountain: "^",
  volcano: "V",
  lava: "*",
  basalt: "#",
  river: "|",
  lake: "O",
  wetland: ",",
  ice: "I",
  void: " ",
};

/** CSS color per terrain, derived from state — the renderer is not the truth. */
export const TERRAIN_COLOR: Record<TerrainKind, string> = {
  empty: "#11151c",
  ocean: "#15396b",
  coast: "#caa86a",
  plain: "#5a8a43",
  hill: "#7a8a3f",
  mountain: "#7d7468",
  volcano: "#7a2f24",
  lava: "#d8431f",
  basalt: "#2b2b30",
  river: "#3f86c4",
  lake: "#2f6fb0",
  wetland: "#4f6b4a",
  ice: "#bfe3ef",
  void: "#000000",
};

export const TERRAIN_LABEL: Record<TerrainKind, string> = {
  empty: "Empty frontier",
  ocean: "Ocean",
  coast: "Coast",
  plain: "Plain",
  hill: "Hill",
  mountain: "Mountain",
  volcano: "Volcano",
  lava: "Lava",
  basalt: "Basalt",
  river: "River",
  lake: "Lake",
  wetland: "Wetland",
  ice: "Ice",
  void: "Void",
};

export const WATER_TERRAINS: ReadonlySet<TerrainKind> = new Set<TerrainKind>([
  "ocean",
  "coast",
  "river",
  "lake",
  "wetland",
]);

/** Default surface flags for a freshly-set terrain kind. */
export function defaultSurfaceFor(kind: TerrainKind): SurfaceComponent {
  switch (kind) {
    case "ocean":
    case "lake":
      return surf({ liquid: true, floodable: true, freezable: true });
    case "river":
      return surf({ liquid: true, floodable: true, freezable: true, walkable: false });
    case "wetland":
      return surf({ solid: true, liquid: true, floodable: true, walkable: true, freezable: true });
    case "coast":
      return surf({ solid: true, walkable: true, buildable: true, floodable: true, freezable: true });
    case "plain":
      return surf({ solid: true, walkable: true, buildable: true, burnable: true, freezable: true });
    case "hill":
      return surf({ solid: true, walkable: true, buildable: true, burnable: true, freezable: true });
    case "mountain":
      return surf({ solid: true, walkable: true, freezable: true });
    case "volcano":
      return surf({ solid: true, walkable: false });
    case "lava":
      return surf({ solid: false, liquid: true, walkable: false, buildable: false });
    case "basalt":
      return surf({ solid: true, walkable: true, buildable: true });
    case "ice":
      return surf({ solid: true, walkable: true });
    case "empty":
    case "void":
    default:
      return surf({});
  }
}

function surf(p: Partial<SurfaceComponent>): SurfaceComponent {
  return {
    solid: false,
    liquid: false,
    walkable: false,
    buildable: false,
    floodable: false,
    burnable: false,
    freezable: false,
    ...p,
  };
}
