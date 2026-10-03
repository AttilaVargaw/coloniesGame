import { useEffect, useState } from "react"
import { useGameEngine } from "./useGameContext"
import { useGameEvent } from "./useGameEvent"
import { DateNode } from "@/engine/systems/DateNode"
import { DayPassedEvent, HourPassedEvent } from "@/engine/lib/events"

export function useGameDate() {
  const [date, setDate] = useState(0)
  const engine = useGameEngine()

  const updateDate = () => {
    if (!engine) return
    const dateNode = engine.getNodeList(DateNode)[0]
    setDate(dateNode.date.ms)
  }

  useEffect(() => {
    if (!engine) return
    updateDate()
  }, [engine])

  useGameEvent(DayPassedEvent, updateDate)
  useGameEvent(HourPassedEvent, updateDate)

  return date
}
