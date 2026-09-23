import { useEffect, useState } from "react"
import { useGameEngine } from "./useGameContext"
import { DateNode } from "@/engine/systems/DateNode"

export function useGameDate() {
  const [date, setDate] = useState(0)
  const engine = useGameEngine()

  const updateDate = () => {
    if(!engine) return
    const dateNode = engine.getNodeList(DateNode)[0]
    setDate(dateNode.date.ms)
  }

  // useGameEvent(DayPassedEvent, updateDate)
  // useGameEvent(HourPassedEvent, updateDate)

  useEffect(() => {
    const interval = setInterval(updateDate, 50)

    return () => clearInterval(interval)
  })

  return date
}
