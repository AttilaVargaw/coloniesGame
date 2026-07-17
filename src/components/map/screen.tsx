import { Engine } from '@/ems/engine';
import { MouseEvent, ComponentPropsWithRef, useLayoutEffect } from 'react';

function getCursorPosition(canvas: HTMLCanvasElement, event: MouseEvent<HTMLCanvasElement>) {
    const rect = canvas.getBoundingClientRect()
    const x = event.pageX - rect.left
    const y = event.pageY - rect.top

    return { x, y, event }
}

export function Screen({ onClick, onMouseMove, onMouseDown, onMouseUp, engine, ref }: ComponentPropsWithRef<"canvas"> & {
    onClick: (event: { x: number, y: number, event: MouseEvent }) => void,
    onMouseMove: (event: { x: number, y: number, event: MouseEvent }) => void,
    onMouseDown: (event: { x: number, y: number, event: MouseEvent }) => void,
    onMouseUp: (event: { x: number, y: number, event: MouseEvent }) => void,
    engine: Engine | null
}) {
    useLayoutEffect(() => {
        function resize() {
            //I'm not planning to use a function here at the moment
            if(typeof ref === "function" || !ref?.current) {
                return
            }

            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const width = window.innerWidth;
            const height = window.innerHeight;

            ref.current.width = width * dpr;
            ref.current.height = (height - 56) * dpr;
            ref.current.style.width = `${width}px"`;
            ref.current.style.height = `${height - 56}px`;

            const ctx = ref.current.getContext('2d', {
                alpha: true,
                desynchronized: true,
                colorSpace: "srgb",
            })!
            ctx.scale(dpr, dpr);

            if(engine) {
                engine.commands.get("redraw")!.push({ name: "redraw", data: {} })
            }
        }

        resize()

        window.addEventListener('resize', resize)

        return () => {
            window.removeEventListener('resize', resize)
        }
    }, [engine])


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

    // @TODO refactor
    return <canvas
        ref={ref}
        style={{ imageRendering: "crisp-edges" }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleClick} />;
}