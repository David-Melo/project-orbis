import type { EntityId } from "./ids";

export type TerrainKind =
  | "empty"
  | "ocean"
  | "coast"
  | "cliff"
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
  | "tundra"
  | "desert"
  | "forest"
  | "glacier"
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
  cliff: "/",
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
  tundra: "t",
  desert: "d",
  forest: "Y",
  glacier: "g",
  void: " ",
};

/** CSS color per terrain, derived from state — the renderer is not the truth. */
export const TERRAIN_COLOR: Record<TerrainKind, string> = {
  empty: "#11151c",
  ocean: "#15396b",
  coast: "#caa86a",
  cliff: "#8a7b66",
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
  tundra: "#9aa79c",
  desert: "#dccb78",
  forest: "#2f6b34",
  glacier: "#dfeef5",
  void: "#000000",
};

export const TERRAIN_LABEL: Record<TerrainKind, string> = {
  empty: "Empty frontier",
  ocean: "Ocean",
  coast: "Coast",
  cliff: "Cliff",
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
  tundra: "Tundra",
  desert: "Desert",
  forest: "Forest",
  glacier: "Glacier",
  void: "Void",
};

/**
 * Heatmap ramp for the elevation overlay, indexed by elevation 0..10:
 * deep blue (low / deep water) → teal → green → yellow → orange → red → snow.
 */
export const ELEVATION_COLORS: string[] = [
  "#0a2a5e", // 0
  "#16597f", // 1
  "#2487a0", // 2
  "#2fae8a", // 3
  "#6cc24a", // 4
  "#bcd23f", // 5
  "#ead23a", // 6
  "#e89a2c", // 7
  "#dc6322", // 8
  "#c2331c", // 9
  "#efe3d8", // 10
];

export const WATER_TERRAINS: ReadonlySet<TerrainKind> = new Set<TerrainKind>([
  "ocean",
  "coast",
  "river",
  "lake",
  "wetland",
]);

/** Fresh water that can feed rivers and lakes (the ocean is salt, excluded). */
export const FRESH_WATER_TERRAINS: ReadonlySet<TerrainKind> = new Set<TerrainKind>([
  "river",
  "lake",
  "wetland",
]);

/** High ground that can act as a river source ("spring"). */
export const HIGH_GROUND_TERRAINS: ReadonlySet<TerrainKind> = new Set<TerrainKind>([
  "hill",
  "mountain",
  "volcano",
  "glacier",
]);

/** Solid land the world can grow outward from. */
export const LAND_TERRAINS: ReadonlySet<TerrainKind> = new Set<TerrainKind>([
  "coast",
  "cliff",
  "plain",
  "hill",
  "mountain",
  "volcano",
  "basalt",
  "tundra",
  "desert",
  "forest",
  "glacier",
]);

/**
 * Canonical resting elevation + moisture for each terrain — the SINGLE source
 * of truth for "what a fresh tile of this kind looks like." The world seed
 * derives its tiles from this, so terrain values can never drift from the
 * rules by hand. A test asserts these stay within the documented bands, so any
 * rule change that breaks them fails loudly and forces the seed back in sync.
 */
export const TERRAIN_DEFAULTS: Record<TerrainKind, { elevation: number; moisture: number }> = {
  empty: { elevation: 0, moisture: 0 },
  void: { elevation: 0, moisture: 0 },
  ocean: { elevation: 0, moisture: 9 },
  coast: { elevation: 2, moisture: 7 },
  cliff: { elevation: 6, moisture: 4 },
  plain: { elevation: 4, moisture: 5 },
  hill: { elevation: 6, moisture: 4 },
  mountain: { elevation: 8, moisture: 3 },
  volcano: { elevation: 8, moisture: 1 },
  lava: { elevation: 6, moisture: 1 },
  basalt: { elevation: 5, moisture: 2 },
  river: { elevation: 3, moisture: 8 },
  lake: { elevation: 2, moisture: 8 },
  wetland: { elevation: 2, moisture: 8 },
  ice: { elevation: 4, moisture: 3 },
  tundra: { elevation: 4, moisture: 3 },
  desert: { elevation: 4, moisture: 1 },
  forest: { elevation: 4, moisture: 7 },
  glacier: { elevation: 7, moisture: 5 },
};

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
    case "cliff":
      return surf({ solid: true, walkable: true, freezable: true });
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
    case "tundra":
      return surf({ solid: true, walkable: true, buildable: true, freezable: true });
    case "desert":
      return surf({ solid: true, walkable: true, buildable: true });
    case "forest":
      return surf({ solid: true, walkable: true, buildable: true, burnable: true, freezable: true });
    case "glacier":
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
