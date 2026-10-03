import { useEffect, useRef } from "react"
import { useGameEngine } from "./useGameContext"
import type { EventBase } from "@/engine/lib/events"

export function useGameEvent<T extends EventBase>(
  event: new (...args: any[]) => T,
  callback: (data: T["data"]) => void
) {
  const engine = useGameEngine()
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!engine) return
    const currentEngine = engine
    const stableCallback = (data: unknown) => callbackRef.current(data as T["data"])
    currentEngine.subscribe(event, stableCallback)
    return () => {
      currentEngine.unsubscribe(event, stableCallback)
    }
  }, [engine, event])
}
