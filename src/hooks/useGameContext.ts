import { createContext, useContext } from "react"
import type { Engine } from "@/engine/core/engine"

export const GameContext = createContext<Engine | null>(null)

export function useGameEngine(): Engine | null {
  return useContext(GameContext)
}
