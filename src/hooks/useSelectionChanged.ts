import { useGameEvent } from "./useGameEvent"
import { SelectionChangedEvent } from "@/engine/lib/events"
import type { Entity } from "@/engine/entities/entity"

export function useSelectionChanged(onChange: (entity?: Entity) => void) {
  const handler = (payload: { data?: Entity, type: string }) => {
    onChange(payload.data)
  }

  useGameEvent(SelectionChangedEvent, handler)
}
