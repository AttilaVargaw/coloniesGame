import { useState, useCallback } from "react"
import { useGameEngine } from "./useGameContext"
import { useGameEvent } from "./useGameEvent"
import { DayPassedEvent } from "@/engine/lib/events"
import { DateNode } from "@/engine/systems/DateNode"

export function useGameDate() {
  const [date, setDate] = useState(0)

  const updateDate = useCallback(() => {
    const engine = useGameEngine()
    const dateNode = engine.getNodeList(DateNode)[0]
    setDate(dateNode.date.ms)
  }, [])

  useGameEvent(DayPassedEvent, updateDate)

  return date
}
