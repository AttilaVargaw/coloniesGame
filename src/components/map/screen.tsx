import { MouseEventData } from '@/engine/lib/events';
import { MouseEvent, ComponentPropsWithRef, useLayoutEffect, useRef } from 'react';

function getCursorPosition(canvas: HTMLCanvasElement, event: MouseEvent<HTMLCanvasElement>) {
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    return { x, y, ...event }
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

export function Screen({ onClick, onMouseMove, onMouseDown, onMouseUp, onContextMenu, ref }: ComponentPropsWithRef<"div"> & {
    onClick: (event: MouseEventData) => void,
    onMouseMove: (event: MouseEventData) => void,
    onMouseDown: (event: MouseEventData) => void,
    onMouseUp: (event: MouseEventData) => void,
    onContextMenu?: (event: MouseEventData) => void,
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const glCanvasRef = useRef<HTMLCanvasElement>(null)

    useLayoutEffect(() => {
        function resize() {
            if(typeof canvasRef === "function" || !canvasRef?.current) {
                return
            }

            const container = document.getElementsByClassName('screenContainer')[0] as HTMLDivElement | undefined
            if(!container) {
                return
            }

            const dpr = Math.min(window.devicePixelRatio || 1, 2);

            const { clientWidth } = container
            const width = clientWidth
            const height = window.innerHeight;

            canvasRef.current.width = width * dpr;
            canvasRef.current.height = (height - 76) * dpr;
            canvasRef.current.style.width = `${width}px`;
            canvasRef.current.style.height = `${height - 76}px`;
            const ctx = canvasRef.current.getContext('2d')
            ctx?.resetTransform()
            ctx?.scale(dpr, dpr);
        }

        resize()

        const observer = new ResizeObserver(() => resize())

        const container = document.getElementsByClassName('screenContainer')[0] as HTMLDivElement | undefined;

        if(container) {
            observer.observe(container)
        }

        window.addEventListener('resize', resize)

        return () => {
            window.removeEventListener('resize', resize)
            observer.disconnect()
        }
    }, [ref])

    const handleClick = (event: MouseEvent<HTMLCanvasElement>) => {
        if(typeof canvasRef === "function" || !canvasRef?.current) {
            return
        }
        onClick(getCursorPosition(canvasRef?.current, event))
    }

    const handleMouseMove = (event: MouseEvent<HTMLCanvasElement>) => {
        if(typeof canvasRef === "function" || !canvasRef?.current) {
            return
        }
        onMouseMove(getCursorPosition(canvasRef?.current, event))
    }

    const handleMouseDown = (event: MouseEvent<HTMLCanvasElement>) => {
        if(typeof canvasRef === "function" || !canvasRef?.current) {
            return
        }
        onMouseDown(getCursorPosition(canvasRef?.current, event))
    }

    const handleMouseUp = (event: MouseEvent<HTMLCanvasElement>) => {
        if(typeof canvasRef === "function" || !canvasRef?.current) {
            return
        }
        onMouseUp(getCursorPosition(canvasRef?.current, event))
    }

    const handleContextMenu = (event: MouseEvent<HTMLCanvasElement>) => {
        if(typeof canvasRef === "function" || !canvasRef?.current) {
            return
        }
        event.preventDefault()
        onContextMenu?.(getCursorPosition(canvasRef?.current, event))
    }

    return <>
        <canvas style={{ pointerEvents: "none" }} ref={glCanvasRef} id="glCanvas" />
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