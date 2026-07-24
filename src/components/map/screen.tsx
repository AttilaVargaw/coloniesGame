import { MouseEventData } from '@/engine/lib/events';
import { MouseEvent, ComponentPropsWithRef, useLayoutEffect } from 'react';

function getCursorPosition(canvas: HTMLCanvasElement, event: MouseEvent<HTMLCanvasElement>) {
    const rect = canvas.getBoundingClientRect()
    const x = event.pageX - rect.left
    const y = event.pageY - rect.top

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
}

export function Screen({ onClick, onMouseMove, onMouseDown, onMouseUp, triggerRedraw, ref }: ComponentPropsWithRef<"canvas"> & {
    onClick: (event: MouseEventData) => void,
    onMouseMove: (event: MouseEventData) => void,
    onMouseDown: (event: MouseEventData) => void,
    onMouseUp: (event: MouseEventData) => void,
    triggerRedraw: () => void
}) {
    useLayoutEffect(() => {
        function resize() {
            if(typeof ref === "function" || !ref?.current) {
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

            ref.current.width = width * dpr;
            ref.current.height = (height - 56) * dpr;
            ref.current.style.width = `${width}px`;
            ref.current.style.height = `${height - 56}px`;
            const ctx = ref.current.getContext('2d')
            ctx?.resetTransform()
            ctx?.scale(dpr, dpr);

            triggerRedraw()
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
    }, [ref, triggerRedraw])


    const handleClick = (event: MouseEvent<HTMLCanvasElement>) => {
        if(typeof ref === "function" || !ref?.current) {
            return
        }
        onClick(getCursorPosition(ref?.current, event))
    }

    const handleMouseMove = (event: MouseEvent<HTMLCanvasElement>) => {
        if(typeof ref === "function" || !ref?.current) {
            return
        }
        onMouseMove(getCursorPosition(ref?.current, event))
    }

    const handleMouseDown = (event: MouseEvent<HTMLCanvasElement>) => {
        if(typeof ref === "function" || !ref?.current) {
            return
        }
        onMouseDown(getCursorPosition(ref?.current, event))
    }

    const handleMouseUp = (event: MouseEvent<HTMLCanvasElement>) => {
        if(typeof ref === "function" || !ref?.current) {
            return
        }
        onMouseUp(getCursorPosition(ref?.current, event))
    }

    return <canvas
        ref={ref}
        style={{ imageRendering: "crisp-edges" }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleClick} />;
}