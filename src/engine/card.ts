import type { EntityId } from "./ids";
import type { Effect, Requirement } from "./effects";

export type WorldAge =
  | "primordial"
  | "geological"
  | "ecological"
  | "nomadic"
  | "settlement"
  | "kingdom"
  | "ruin"
  | "memory";

export type CardId = string;

export type GeneratedCard = {
  id: CardId;
  archetypeId: string;
  title: string;
  age: WorldAge;
  targetTileId: EntityId;
  requirements: Requirement[];
  effects: Effect[];
  flavor?: string;
};

/** Summary of a tile's neighborhood, produced by the ContextAnalysisSystem. */
export type TileContext = {
  targetTileId: EntityId;
  targetX: number;
  targetY: number;
  adjacentTerrains: import("./components").TerrainKind[];
  nearbyTerrains: import("./components").TerrainKind[];
  touchesWater: boolean;
  touchesOcean: boolean;
  touchesRiver: boolean;
  touchesLake: boolean;
  touchesLava: boolean;
  touchesIce: boolean;
  touchesVolcano: boolean;
  touchesMountain: boolean;
  touchesLand: boolean;
  averageElevation: number;
  averageMoisture: number;
  averageTemperature: number;
};
