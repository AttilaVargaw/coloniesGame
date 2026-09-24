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

const rng = mulberry32(99)

interface NebulaCloud {
    x: number
    y: number
    z: number
    radius: number
    color: string
}

const NEBULA_PALETTE = [
    "rgba(120, 40, 180, 0.07)",
    "rgba(40, 100, 200, 0.06)",
    "rgba(200, 60, 60, 0.05)",
    "rgba(40, 180, 120, 0.05)",
    "rgba(200, 140, 40, 0.05)",
    "rgba(80, 60, 160, 0.06)",
    "rgba(40, 160, 160, 0.05)",
    "rgba(180, 40, 100, 0.05)",
] as const

const nebulas: NebulaCloud[] = Array.from({ length: 10 }, () => ({
    x: (rng() - 0.5) * 240000,
    y: (rng() - 0.5) * 240000,
    z: (rng() - 0.5) * 200000,
    radius: 20000 + rng() * 40000,
    color: NEBULA_PALETTE[Math.floor(rng() * NEBULA_PALETTE.length)],
}))

export function drawNebulas(ctx: CanvasRenderingContext2D, camera: Camera) {
    ctx.save()
    ctx.globalCompositeOperation = "screen"

    for(const n of nebulas) {
        const projected = camera.project(n.x, n.y, n.z)
        if(!projected) continue

        const screenRadius = n.radius * projected.scale
        if(screenRadius < 8) continue

        const gradient = ctx.createRadialGradient(
            projected.x, projected.y, 0,
            projected.x, projected.y, screenRadius
        )
        gradient.addColorStop(0, n.color)
        gradient.addColorStop(1, "transparent")

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(projected.x, projected.y, screenRadius, 0, Math.PI * 2)
        ctx.fill()
    }

    ctx.restore()
}
