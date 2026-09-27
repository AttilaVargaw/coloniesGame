# AGENTS.md — Colonies Game

## Project

Space-themed strategy game built with React + Tauri. Custom 2D ECS engine renders solar systems on `<canvas>`.

- Root: `/Users/attilavarga/codes/coloniesGame`
- App: `colonies-game/`
- See `ARCHITECTURE.md` for layered ECS + React bridge design.

## Tech Stack

- React 19.3, TypeScript 6.0.3, Tailwind CSS 4.3
- Vite 8.3, Vitest 5.0, ESLint 10.11 + Oxlint 1.85
- Tauri 2 (CLI ^2.12.0, API ^2.12.0)
- React Compiler (`babel-plugin-react-compiler` ^1.0.0 via `@rolldown/plugin-babel`)
- Workspace package manager: **pnpm** 12.4

## Commands

Run from `colonies-game/` unless noted otherwise.

```bash
pnpm dev          # Start Vite dev server
pnpm build        # TypeScript check + Vite build
pnpm test         # Run Vitest unit tests
pnpm coverage     # Vitest with V8 coverage
pnpm lint         # Oxlint + ESLint, strict
pnpm lint:fix     # Oxlint + ESLint with auto-fix
pnpm e2e          # Playwright tests
```

## Testing

- Tests live alongside source: `*.test.ts`
- Vitest config: `../vitest.config.ts` (project root)
- No custom test setup beyond V8 coverage provider.

## Lint / Typecheck

- ESLint 10 flat config + Oxlint; strict (`--max-warnings 0`)
- Oxlint runs first for fast feedback; ESLint handles remaining rules
- TypeScript strict mode; `tsc` runs as part of `build`
- Fixable issues: `pnpm lint:fix`

## Code Conventions

- TypeScript with strict settings; prefer `type` imports where possible
- Module aliases (Vite):
  - `@engine/*` → `src/engine/**`
  - `@game/*` → `src/game/**`
- Engine layer (`src/engine/**`) has no React dependency
- Game/UI layers import from `colonies-game/src` using the above aliases
- Systems extend `System` or `SystemWithNodes`; register node types via `engine.registerNodeType`
- Components are classes stored in `Entity` keyed by constructor
- Scene graph uses `SceneNode` parent/children; world position via accumulation
- React 19: use `use(GameContext)` instead of `useContext(GameContext)` in hooks

## Architecture Rules

1. **Engine ≠ React**: `src/engine` must not import React, DOM, or browser APIs.
2. **Events are typed**: extend `EventBase<Data>`; dispatch via `engine.dispatchEvent`.
3. **Commands are typed**: extend `CommandBase`; queue via `engine.addCommand`.
4. **Node reindexing**: when a component changes, call `engine.reindexEntity(entity)`.
5. **Cleanup**: systems must unsubscribe/unregister in `removeFromEngine`; `Game` calls `destruct()`.
6. **Worker isolation**: heavy simulation (industry tick) runs in Web Workers; main thread merges patches.

## Project Structure

```
colonies-game/src/
├── engine/          # Pure TS — no React, DOM, or browser APIs
│   ├── core/        # World, Engine interface
│   ├── entities/    # Entity, EntityComponent, EntityNode, SceneNode
│   ├── systems/     # Engine systems (viewport, orbit, date, button, pointer)
│   │   ├── viewportSystem/   # Rendering root + input handler + post-process
│   │   └── orbitSystem/      # Kepler solver + orbital trig
│   ├── components/  # Primitive components (position, color, radius, orbit, size, mass, texture, …)
│   ├── lib/         # ECS plumbing (registries, buses, queues, debug manager)
│   └── modifier.ts  # Modifier interface (stub)
├── game/            # Game logic — depends on engine
│   ├── game.ts      # Bootstrap + RAF loop + BodyBlueprint registry
│   ├── constants.ts # UNIVERSE_SCALE, camera, Kepler, colony types
│   ├── systems/     # Game systems (industry, selection, cursor, move, trade, migration, camera follow, debug, …)
│   ├── factories/   # Entity creators (star, colony, spaceship, solar system, textures)
│   ├── data/        # Static game data (4 solar systems, goods, population, tribes, factories)
│   ├── components/  # Game-specific components (industry, vessel, jump, trade, migration, buildable, asteroid, rotation, path)
│   ├── events/      # Typed events (trade, migration)
│   ├── commands/    # Typed commands (trade, migration, upgrade, debug)
│   ├── workers/     # Web Worker for industry tick + input/patch/result types
│   ├── ai/          # AI player stub
│   └── utils/       # Pathfinder, orbital helpers
├── lib/             # Shared utilities (camera, calendar, linked list, PRNG, vectors)
├── hooks/           # React hooks (useGameContext, useGameEvent, useGameDate, useSelectionChanged, useGameRerender)
├── components/      # React UI components (header, data window, modals, icons, map)
├── App.tsx          # React root + DOM ↔ Engine bridge
└── main.tsx
```

Module aliases (Vite):
- `@engine/*` → `src/engine/**`
- `@game/*` → `src/game/**`
- `@/engine/*` → `src/engine/**`

## Data Flow

React mouse events → Engine `dispatchEvent` → EventBus → System handlers
→ CommandBus → `RedrawCommand` → `ViewportSystem` → Canvas render

Update loop: `requestAnimationFrame` → `World.update(dt)` → EventBus dispatch/handlers → SystemRegistry update → EventBus done.

## React Hooks

| Hook | Purpose |
|------|---------|
| `useGameContext` | `use(GameContext)` → `Engine \| null` |
| `useGameEvent` | Subscribes to an `EventBase` subclass, cleans up on unmount |
| `useGameDate` | Polls `DateNode.date.ms` via `setInterval` (event path commented out) |
| `useSelectionChanged` | Fires callback when `SelectionChangedEvent` fires |
| `useGameRerender` | Stub — event-based rerender commented out |

## Rendering

- `ViewportSystem` clears canvas, draws starfield + nebulas, optionally orbits, then iterates registered renderers.
- Renderers project nodes, sort by depth, draw. Light-emitting entities get bloom pass on a separate canvas.
- Post-processing: bloom, color grading, vignette.
- Camera: 3D camera with zoom/pan/rotate/yaw/pitch (`src/lib/camera.ts`).

## Procedural Textures

The game uses runtime-generated 128×128 canvas textures for stars and planets, created with domain-warped Perlin/FBM noise.

- `src/game/factories/createCircleTextures.ts` — `createPlanetTexture(baseColor, archetype)` and `createStarTexture(baseColor)`
- `baseColor` acts only as a tint on archetype-specific palettes (`PALETTES`), tinted at reduced strengths: land/ocean 35%, clouds 20%, poles/atmosphere 15%
- Seeded permutation tables from `seedFrom(baseColor, archetype)` make textures deterministic per body
- `TextureComponent` carries the canvas texture and `animationSpeed`; textures are attached in `createBody.ts`
- Guard texture creation with `typeof document !== "undefined"` for SSR/vitest compatibility
- There are only ~30 unique rendered bodies, so texture generation cost is negligible

## Industry Simulation

- `IndustrySystem` batches `IndustryNode` data into `IndustryTickInput[]` and sends to a Web Worker pool.
- Worker returns `IndustryTickPatch[]` — shallow diffs of only changed fields.
- Main thread merges patches into `IndustryComponent` and dispatches `IndustryUpdatedEvent`.

## Trade & Migration

- Typed commands: `CreateTradeRouteCommand`, `CancelTradeRouteCommand`, `CreateMigrationRouteCommand`, `CancelMigrationRouteCommand`.
- `TradeSystem` and `MigrationSystem` manage route lifecycles.
- `AutoTradeSystem` evaluates surplus/deficit every day and auto-creates routes.

## Jump Navigation

- `JumpNodeComponent` + `JumpGraphComponent` (adjacency Map) model jump routes.
- `MapSystem` builds the hex/waypoint grid and jump graph from `gameData`.
- Debug flags expose jump graph visualization.

## Relevant Files

- `colonies-game/src/engine/core/world.ts` — central orchestrator
- `colonies-game/src/engine/core/engine.ts` — engine interface
- `colonies-game/src/engine/lib/*.ts` — ECS plumbing
- `colonies-game/src/engine/components/*.ts` — component definitions
- `colonies-game/src/engine/components/textureComponent.ts` — texture + animation speed
- `colonies-game/src/engine/systems/*.ts` — engine systems
- `colonies-game/src/engine/systems/viewportSystem/renderers/circleRenderer.ts` — draws texture clipped to circle before fill/shade
- `colonies-game/src/engine/systems/viewportSystem/renderers/circleNode.ts` — holds optional `texture` component
- `colonies-game/src/game/game.ts` — game bootstrap + RAF loop
- `colonies-game/src/game/systems/*.ts` — game systems
- `colonies-game/src/game/factories/createCircleTextures.ts` — Perlin noise texture generators
- `colonies-game/src/game/factories/createBody.ts` — attaches textures to stars and planets
- `colonies-game/src/App.tsx` — React root + DOM ↔ Engine bridge


## Notes

- Use TWO_PI instead of 2 * Math.PI
- Use `engine.registerNodeType` to register node types
- Use `engine.reindexEntity` to reindex an entity
- Use `engine.addCommand` to queue a command
- About 30 unique rendered bodies, so texture generation cost is negligible

## Known Issues

- Some engine-layer code imports game-domain constants and systems: `src/engine/systems/viewportSystem/` imports `TWO_PI` from `@/game/constants`, and `src/engine/systems/pointerInteractionSystem.ts` imports game systems. These break the `Engine ≠ React` layering rule and should be moved or reversed before treating engine as fully standalone.
