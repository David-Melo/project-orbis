# Project Orbis: A Collaborative Myth-Map Game: Manifesto + PRD

## Working Concept

A daily collaborative worldbuilding game/art piece where players grow a shared digital map one constrained action at a time.

The world begins with simple natural systems: land, ocean, coast, elevation, rivers, ice, volcanoes, lava, erosion. Over time, later versions introduce ecology, migration, settlements, roads, names, culture, ruins, and lore.

The game combines ideas from:

* Jerry’s Map: a world changed through ritualized instructions.
* Carcassonne: local tile adjacency creating coherent geography.
* Deckbuilders: a hand of limited options shaping action.
* Pixel canvases: collective authorship over a shared surface.
* Dwarf Fortress: history, causality, memory, and emergent lore.
* Earth history: geology first, life second, culture later.

The core twist: players do not draw freely and do not pull from a fixed universal deck. Instead, the map itself generates possible cards based on the assigned tile’s local context.

The map tells the player what futures are possible.

---

# Part 1: Conceptual Manifesto

## 1. The Map Is Alive

The map is not a static canvas. It is a living surface where each tile stores state, history, relationships, and future potential.

A tile is not merely “blue” or “green.” It may be ocean, shallow coast, volcanic basalt, fertile floodplain, sacred forest, old road, abandoned town, or disputed border.

Every visible mark should have consequences.

## 2. The Player Does Not Draw Anything They Want

Free drawing is rejected as a core mechanic.

The goal is maximum creativity inside meaningful constraints, not blank-canvas chaos. The system should prevent low-effort vandalism by design.

Players express themselves through verbs, choices, placement, naming systems, structured lore, and emergent consequences.

The game should feel creative without allowing the canvas to become a bathroom stall.

## 3. Cards Are Grown From the Map

Unlike a physical shuffled deck, this game’s cards are generated from local geography.

A player is assigned a frontier tile. The system inspects neighboring tiles and nearby features. Then it generates a hand of valid action cards.

Examples:

* A tile beside a river may generate floodplain, river bend, marsh, spring, delta, or crossing cards.
* A tile beside lava may generate basalt field, ash plain, volcanic ridge, crater lake, or fertile black soil cards.
* A tile beside ice may generate glacier spread, meltwater stream, frozen coast, exposed stone, or ice shelf cards.

The “deck” is not external fate. The deck is geographic fate.

## 4. The Player Interviews the Tile

The daily ritual is not:

“What do I want to draw?”

It is:

“What does this place want to become?”

The player’s role is to interpret constrained possibilities and choose which future enters the world.

## 5. The World Evolves in Ages

The game’s product roadmap should mirror the evolution of a world.

Early versions are geological. Later versions introduce life. Later still, people, roads, settlements, politics, ruins, and mythology.

This is both a conceptual structure and a technical strategy.

Do not add cities before rivers.
Do not add roads before terrain.
Do not add kingdoms before settlements.
Do not add ruins before anything has existed long enough to decay.

## 6. History Is a First-Class Feature

Every action should produce an event.

The current map is only the latest state. The true artwork is the accumulated history.

A tile should be inspectable:

* What is here now?
* What was here before?
* Who changed it?
* What card caused the change?
* What systems did it unlock?
* What future cards might now emerge?

The map should eventually support replay, tile history, region chronicles, and time-based inspection.

## 7. Rendering Is Not the Source of Truth

Visuals are derived from world state.

A road sprite does not define a road.
A river pixel does not define a river.
A town icon does not define a town.

The state defines the thing. The renderer expresses it.

This protects the game from becoming a shallow art board.

## 8. ECS Is the Core Architecture

The game should be built around Entity Component System thinking.

Entities are things in the world.
Components are facts attached to things.
Systems operate on components and create change.

This makes the world extensible.

A tile can start as:

Position + Terrain + Elevation

Then later become:

Position + Terrain + Elevation + Moisture + River + Road + Name + Sacred + History

No inheritance explosion. No `RiverRoadTownTile` nonsense.

## 9. Systems Build on Old Systems

Every new system should create state that future systems can query.

A river should provide:

* fresh water
* moisture
* erosion
* crossing challenge
* settlement attraction
* future bridge opportunity

A road should provide:

* navigability
* connection
* movement bonus
* trade potential
* agent pathing
* future decay or ruin

A volcano should provide:

* elevation
* lava
* instability
* basalt
* ash fertility
* minerals
* sacred/fearful lore potential

Nothing should be “just decorative” unless explicitly marked as decorative.

## 10. The MVP Must Be Small

The first prototype should not be multiplayer.
It should not require accounts.
It should not require a backend.
It should not need hand-made art assets.
It should not simulate civilization.
It should not include free text lore.

The first prototype exists to answer one question:

Does it feel interesting to grow a local map through generated, context-aware cards?

---

# Part 2: Technical PRD

## Product Goal

Build a local-only browser prototype of a daily collaborative myth-map system using Vite, TypeScript, and React.

The prototype should prove the core loop:

1. Generate or load a small world map.
2. Assign the player a frontier tile.
3. Inspect the tile’s neighboring context.
4. Generate a small hand of valid cards.
5. Let the player choose one card.
6. Apply the card through ECS-style systems.
7. Update the map.
8. Record an event in history.
9. Persist the world locally in the browser.

---

## Initial Platform

### Frontend

* Vite
* TypeScript
* React

### Storage

Use browser-local storage only for prototypes.

Recommended progression:

1. In-memory state for earliest spike.
2. `localStorage` for quick save/load.
3. IndexedDB for real local persistence.
4. Export/import world JSON for backups and sharing.

Do not introduce a backend until the local game loop is fun.

### Rendering

Early prototypes should avoid asset dependency.

Acceptable first rendering approaches:

* ASCII grid
* emoji/symbol grid
* CSS-colored tiles
* inline SVG tiles
* generated SVG patterns
* simple canvas renderer

Best initial recommendation:

Use a simple CSS grid or canvas with symbolic labels/colors first. Then move to SVG/canvas autotiling once the rules are stable.

Do not spend early energy on polished art.

---

## Core Gameplay Loop

### Local Prototype Loop

1. User clicks “Start Day.”
2. System selects a frontier tile.
3. System analyzes neighboring tiles.
4. System generates 3 possible cards.
5. User chooses 1 card.
6. System previews effects.
7. User confirms.
8. System applies effects.
9. Event is recorded.
10. Map updates.
11. User can inspect changed tile and history.

For development convenience, the prototype should allow “Advance Day” manually rather than enforcing real-world daily limits.

---

## Core Design Rule

The card says what kind of change is possible.
The map says where it is possible.
The systems decide how it resolves.

---

# ECS Architecture

## Entities

Initial entity types:

* Tile
* Region
* Feature
* World
* Event
* Card
* Session

Future entity types:

* Settlement
* RoadNetwork
* RiverNetwork
* Agent
* Culture
* Artifact
* Border
* Kingdom

---

## Components

### Required V1 Components

```ts
type EntityId = string;

type PositionComponent = {
  x: number;
  y: number;
};

type TerrainKind =
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

type TerrainComponent = {
  kind: TerrainKind;
};

type ElevationComponent = {
  value: number; // suggested range 0-10
};

type MoistureComponent = {
  value: number; // suggested range 0-10
};

type TemperatureComponent = {
  value: number; // suggested range 0-10
};

type FertilityComponent = {
  value: number; // suggested range 0-10
};

type SurfaceComponent = {
  solid: boolean;
  liquid: boolean;
  walkable: boolean;
  buildable: boolean;
  floodable: boolean;
  burnable: boolean;
  freezable: boolean;
};

type ConnectionComponent = {
  n?: Connection[];
  e?: Connection[];
  s?: Connection[];
  w?: Connection[];
};

type Connection = {
  kind: "land" | "water" | "coast" | "river" | "road" | "wall" | "void";
  featureId?: EntityId;
};

type HistoryComponent = {
  eventIds: EntityId[];
};
```

### Future Components

```ts
type RoadComponent = {
  kind: "trail" | "dirt_road" | "stone_road";
  connections: Direction[];
  navigableBy: ("human" | "animal" | "cart")[];
  movementCostModifier: number;
  condition: "new" | "worn" | "broken" | "overgrown";
};

type RiverComponent = {
  connections: Direction[];
  size: "stream" | "river" | "great_river";
  flowDirection?: Direction;
  providesFreshWater: boolean;
};

type SettlementComponent = {
  name?: string;
  size: "camp" | "village" | "town" | "city";
  foundedDay: number;
  populationTier: number;
};

type NameComponent = {
  name: string;
  namingStyle: "plain" | "mythic" | "ancient" | "weird";
};

type TraitComponent = {
  traits: string[];
};
```

---

## Systems

### Required V1 Systems

#### WorldGenerationSystem

Creates the initial empty or seeded map.

Responsibilities:

* create grid
* initialize base terrain
* seed ocean/land if needed
* assign starting components

#### FrontierAssignmentSystem

Finds valid empty frontier tiles.

A frontier tile is an empty tile adjacent to at least one non-empty tile.

Responsibilities:

* scan map
* find frontier candidates
* select one randomly or deterministically from seed
* assign it to current session

#### ContextAnalysisSystem

Reads local neighborhood around assigned tile.

Responsibilities:

* inspect adjacent tiles
* inspect radius 2-3 if needed
* summarize terrain, elevation, moisture, temperature, existing features, and connections

Example context:

```ts
type TileContext = {
  targetTileId: EntityId;
  adjacentTerrains: TerrainKind[];
  nearbyTerrains: TerrainKind[];
  touchesWater: boolean;
  touchesOcean: boolean;
  touchesRiver: boolean;
  touchesLava: boolean;
  touchesIce: boolean;
  touchesMountain: boolean;
  averageElevation: number;
  averageMoisture: number;
  averageTemperature: number;
};
```

#### CardGenerationSystem

Generates possible cards from local context.

Responsibilities:

* evaluate card archetypes
* filter by valid context
* generate 3 cards
* include mechanical requirements and effects
* include simple flavor text

#### RequirementValidationSystem

Ensures a selected card is legal.

Responsibilities:

* confirm assigned tile
* confirm card belongs to current session
* confirm requirements still pass
* prevent invalid transformations

#### EffectApplicationSystem

Applies card effects to components.

Responsibilities:

* set terrain
* adjust elevation/moisture/temperature/fertility
* add/remove traits
* add/remove features
* update connections
* update derived capabilities
* create history event

#### HistorySystem

Records all accepted changes.

Responsibilities:

* create event records
* attach event IDs to tiles
* support tile history inspection
* support future replay

#### RenderSystem

Turns component state into visuals.

Responsibilities:

* choose tile label/color/SVG
* resolve edge connections
* support simple map display
* avoid treating visuals as source of truth

---

# Card Model

Cards should mostly be data.

```ts
type CardId = string;

type WorldAge =
  | "primordial"
  | "geological"
  | "ecological"
  | "nomadic"
  | "settlement"
  | "kingdom"
  | "ruin"
  | "memory";

type GeneratedCard = {
  id: CardId;
  title: string;
  age: WorldAge;
  targetTileId: EntityId;
  requirements: Requirement[];
  effects: Effect[];
  flavor?: string;
};
```

## Requirements

```ts
type Requirement =
  | { type: "targetIsEmpty" }
  | { type: "touchesTerrain"; terrain: TerrainKind }
  | { type: "nearTerrain"; terrain: TerrainKind; radius: number }
  | { type: "minElevation"; value: number }
  | { type: "maxElevation"; value: number }
  | { type: "minMoisture"; value: number }
  | { type: "maxMoisture"; value: number }
  | { type: "surfaceCapability"; capability: keyof SurfaceComponent };
```

## Effects

```ts
type Effect =
  | { type: "setTerrain"; terrain: TerrainKind }
  | { type: "adjustElevation"; amount: number }
  | { type: "adjustMoisture"; amount: number }
  | { type: "adjustTemperature"; amount: number }
  | { type: "adjustFertility"; amount: number }
  | { type: "addConnection"; direction: Direction; connection: Connection }
  | { type: "addTrait"; trait: string }
  | { type: "removeTrait"; trait: string }
  | { type: "createEvent"; title: string; description: string };
```

---

# Card Archetypes

Cards should be generated from archetypes, not written as one-off custom logic.

```ts
type CardArchetype = {
  id: string;
  age: WorldAge;
  canGenerate: (ctx: TileContext, world: WorldState) => boolean;
  generate: (ctx: TileContext, world: WorldState, rng: Rng) => GeneratedCard;
};
```

## V1 Archetypes

### Raise Land

Valid when:

* target is empty or ocean/coast
* nearby land exists, or world seed allows new island formation

Effects:

* terrain becomes plain/hill
* elevation increases
* solid becomes true
* liquid becomes false

### Sink Land

Valid when:

* target is land/coast
* near ocean/lake/river

Effects:

* terrain becomes coast/ocean/wetland
* elevation decreases
* moisture increases

### Form Coast

Valid when:

* target touches ocean and land

Effects:

* terrain becomes coast
* connection edges resolve land/water boundary

### Erupt Volcano

Valid when:

* target is land, mountain, coast, or empty frontier
* optional: higher chance near existing mountains/lava

Effects:

* terrain becomes volcano
* elevation increases
* temperature increases
* adjacent future cards may include lava, basalt, ash plain

### Spread Lava

Valid when:

* target touches volcano or lava

Effects:

* terrain becomes lava
* temperature increases
* walkable/buildable false

### Cool Lava

Valid when:

* target touches lava and water/coast, or lava has aged

Effects:

* terrain becomes basalt
* solid true
* fertility may increase later

### Freeze

Valid when:

* target has water, coast, mountain, or low temperature context

Effects:

* terrain becomes ice
* temperature decreases
* movement rules change

### Melt Ice

Valid when:

* target touches ice
* nearby temperature is higher or card generated by age/event

Effects:

* terrain becomes water/wetland/plain depending on elevation
* moisture increases

### Carve River

Valid when:

* target near high elevation or water source
* target can hold or channel water

Effects:

* terrain becomes river or wetland
* connection added to neighboring water/river
* moisture increases nearby

### Form Lake

Valid when:

* target has low elevation
* touches river, ice melt, or wetland

Effects:

* terrain becomes lake
* liquid true
* walkable false
* freshwater capability true

---

# Local Persistence

## Prototype Storage Strategy

### Phase 0

Use in-memory state only.

### Phase 1

Use `localStorage`.

Store:

```ts
{
  worldState,
  eventLog,
  currentDay,
  rngSeed
}
```

### Phase 2

Use IndexedDB.

Suggested stores:

* worlds
* entities
* components
* events
* sessions
* settings

### Phase 3

Add JSON export/import.

This allows saving, sharing, debugging, and comparing worlds before a backend exists.

---

# UI Requirements

## Required Prototype Screens

### Main Map View

Displays the grid.

Requirements:

* visible tile states
* selected assigned tile highlighted
* hover/click tile inspector
* zoom can be ignored initially

### Daily Session Panel

Shows:

* current day
* assigned tile coordinates
* generated card hand
* selected card preview
* confirm action button

### Tile Inspector

Shows:

* terrain
* elevation
* moisture
* temperature
* fertility
* capabilities
* connections
* history events

### History Log

Shows:

* chronological event list
* day
* card used
* target tile
* description

### Dev Controls

Allowed in prototype:

* generate new world
* reset world
* advance day
* export JSON
* import JSON
* inspect ECS state

---

# Visual Strategy

## Prototype 0 Visuals

Use ASCII-like symbols:

```txt
. empty
~ ocean
= coast
_ plain
^ mountain
V volcano
* lava
# basalt
| river
O lake
, wetland
I ice
```

## Prototype 1 Visuals

Use simple CSS tile colors and symbols.

## Prototype 2 Visuals

Use generated SVG tiles.

Each tile can render from component state.

Examples:

* coast generated from land/water edge connections
* river generated from connection directions
* lava generated from terrain + temperature
* mountain generated from elevation

## Later Visuals

Possible asset directions:

* AI-generated base tiles
* hand-drawn pixel tiles
* procedural SVG
* Dwarf Fortress-inspired glyph mode
* toggle between atlas mode and symbolic mode

Recommendation:

Start symbolic. Add beauty only after the rules feel alive.

---

# Event Model

Every accepted action creates an event.

```ts
type WorldEvent = {
  id: EntityId;
  day: number;
  title: string;
  description: string;
  actor: "local-player" | "system";
  cardId?: CardId;
  targetTileId: EntityId;
  effects: Effect[];
  createdAt: string;
};
```

Events are required for:

* tile history
* replay
* debugging
* moderation later
* lore generation later

The current map is materialized state.
The event log is the world’s memory.

---

# Non-Goals for Local Prototype

Do not build yet:

* accounts
* multiplayer
* backend
* real daily lockout
* moderation tooling
* free drawing
* free text lore
* agents
* settlements
* roads
* trading
* factions
* combat
* economy
* mobile polish
* final art direction

These are future layers. The first goal is to prove the map-card-rule loop.

---

# Roadmap

## Prototype 0: ECS Map Spike

Goal:

Prove ECS-shaped world state in a browser.

Scope:

* Vite + React + TypeScript
* fixed grid, e.g. 32x32
* in-memory world state
* basic entities/components
* render ASCII/symbol map
* click tile to inspect components
* manual terrain editing through dev controls

No card system yet.

Success criteria:

* tiles are entities
* terrain/elevation/moisture are components
* renderer derives visuals from state
* tile inspector exposes component data

---

## Prototype 1: Local Primordial Cards

Goal:

Prove context-generated cards.

Scope:

* frontier tile assignment
* local context analysis
* 3 generated cards
* card selection
* effect application
* event log
* localStorage persistence

Initial cards:

* raise land
* sink land
* form coast
* erupt volcano
* spread lava
* cool lava
* freeze
* melt
* carve river
* form lake

Success criteria:

* assigned tile generates sensible local cards
* cards do not appear when invalid
* world changes feel physically plausible
* event log records all changes

---

## Prototype 2: Better Geology

Goal:

Make the primordial world feel naturally coherent.

Scope:

* elevation gradients
* water/coast autotiling
* river edge connections
* lava/water interactions
* basalt formation
* ice/meltwater interactions
* primitive erosion/spread rules
* IndexedDB persistence
* JSON export/import

Success criteria:

* rivers connect logically
* coasts resolve visually
* lava/water creates consequences
* ice and melt create new terrain
* old actions unlock future actions

---

## Prototype 3: World Ages System

Goal:

Make the roadmap part of the game.

Scope:

* formal `WorldAge`
* age-based card archetype registry
* age progression controls
* global age modifiers
* primitive “era” history screen

Ages:

* primordial
* geological
* ecological
* nomadic
* settlement
* kingdom
* ruin
* memory

Success criteria:

* only age-appropriate cards generate
* the game can unlock new systems without rewriting old ones
* world history is grouped by age

---

## Prototype 4: Ecology

Goal:

Introduce life without civilization.

Scope:

* forest
* grassland
* wetland
* desert
* reef
* fertile ash plain
* habitat tags
* burnable/freezable/floodable traits
* simple spread/decay cellular rules

Success criteria:

* biomes emerge from terrain, moisture, temperature, and fertility
* forests and deserts spread logically
* volcanoes and rivers affect future ecology

---

## Prototype 5: Names and Structured Lore

Goal:

Introduce Dwarf Fortress-style memory without free text.

Scope:

* generated place names
* structured lore fragments
* tile/region titles
* event descriptions based on real history
* naming cards
* inspectable chronicles

No arbitrary user text yet.

Success criteria:

* tiles start to feel like places
* event history becomes readable as myth
* lore is generated from actual state, not random flavor only

---

## Prototype 6: Roads and Routes

Goal:

Introduce Carcassonne-like infrastructure.

Scope:

* RoadComponent
* route connections
* road placement rules
* bridges
* crossings
* movement cost
* route network graph
* road history

Prerequisites:

* solid land
* slope
* river/coast/water barriers
* settlements or proto-destinations

Success criteria:

* roads connect meaningful places
* roads respect terrain
* bridges solve river conflicts
* routes become queryable by future agents

---

## Prototype 7: Settlements

Goal:

Introduce human habitation.

Scope:

* camps
* villages
* towns
* founding requirements
* fresh water preference
* fertility preference
* road/coast preference
* settlement names
* settlement event logs

Success criteria:

* settlements feel earned by geography
* towns emerge where the world supports them
* settlement placement is not arbitrary

---

## Prototype 8: Shared Backend MVP

Goal:

Turn the local prototype into a real collaborative daily game.

Scope:

* backend API
* user accounts or anonymous identity
* daily action limit
* server-side validation
* shared world state
* command/event commit model
* moderation audit log
* rollback tools
* rate limiting

Success criteria:

* multiple users can submit actions safely
* server validates all card choices
* event history remains canonical
* griefing surface remains low

---

## Prototype 9: Public Myth-Map

Goal:

Make the project feel like a living public artwork.

Scope:

* global shared map
* daily ritual
* tile history
* region pages
* era timeline
* replay mode
* shareable tile/region links
* public chronicle

Success criteria:

* users return to see what changed
* places develop identity
* the map feels authored by many people but still coherent

---

## Later Wishlist Concepts

These are intentionally abstract.

### Agents

Tiny people, animals, pilgrims, traders, or spirits moving through the world.

They should use existing navigability, roads, terrain cost, water barriers, and settlement data.

### Cultures

Cultures emerge around regions, terrain, repeated events, sacred places, food sources, and isolation.

### Factions and Borders

Groups claim regions, split, merge, migrate, and fight.

### Ruins and Memory

Settlements decay. Roads overgrow. Names are forgotten. Old places can be rediscovered.

### Artifacts

Objects are created, lost, moved, buried, worshipped, stolen, or recovered.

### Climate Ages

Ice ages, warming eras, droughts, volcanic winters, flood ages.

### Public Replay

Users can scrub from Day 1 to the current day and watch the world grow.

### Region Chronicles

Each region has a generated historical summary based on actual event logs.

### Multiple Worlds

Different worlds can have different seeds, rulesets, visual styles, and age progressions.

---

# First Build Recommendation

Start with Prototype 0 and Prototype 1 only.

Build:

* Vite
* React
* TypeScript
* ECS-style world state
* 32x32 grid
* symbolic rendering
* localStorage save/load
* frontier tile assignment
* context-generated cards
* 10 geological card archetypes
* event log
* tile inspector

Ignore everything else until that loop feels good.

The first prototype should look ugly but think correctly.

The success condition is not visual polish.

The success condition is this feeling:

“I got assigned a strange edge of the world, the map offered me three plausible futures, I chose one, and now the world is permanently different.”
