export function shallowObjectsEqual(a: Record<string, number>, b: Record<string, number>): boolean {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if(keysA.length !== keysB.length) return false;
    for(const key of keysA) {
        if(a[key] !== b[key]) return false;
    }
    return true;
}
