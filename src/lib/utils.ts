export function convertToReadable(n: number) {
    const abs = Math.abs(n);

    if(abs > 1000_000_000) {
        return `${(n / 1_000_000_000).toFixed(1)}B`;
    } else if(abs > 1_000_000) {
        return `${(n / 1_000_000).toFixed(1)}M`;
    } else if(abs > 1_000) {
        return `${(n / 1_000).toFixed(1)}K`;
    } else {
        return abs.toFixed(0);
    }
}
