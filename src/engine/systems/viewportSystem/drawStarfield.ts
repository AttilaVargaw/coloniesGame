import { TWO_PI } from "@/engine/lib/cameraConstants";
import Camera from "@/lib/camera";
import chroma from "chroma-js";
import { mulberry32 } from "./mulberry32";

const rng = mulberry32(42)

const STAR_COLORS = [
    "#ffffff",
    "#fff8e7",
    "#e7f0ff",
    "#ffd2a1",
    "#a1c2ff",
    "#ffb4a2",
] as const

const createStarfield = (count: number) => {
    return Array.from({ length: count }, () => {
        const theta = rng() * Math.PI * 2
        const phi = Math.acos(2 * rng() - 1)
        const r = 50000 + rng() * 150000
        return {
            x: r * Math.sin(phi) * Math.cos(theta),
            y: r * Math.sin(phi) * Math.sin(theta),
            z: r * Math.cos(phi),
            r: 0.5 + rng() * 1.0,
            opacity: 0.3 + rng() * 0.6,
            color: STAR_COLORS[Math.floor(rng() * STAR_COLORS.length)],
        }
    })
}

const starfield = createStarfield(512)

export function drawStarfield(ctx: CanvasRenderingContext2D, camera: Camera) {
    ctx.save();

    const cores: { x: number; y: number; r: number; color: string; alpha: number }[] = []
    const glow: { x: number; y: number; r: number; color: string; alpha: number }[] = []

    for(const s of starfield) {
        const projected = camera.project([s.x, s.y, s.z]);
        if(!projected) {
            continue;
        }
        const alpha = s.opacity * Math.min(1, projected.scale * 80);
        const radius = Math.max(0.5, Math.min(3, s.r * projected.scale * 200));

        if(alpha > 0.6 && radius > 1.5) {
            const glowAlpha = (alpha - 0.6) * 0.4;
            const glowRadius = radius * 4;
            glow.push({ x: projected.x, y: projected.y, r: glowRadius, color: s.color, alpha: glowAlpha });
        }

        cores.push({ x: projected.x, y: projected.y, r: radius, color: s.color, alpha })
    }

    const drawGlow = (stars: { x: number; y: number; r: number; color: string; alpha: number }[]) => {
        ctx.globalCompositeOperation = "screen"
        for(const star of stars) {
            const gradient = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.r)
            const [gr, gg, gb, ga] = chroma(star.color).alpha(star.alpha * 0.6).rgba()
            gradient.addColorStop(0, `rgba(${gr},${gg},${gb},${ga})`)
            const [br, bg, bb, ba] = chroma(star.color).alpha(star.alpha * 0.2).rgba()
            gradient.addColorStop(0.4, `rgba(${br},${bg},${bb},${ba})`)
            gradient.addColorStop(1, "rgba(0,0,0,0)")
            ctx.fillStyle = gradient
            ctx.beginPath()
            ctx.arc(star.x, star.y, star.r, 0, TWO_PI)
            ctx.fill()
        }
    }

    const drawStar = (stars: { x: number; y: number; r: number; color: string; alpha: number }[]) => {
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = "source-over"
        for(const star of stars) {
            ctx.globalAlpha = star.alpha
            ctx.fillStyle = star.color
            ctx.strokeStyle = star.color
            ctx.lineWidth = Math.max(0.5, star.r * 0.15)
            if(star.r > 1.2 && star.alpha > 0.55) {
                const len = star.r * 3.5
                ctx.beginPath()
                ctx.moveTo(star.x - len, star.y)
                ctx.lineTo(star.x + len, star.y)
                ctx.moveTo(star.x, star.y - len)
                ctx.lineTo(star.x, star.y + len)
                ctx.stroke()
            }
            ctx.beginPath()
            ctx.arc(star.x, star.y, star.r, 0, TWO_PI)
            ctx.fill()
        }
    }

    drawGlow(glow)
    drawStar(cores)

    ctx.restore();
}
