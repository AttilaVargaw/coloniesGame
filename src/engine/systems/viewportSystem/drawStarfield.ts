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
        }
    })
}

const starfield = createStarfield(512)

export function drawStarfield(ctx: CanvasRenderingContext2D, camera: Camera) {
    ctx.save();
    ctx.fillStyle = "#ffffff";

    const buckets = new Map<number, { x: number; y: number; r: number; }[]>();
    const glowBuckets = new Map<number, { x: number; y: number; r: number; }[]>();
    for(const s of starfield) {
        const projected = camera.project(s.x, s.y, s.z);
        if(!projected) {
            continue;
        }
        const alpha = s.opacity * Math.min(1, projected.scale * 80);
        const radius = Math.max(0.5, Math.min(3, s.r * projected.scale * 200));
        const bucket = Math.round(alpha * 10) / 10;

        if(!buckets.has(bucket)) buckets.set(bucket, []);
        buckets.get(bucket)!.push({ x: projected.x, y: projected.y, r: radius });

        if(alpha > 0.6 && radius > 1.5) {
            const glowAlpha = (alpha - 0.6) * 0.4;
            const glowRadius = radius * 4;
            const glowBucket = Math.round(glowAlpha * 10) / 10;
            if(!glowBuckets.has(glowBucket)) glowBuckets.set(glowBucket, []);
            glowBuckets.get(glowBucket)!.push({ x: projected.x, y: projected.y, r: glowRadius });
        }
    }

    const drawBucket = (stars: { x: number; y: number; r: number; }[], alpha: number) => {
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        for(const star of stars) {
            ctx.moveTo(star.x + star.r, star.y);
            ctx.arc(star.x, star.y, star.r, 0, TWO_PI);
        }
        ctx.fill();
    };

    for(const [alpha, stars] of glowBuckets) drawBucket(stars, alpha);
    for(const [alpha, stars] of buckets) drawBucket(stars, alpha);

    ctx.restore();
}
