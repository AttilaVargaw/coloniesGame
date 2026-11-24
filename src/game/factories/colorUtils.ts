function parseColor(color: string): { r: number; g: number; b: number } {
    if (color.startsWith("#")) {
        const hex = color.slice(1)
        if (hex.length === 3) {
            return {
                r: parseInt(hex[0] + hex[0], 16),
                g: parseInt(hex[1] + hex[1], 16),
                b: parseInt(hex[2] + hex[2], 16)
            }
        } else if (hex.length === 6) {
            return {
                r: parseInt(hex.slice(0, 2), 16),
                g: parseInt(hex.slice(2, 4), 16),
                b: parseInt(hex.slice(4, 6), 16)
            }
        }
    }
    throw new Error(`Unsupported color format: ${color}`)
}

function mixColors(
    color1: { r: number; g: number; b: number },
    color2: { r: number; g: number; b: number },
    ratio: number
): { r: number; g: number; b: number } {
    const inv = 1 - ratio
    return {
        r: Math.round(color1.r * inv + color2.r * ratio),
        g: Math.round(color1.g * inv + color2.g * ratio),
        b: Math.round(color1.b * inv + color2.b * ratio)
    }
}

export function chromaParse(color: string): { r: number; g: number; b: number } {
    return parseColor(color)
}

export function chromaMix(
    color1: string | { r: number; g: number; b: number },
    color2: string | { r: number; g: number; b: number },
    ratio: number
): { r: number; g: number; b: number } {
    const c1 = typeof color1 === "string" ? parseColor(color1) : color1
    const c2 = typeof color2 === "string" ? parseColor(color2) : color2
    return mixColors(c1, c2, ratio)
}