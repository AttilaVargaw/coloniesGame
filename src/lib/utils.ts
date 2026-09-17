import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function sumValues(o: { [key: string]: number }) {
    return Object.values(o).reduce((acc, value) => acc + value, 0)
}

export function convertToReadable(n: number) {
    if(Math.abs(n) > 1000000000) {
        return `${(n / 1000000000).toFixed(1)}B`;
    } else if(n > 1000000) {
        return `${(n / 1000000).toFixed(1)}M`;
    } else if(n > 1000) {
        return `${(n / 1000).toFixed(1)}K`;
    } else {
        return n.toFixed(0);
    }
}
