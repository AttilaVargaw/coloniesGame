# Architecture

Space-themed strategy game built with React + Tauri. A custom 2D ECS engine drives the simulation and rendering on `<canvas>`, while React handles the DOM overlay.

## Tech Stack

- React 19, TypeScript 6.0, Tailwind CSS 4
- Vite 8, Vitest 4, ESLint 9
- Tauri 2 (desktop shell)
- Workspace package manager: **pnpm**

## Layered Architecture

```
src/
├── engine/        # Pure TS — no React, DOM, or browser APIs
│   ├── core/      # World, Engine interface
│   ├── entities/  # Entity, EntityComponent, EntityNode, SceneNode
│   ├── systems/   # Engine systems (viewport, orbit, date, button)
│   ├── components/# Primitive components (position, color, radius, orbit, …)
│   ├── lib/       # ECS plumbing (registries, buses, queues)
├── game/          # Game logic — depends on engine
│   ├── game.ts    # Bootstrap + RAF loop
│   ├── systems/   # Game systems (industry, selection, cursor, move, …)
│   ├── factories/ # Entity creators (star, colony, spaceship, solar system)
│   ├── data/      # Static game data
│   ├── components/# Game-specific components
├── lib/           # Shared utilities (camera, pathfinder, calendar, …)
├── App.tsx        # React root + DOM ↔ Engine bridge
└── components/    # React UI components
```

Module aliases (Vite):
- `@engine/*` → `src/engine/**`
- `@game/*` → `src/game/**`
- `@/engine/*` → `src/engine/**`

## Core Engine (`src/engine/`)

### World & Engine Interface

`World` is the central orchestrator (`colonies-game/src/engine/core/world.ts`). It implements the `Engine` interface and owns five registries:

- `EntityRegistry` — creates/removes entities, manages `SceneNode` tree
- `NodeManager` — indexes entities into typed node lists by component set
- `EventBus` — typed event queues with handler dispatch
- `CommandBus` — typed command queues
- `SystemRegistry` — system lifecycle, update loop

### Entity Component System

**Entity** (`colonies-game/src/engine/entities/entity.ts`) is a map of `EntityComponent` instances keyed by constructor. Components are plain data holders; there is no inheritance hierarchy beyond `EntityComponent`.

```ts
class Entity {
  addComponent(component: EntityComponent): this
  getComponent<T>(ctor: new (...args) => T): InstanceType<T> | undefined
  removeComponent(ctor: new (...args) => EntityComponent): this
}
```

Components trigger `reindexEntity` via a change handler, which updates all matching node lists.

### EntityNode — Queries

`EntityNode` wraps an `Entity` and extracts typed data from its components. Systems register a node type by declaring the required component constructors:

```ts
engine.registerNodeType(OrbitNode,
  new Set([OrbitComponent]),
  (entity) => new OrbitNode(entity, entity.getComponent(PositionComponent)!, entity.getComponent(OrbitComponent)!)
)
```

`NodeManager` maintains flat arrays of nodes. When an entity changes components, the manager removes the entity from all lists and re-adds it to lists whose component set matches.

### Scene Graph

`SceneNode` (`colonies-game/src/engine/entities/sceneNode.ts`) is a lightweight tree node separate from `EntityNode`. It stores parent/children references and resolves world position by accumulating transforms up the tree. Used by orbit and rendering systems for relative positioning.

### EventBus

Typed events extend `EventBase<Data>`. Each event class maps to a `Queue`. Systems dispatch events via `engine.dispatchEvent(event)`. Handlers subscribe by event constructor and receive the typed data payload. Events are processed in batch during `World.update()`.

### CommandBus

Typed commands extend `CommandBase`. Each command class maps to a `Queue`. Systems push commands (e.g., `RedrawCommand`) and other systems or hooks consume them. This decouples input processing from rendering.

### Queue

Generic FIFO queue with optional capacity and overflow callback. Used by both `EventBus` and `CommandBus`.

## Systems (`src/engine/systems/`)

### System

Base class with engine reference, subsystems, and lifecycle hooks (`addToEngine`, `removeFromEngine`, `registerNodes`). Subsystems inherit the same engine reference.

### SystemWithNodes<N extends EntityNode>

Adds typed `nodes: N[]`, `updateNode` abstraction, and per-frame iteration. Used by all query-based systems.

### Engine Systems

| System | Node | Purpose |
|--------|------|---------|
| `ViewportSystem` | `ViewportNode` | Canvas rendering loop, camera, input handling, holds renderer subsystems |
| `OrbitSystem` | `OrbitNode` | Kepler orbit simulation via `PositionComponent` updates |
| `DateSystem` | `DateNode` | In-game calendar |
| `ButtonPressSystem` | `ButtonPressNode` | Button state tracking |
| `ClickableSystem` | `ClickableNode` | Screen-space hit testing via `ClickableComponent` |
| `CursorSystem` | `HoverableNode` | Cursor style management on hover |

## Rendering

`ViewportSystem` is the rendering root. It owns a `RedrawCommand` queue; when non-empty, it clears the canvas and iterates renderer subsystems in order:

- `HexagonRenderer` — hex tiles (map grid)
- `CircleRenderer` — circles (stars, colonies)
- `RectRenderer` — rectangles (sensor ranges, selections)
- `LabelRenderer` — text labels

Each renderer extends `BaseRenderer<N>`, which registers its node type and manages its own subscription to `EntityAddedEvent`. Nodes are filtered by viewport visibility before drawing.

**Camera** (`colonies-game/src/lib/camera.ts`) handles zoom, pan, screen↔world transforms, and `begin()/end()` context save/restore around each frame.

## Game Layer (`src/game/`)

### Game Bootstrap

`Game` (`colonies-game/src/game/game.ts`) creates a `World`, registers systems, and runs a `requestAnimationFrame` loop capped at 500ms/dt. It owns the `CanvasRenderingContext2D` and `Map<string, Star>` (solar system data).

System registration order in `Game`:
1. `IndustrySystem`, `DateSystem`, `OrbitSystem`, `ButtonPressSystem`, `ViewportSystem`
2. `ViewportComponent` + `DateComponent` singleton entities
3. `MoveSystem`, `SelectionSystem`, `TargetSystem`, `CursorSystem`, `MapSystem`, `ClickableSystem`

### Game Systems

| System | Purpose |
|--------|---------|
| `IndustrySystem` | Economy: ore, tylium, credits, taxes, build queues, population growth |
| `SelectionSystem` | Entity selection/targeting with visual indicators |
| `MoveSystem` | Pathfinding (A*) and ship movement |
| `TargetSystem` | Ship targeting |
| `CursorSystem` | Hover cursor feedback |
| `MapSystem` | Map grid initialization/teardown |

Game systems subscribe to `DayPassedEvent` to run economy logic. They create selector/target entities and attach them as children of selected entities in the scene graph.

### Factories

Entity creators in `src/game/factories/`:
- `createStar`, `createColony`, `createSpaceship`, `createSolarSystem`, `createBinaryOrbitPair`
- `mapBuilder` — populates the pathfinding grid from waypoints

Data flows from `gameData.ts` (static `Star[]` definitions) through factories into the engine.

## React Bridge (`src/App.tsx`, `src/hooks/`)

`App` owns a `<canvas>` ref. On mount it creates a `Game` instance with the canvas context and passes mouse events as engine events:

```tsx
game.engine.dispatchEvent(new MousemoveEvent(data))
game.engine.addCommand(new RedrawCommand())
```

`GameContext.Provider` wraps the app with the `Engine` instance so React components can subscribe to engine events.

### Hooks

| Hook | Purpose |
|------|---------|
| `useGameContext` | `useContext(GameContext)` → `Engine | null` |
| `useGameEvent` | Subscribes to an `EventBase` subclass, cleans up on unmount |
| `useGameDate` | Reads `DateNode.date.ms` on `DayPassedEvent` |
| `useSelectionChanged` | Fires callback when `SelectionChangedEvent` fires |

React UI components (header, sidebar, production bar, colony info window) read engine state through these hooks or `GameContext`.

## Data Flow

```
React mouse events → Engine dispatchEvent → EventBus queue → System handlers
                                                        ↓
                                                 CommandBus (RedrawCommand)
                                                        ↓
                                              ViewportSystem → Canvas render
```

Update loop:
```
requestAnimationFrame
  → World.update(dt)
    → EventBus.dispatchEvent(UpdateBeginEvent)
    → EventBus.processEventHandlers()
    → SystemRegistry.update(dt)  [each system iterates its nodes]
    → EventBus.dispatchEvent(UpdateDoneEvent)
```

## Architectural Rules

1. **Engine ≠ React**: `src/engine` must not import React, DOM, or browser APIs.
2. **Events are typed**: extend `EventBase<Data>`; dispatch via `engine.dispatchEvent`.
3. **Commands are typed**: extend `CommandBase`; queue via `engine.addCommand`.
4. **Node reindexing**: when a component changes, call `engine.reindexEntity(entity)`.
5. **Cleanup**: systems must unsubscribe/unregister in `removeFromEngine`; `Game` calls `destruct()`.
