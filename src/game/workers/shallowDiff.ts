export function shallowDiff<T extends Record<string, any>>(oldObj: T | undefined, newObj: T): Partial<T> | null {
    if(!oldObj) return newObj;
    const changed: Partial<T> = {};
    let hasChanged = false;
    for(const key in newObj) {
        if(oldObj[key as keyof T] !== newObj[key as keyof T]) {
            changed[key as keyof T] = newObj[key as keyof T];
            hasChanged = true;
        }
    }
    return hasChanged ? changed : null;
}
