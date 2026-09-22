export function getLowestRatio(
    requirements: Record<string, number>,
    getAvailable: (key: string) => number,
    level: number,
    workerRatio: number
): number {
    const ratios: Record<string, number> = {}

    for (const [key, requirement] of Object.entries(requirements)) {
        const available = getAvailable(key)
        const t = available - requirement * level * workerRatio

        if (t > 0) {
            ratios[key] = 1
        } else {
            ratios[key] = Math.max(0, available / (requirement * level * workerRatio))
        }
    }

    const entries = Object.entries(ratios)
    if (entries.length === 0) return 1

    return Math.max(0, Math.min(...entries.map(([, v]) => v), 1))
}
