import { useEffect } from "react"
import { useGameEngine } from "./useGameContext"
import type { EventBase } from "@/engine/lib/events"

export function useGameEvent<T extends EventBase>(
  event: new (...args: any[]) => T,
  callback: (data: T["data"]) => void
) {
  const engine = useGameEngine()

  useEffect(() => {
    engine.subscribe(event, callback)

    return () => {
      engine.unsubscribe(event, callback)
    }
  }, [engine, event, callback])
}
