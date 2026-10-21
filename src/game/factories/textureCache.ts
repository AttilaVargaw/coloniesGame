const DB_NAME = "ColoniesGame"
const DB_VERSION = 1
const STORE_NAME = "textures"

let dbPromise: Promise<IDBDatabase> | null = null

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
    const db = await getDB()
    if(!db) return null

    try {
        const tx = db.transaction(STORE_NAME, "readonly")
        const store = tx.objectStore(STORE_NAME)
        const blob = await new Promise<Blob | null>((resolve, reject) => {
            const req = store.get(cacheKey(textureType, baseColor, archetype, seedKey))
            req.onsuccess = () => resolve(req.result as Blob | null)
            req.onerror = () => reject(req.error)
        })

        if(!blob) return null
        return createImageBitmap(blob)
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
                cacheKey(textureType, baseColor, archetype, seedKey)
            )
            req.onsuccess = () => resolve()
            req.onerror = () => reject(req.error)
        })
    } catch {
        // Cache is optional — silently fail
    }
}
