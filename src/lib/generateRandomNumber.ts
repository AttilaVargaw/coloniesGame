export function generateRandomNumber(from: number, to: number, integer = false) {
    const value = Math.random() * (to - from) + from;
    return integer ? Math.floor(value) : value;
}
