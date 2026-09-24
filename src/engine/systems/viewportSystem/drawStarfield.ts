import { TWO_PI } from "@/game/constants";
import Camera from "@/lib/camera";

const mulberry32 = (seed: number) => {
    seed |= 0
    return () => {
        seed = seed + 0x6D2B79F5 | 0
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
        return ((t ^ t >>> 14) >>> 0) / 4294967296
    }
}

const rng = mulberry32(42)
const STAR_COLORS = [
    "#ffffff",
    "#fff8e7",
    "#e7f0ff",
    "#ffd2a1",
    "#a1c2ff",
    "#ffb4a2",
]

function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${alpha})`
}

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
        const projected = camera.project(s.x, s.y, s.z);
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
            gradient.addColorStop(0, hexToRgba(star.color, star.alpha * 0.6))
            gradient.addColorStop(0.4, hexToRgba(star.color, star.alpha * 0.2))
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
            ctx.beginPath()
            ctx.arc(star.x, star.y, star.r, 0, TWO_PI)
            ctx.fill()
        }
    }

    drawGlow(glow)
    drawStar(cores)

    ctx.restore();
}
