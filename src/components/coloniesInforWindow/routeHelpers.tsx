import { LabelComponent } from "@engine/components/label"
import { useGameEngine } from "@/hooks/useGameContext"
import { useCallback } from "react"

export function useEntityName() {
  const engine = useGameEngine()

  return useCallback((entityId: string) => {
    if (!engine) return entityId
    const e = engine.getEntityById(entityId)
    return e?.getComponent(LabelComponent)?.text || entityId
  }, [engine])
}

export function CancelRouteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-1 text-xs bg-red-900/50 hover:bg-red-800/50 rounded border border-red-700/50"
    >
      Cancel Route
    </button>
  )
}
