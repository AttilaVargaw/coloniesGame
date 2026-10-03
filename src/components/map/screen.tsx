import { PointerEventData, ClickEventData, MousedownEvent, MouseupEvent, MousemoveEvent, ContextMenuEvent } from '@/engine/lib/events';
import { MouseEvent, useLayoutEffect, useRef } from 'react';

function toPointerData(event: MouseEvent): PointerEventData {
    return {
        x: event.clientX,
        y: event.clientY,
        button: event.button,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        preventDefault: () => event.preventDefault(),
        stopPropagation: () => event.stopPropagation(),
        type: event.type,
        timeStamp: event.timeStamp,
        isTrusted: event.isTrusted,
    }
}

interface RenderingContextSettings {
    alpha: boolean
    desynchronized: boolean
    colorSpace: string
}

export const renderingContextSettings: RenderingContextSettings = {
    alpha: false,
    desynchronized: true,
    colorSpace: "srgb",
} as const

interface ScreenProps {
    onClick: (event: ClickEventData) => void,
    onMouseMove: (event: MousemoveEvent) => void,
    onMouseDown: (event: MousedownEvent) => void,
    onMouseUp: (event: MouseupEvent) => void,
    onContextMenu?: (event: ContextMenuEvent) => void,
}

export function Screen({ onClick, onMouseMove, onMouseDown, onMouseUp, onContextMenu }: ScreenProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useLayoutEffect(() => {
        function resize() {
            if (!canvasRef?.current) {
                return
            }

            const container = document.getElementsByClassName('screenContainer')[0] as HTMLDivElement | undefined
            if (!container) {
                return
            }

            const dpr = Math.min(window.devicePixelRatio || 1, 2)

            const { clientWidth } = container
            const width = clientWidth
            const height = window.innerHeight

            canvasRef.current.width = width * dpr
            canvasRef.current.height = (height - 76) * dpr
            canvasRef.current.style.width = `${width}px`
            canvasRef.current.style.height = `${height - 76}px`
            const ctx = canvasRef.current.getContext('2d')
            ctx?.resetTransform()
            ctx?.scale(dpr, dpr)
        }

        resize()

        const observer = new ResizeObserver(() => resize())

        const container = document.getElementsByClassName('screenContainer')[0] as HTMLDivElement | undefined

        if (container) {
            observer.observe(container)
        }

        window.addEventListener('resize', resize)

        return () => {
            window.removeEventListener('resize', resize)
            observer.disconnect()
        }
    }, [])

    const handleClick = (event: MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef?.current) {
            return
        }
        onClick(new ClickEventData(toPointerData(event)))
    }

    const handleMouseMove = (event: MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef?.current) {
            return
        }
        onMouseMove(new MousemoveEvent(toPointerData(event)))
    }

    const handleMouseDown = (event: MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef?.current) {
            return
        }
        onMouseDown(new MousedownEvent(toPointerData(event)))
    }

    const handleMouseUp = (event: MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef?.current) {
            return
        }
        onMouseUp(new MouseupEvent(toPointerData(event)))
    }

    const handleContextMenu = (event: MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef?.current) {
            return
        }
        event.preventDefault()
        onContextMenu?.(new ContextMenuEvent({ x: event.clientX, y: event.clientY }))
    }

    return <>
        <canvas
            id="2dCanvas"
            ref={canvasRef}
            style={{ imageRendering: "crisp-edges" }}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onClick={handleClick}
            onContextMenu={handleContextMenu} />
    </>
}
