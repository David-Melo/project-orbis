import type { Connection, Direction, SurfaceComponent, TerrainKind } from "./components";

/** Requirements gate whether a card may be generated/played on a tile. */
export type Requirement =
  | { type: "targetIsEmpty" }
  | { type: "targetTerrainIn"; terrains: TerrainKind[] }
  | { type: "touchesTerrain"; terrain: TerrainKind }
  | { type: "touchesAnyTerrain"; terrains: TerrainKind[] }
  | { type: "nearTerrain"; terrain: TerrainKind; radius: number }
  | { type: "minElevation"; value: number }
  | { type: "maxElevation"; value: number }
  | { type: "minMoisture"; value: number }
  | { type: "maxMoisture"; value: number }
  | { type: "maxTemperature"; value: number }
  | { type: "surfaceCapability"; capability: keyof SurfaceComponent };

/** Effects mutate the target tile's components when a card resolves. */
export type Effect =
  | { type: "setTerrain"; terrain: TerrainKind }
  | { type: "setElevation"; value: number }
  | { type: "adjustElevation"; amount: number }
  | { type: "adjustMoisture"; amount: number }
  | { type: "adjustTemperature"; amount: number }
  | { type: "adjustFertility"; amount: number }
  | { type: "addConnection"; direction: Direction; connection: Connection }
  | { type: "addTrait"; trait: string }
  | { type: "removeTrait"; trait: string }
  | { type: "spreadMoisture"; amount: number; radius: number }
  | { type: "flowDownhill" }
  | { type: "createEvent"; title: string; description: string };

export function describeEffect(effect: Effect): string {
  switch (effect.type) {
    case "setTerrain":
      return `Terrain → ${effect.terrain}`;
    case "setElevation":
      return `Elevation → ${effect.value}`;
    case "adjustElevation":
      return `Elevation ${signed(effect.amount)}`;
    case "adjustMoisture":
      return `Moisture ${signed(effect.amount)}`;
    case "adjustTemperature":
      return `Temperature ${signed(effect.amount)}`;
    case "adjustFertility":
      return `Fertility ${signed(effect.amount)}`;
    case "addConnection":
      return `Connect ${effect.direction.toUpperCase()} (${effect.connection.kind})`;
    case "addTrait":
      return `Gain trait “${effect.trait}”`;
    case "removeTrait":
      return `Lose trait “${effect.trait}”`;
    case "spreadMoisture":
      return `Moisture ${signed(effect.amount)} within r${effect.radius}`;
    case "flowDownhill":
      return "Flows downhill to the lowest neighbor";
    case "createEvent":
      return effect.title;
  }
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}
