import { useState, useEffect, useCallback } from "react"
import { useGameEvent } from "@/hooks/useGameEvent"
import { ContextMenuOpenEvent } from "@/engine/lib/events"
import { ClickableComponent, ContextMenuItems } from "@/engine/components/clickableComponent"

const RADIUS = 70

export function CircularContextMenu() {
    const [open, setOpen] = useState(false)
    const [position, setPosition] = useState<{ x: number, y: number } | null>(null)
    const [items, setItems] = useState<ContextMenuItems[]>([])

    const handleOpen = useCallback(({ entity, screenX, screenY }: { entity: any, screenX: number, screenY: number }) => {
        const clickable = entity.getComponent(ClickableComponent)
        if(!clickable?.contextMenuItems || clickable.contextMenuItems.length === 0) {
            return
        }

        setPosition({ x: screenX, y: screenY })
        setItems(clickable.contextMenuItems)
        setOpen(true)
    }, [])

    useGameEvent(ContextMenuOpenEvent, handleOpen)

    useEffect(() => {
        if(!open) return

        const close = () => setOpen(false)
        window.addEventListener("click", close)
        window.addEventListener("contextmenu", close)
        return () => {
            window.removeEventListener("click", close)
            window.removeEventListener("contextmenu", close)
        }
    }, [open])

    if(!open || !position) return null

    return (
        <div className="fixed inset-0 z-50">
            {items.map(({ label, id }, i) => {
                const angle = (i / items.length) * Math.PI * 2 - Math.PI / 2
                const x = position.x + Math.cos(angle) * RADIUS
                const y = (position.y + Math.sin(angle) * RADIUS) + RADIUS

                return (
                    <button
                        key={id}
                        className="absolute px-2 py-1 bg-black/80 text-white text-xs rounded border border-white/20 hover:bg-white/10"
                        style={{
                            left: x,
                            top: y,
                            transform: "translate(-50%, -50%)",
                        }}
                        onClick={(e) => {
                            e.stopPropagation()
                            setOpen(false)
                        }}
                    >
                        {label}
                    </button>
                )
            })}
        </div>
    )
}
