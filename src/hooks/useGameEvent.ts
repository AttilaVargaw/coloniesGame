/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from "react"
import { useGameEngine } from "./useGameContext"
import type { EventBase } from "@/engine/lib/events"

export function useGameEvent<T extends EventBase>(
  event: new (...args: any[]) => T,
  callback: (data: T["data"]) => void
) {
  const engine = useGameEngine()

  useEffect(() => {
    if(!engine) return
    const currentEngine = engine
    currentEngine.subscribe(event, callback)
    return () => {
      currentEngine.unsubscribe(event, callback)
    }
  }, [engine, event, callback])
}
