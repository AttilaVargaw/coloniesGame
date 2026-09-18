# AGENTS.md — Colonies Game

## Project

Space-themed strategy game built with React + Tauri. Custom 2D ECS engine renders solar systems on `<canvas>`.

- Root: `/Users/attilavarga/codes/coloniesGame`
- App: `colonies-game/`
- See `ARCHITECTURE.md` for layered ECS + React bridge design.

## Tech Stack

- React 19, TypeScript 6.0, Tailwind CSS 4
- Vite 8, Vitest 4, ESLint 9 + Oxlint
- Tauri 2 (desktop shell)
- Workspace package manager: **pnpm**

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

- ESLint 9 flat config + Oxlint; strict (`--max-warnings 0`)
- Oxlint runs first for fast feedback; ESLint handles remaining rules
- TypeScript strict mode; `tsc` runs as part of `build`
- Fixable issues: `pnpm lint:fix`

## Code Conventions

- TypeScript with strict settings; prefer `type` imports where possible
- Module aliases (Vite):
  - `@engine/*` → `src/engine/**`
  - `@game/*` → `src/game/**`
  - `@/engine/*` → `src/engine/**`
- Engine layer (`src/engine/**`) has no React dependency
- Game/UI layers import from `colonies-game/src` using the above aliases
- Systems extend `System` or `SystemWithNodes`; register node types via `engine.registerNodeType`
- Components are classes stored in `Entity` keyed by constructor
- Scene graph uses `SceneNode` parent/children; world position via accumulation

## Architecture Rules

1. **Engine ≠ React**: `src/engine` must not import React, DOM, or browser APIs.
2. **Events are typed**: extend `EventBase<Data>`; dispatch via `engine.dispatchEvent`.
3. **Commands are typed**: extend `CommandBase`; queue via `engine.addCommand`.
4. **Node reindexing**: when a component changes, call `engine.reindexEntity(entity)`.
5. **Cleanup**: systems must unsubscribe/unregister in `removeFromEngine`; `Game` calls `destruct()`.

## Project Structure

```
colonies-game/src/
├── engine/          # Pure TS — no React, DOM, or browser APIs
│   ├── core/        # World, Engine interface
│   ├── entities/    # Entity, EntityComponent, EntityNode, SceneNode
│   ├── systems/     # Engine systems (viewport, orbit, date, button)
│   ├── components/  # Primitive components (position, color, radius, orbit, …)
│   ├── lib/         # ECS plumbing (registries, buses, queues)
├── game/            # Game logic — depends on engine
│   ├── game.ts      # Bootstrap + RAF loop
│   ├── systems/     # Game systems (industry, selection, cursor, move, …)
│   ├── factories/   # Entity creators (star, colony, spaceship, solar system)
│   ├── data/        # Static game data
│   ├── components/  # Game-specific components
├── lib/             # Shared utilities (camera, pathfinder, calendar, …)
├── App.tsx          # React root + DOM ↔ Engine bridge
└── components/      # React UI components
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
| `useGameContext` | `useContext(GameContext)` → `Engine \| null` |
| `useGameEvent` | Subscribes to an `EventBase` subclass, cleans up on unmount |
| `useGameDate` | Reads `DateNode.date.ms` on `DayPassedEvent` |
| `useSelectionChanged` | Fires callback when `SelectionChangedEvent` fires |

## Relevant Files

- `colonies-game/src/engine/core/world.ts` — central orchestrator
- `colonies-game/src/engine/core/engine.ts` — engine interface
- `colonies-game/src/engine/lib/*.ts` — ECS plumbing
- `colonies-game/src/engine/components/*.ts` — component definitions
- `colonies-game/src/engine/systems/*.ts` — engine systems
- `colonies-game/src/game/game.ts` — game bootstrap + RAF loop
- `colonies-game/src/game/systems/*.ts` — game systems
- `colonies-game/src/App.tsx` — React root + DOM ↔ Engine bridge


## Notes

- Use TWO_PI instead of 2 * Math.PI
- Use `engine.registerNodeType` to register node types
- Use `engine.reindexEntity` to reindex an entity
- Use `engine.addCommand` to queue a command