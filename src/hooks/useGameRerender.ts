import { useState } from "react"
// import { useGameEvent } from "./useGameEvent"
// import { UpdateDoneEvent } from "@/engine/lib/events"

export function useGameRerender() {
  const [, setValue] = useState(true)
  const rerender = () => {
    setValue(p => !p)
  }

  //useGameEvent(UpdateDoneEvent, rerender)

  return rerender
}
