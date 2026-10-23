const DB_NAME = "ColoniesGame"
const DB_VERSION = 1
const STORE_NAME = "textures"

let dbPromise: Promise<IDBDatabase> | null = null

const memoryCache = new Map<string, ImageBitmap>()

function isIndexedDBAvailable(): boolean {
    return typeof indexedDB !== "undefined" && typeof createImageBitmap !== "undefined"
}

function getDB(): Promise<IDBDatabase> | null {
    if(!isIndexedDBAvailable()) return null
    if(dbPromise) return dbPromise

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result)
        request.onupgradeneeded = () => {
            const db = request.result
            if(!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME)
            }
        }
    })

    return dbPromise
}

function cacheKey(
    textureType: string,
    baseColor: string,
    archetype?: string,
    seedKey?: string
): string {
    return `${textureType}|${baseColor}|${archetype ?? ""}|${seedKey ?? ""}`
}

export async function getCachedTexture(
    textureType: string,
    baseColor: string,
    archetype: string | undefined,
    seedKey: string | undefined
): Promise<ImageBitmap | null> {
    const key = cacheKey(textureType, baseColor, archetype, seedKey)

    const cached = memoryCache.get(key)
    if(cached) return cached

    const db = await getDB()
    if(!db) return null

    try {
        const tx = db.transaction(STORE_NAME, "readonly")
        const store = tx.objectStore(STORE_NAME)
        const blob = await new Promise<Blob | null>((resolve, reject) => {
            const req = store.get(key)
            req.onsuccess = () => resolve(req.result as Blob | null)
            req.onerror = () => reject(req.error)
        })

        if(!blob) return null
        const bitmap = await createImageBitmap(blob)
        memoryCache.set(key, bitmap)
        return bitmap
    } catch {
        return null
    }
}

export async function setCachedTexture(
    textureType: string,
    baseColor: string,
    archetype: string | undefined,
    seedKey: string | undefined,
    bitmap: ImageBitmap
): Promise<void> {
    const key = cacheKey(textureType, baseColor, archetype, seedKey)
    memoryCache.set(key, bitmap)

    const db = await getDB()
    if(!db) return

    try {
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
        const ctx = canvas.getContext("2d")!
        ctx.drawImage(bitmap, 0, 0)
        const blob = await canvas.convertToBlob()

        const tx = db.transaction(STORE_NAME, "readwrite")
        const store = tx.objectStore(STORE_NAME)

        await new Promise<void>((resolve, reject) => {
            const req = store.put(
                blob,
                key
            )
            req.onsuccess = () => resolve()
            req.onerror = () => reject(req.error)
        })
    } catch {
        // Cache is optional — silently fail
    }
}

export function clearTextureCache(): void {
    for(const bitmap of memoryCache.values()) {
        bitmap.close()
    }
    memoryCache.clear()
}
