import { createContext, useContext } from "react"
import type { Engine } from "@/engine/core/engine"

export const GameContext = createContext<Engine | null>(null)

export function useGameEngine(): Engine {
  const engine = useContext(GameContext)
  if(!engine) {
    throw new Error("useGameEngine must be used within GameContext.Provider")
  }
  return engine
}
