import { PointerEventData, ClickEventData, MousedownEvent, MouseupEvent, MousemoveEvent, ContextMenuEvent } from '@/engine/lib/events';
import { MouseEvent, useLayoutEffect, useRef } from 'react';

function toPointerData(event: MouseEvent<HTMLCanvasElement>): PointerEventData {
    const { nativeEvent } = event
    return {
        x: nativeEvent.offsetX,
        y: nativeEvent.offsetY,
        button: nativeEvent.button,
        shiftKey: nativeEvent.shiftKey,
        ctrlKey: nativeEvent.ctrlKey,
        altKey: nativeEvent.altKey,
        metaKey: nativeEvent.metaKey,
        preventDefault: () => nativeEvent.preventDefault(),
        stopPropagation: () => nativeEvent.stopPropagation(),
        type: nativeEvent.type,
        timeStamp: nativeEvent.timeStamp,
        isTrusted: nativeEvent.isTrusted,
    }
}

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
        onContextMenu?.(new ContextMenuEvent({ x: event.nativeEvent.offsetX, y: event.nativeEvent.offsetY }))
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
