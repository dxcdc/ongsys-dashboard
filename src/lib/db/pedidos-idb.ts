import { Order } from '@/src/lib/order-types'

const DB_NAME = 'ongsys_db'
const DB_VERSION = 1
const STORE_NAME = 'pedidos_cache'
const CACHE_KEY = 'pedidos_consolidado'

export interface CachedPedidosPayload {
    data: Order[]
    timestamp: number
    totalItems: number
}

function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !window.indexedDB) {
            return reject(new Error('IndexedDB não suportado neste ambiente'))
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION)

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
            const db = (event.target as IDBOpenDBRequest).result
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME)
            }
        }

        request.onsuccess = () => {
            resolve(request.result)
        }

        request.onerror = () => {
            reject(request.error || new Error('Falha ao abrir IndexedDB'))
        }
    })
}

/**
 * Recupera os pedidos históricos salvos no IndexedDB de forma instantânea.
 */
export async function getStoredPedidos(): Promise<CachedPedidosPayload | null> {
    try {
        if (typeof window === 'undefined' || !window.indexedDB) return null

        const db = await openDatabase()
        return new Promise((resolve) => {
            const transaction = db.transaction(STORE_NAME, 'readonly')
            const store = transaction.objectStore(STORE_NAME)
            const request = store.get(CACHE_KEY)

            request.onsuccess = () => {
                const result = request.result as CachedPedidosPayload | undefined
                if (result && Array.isArray(result.data) && result.data.length > 0) {
                    resolve(result)
                } else {
                    resolve(null)
                }
            }

            request.onerror = () => {
                console.warn('⚠️ Erro ao ler dados do IndexedDB:', request.error)
                resolve(null)
            }
        })
    } catch (err) {
        console.warn('⚠️ Falha no acesso ao IndexedDB:', err)
        return null
    }
}

/**
 * Salva o bloco consolidado de pedidos no IndexedDB.
 */
export async function saveStoredPedidos(pedidos: Order[]): Promise<void> {
    try {
        if (typeof window === 'undefined' || !window.indexedDB || !Array.isArray(pedidos) || pedidos.length === 0) {
            return
        }

        const db = await openDatabase()
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite')
            const store = transaction.objectStore(STORE_NAME)

            const payload: CachedPedidosPayload = {
                data: pedidos,
                timestamp: Date.now(),
                totalItems: pedidos.length
            }

            const request = store.put(payload, CACHE_KEY)

            request.onsuccess = () => {
                resolve()
            }

            request.onerror = () => {
                console.warn('⚠️ Erro ao gravar pedidos no IndexedDB:', request.error)
                reject(request.error)
            }
        })
    } catch (err) {
        console.warn('⚠️ Falha ao salvar no IndexedDB:', err)
    }
}

/**
 * Limpa o cache de pedidos no IndexedDB se necessário.
 */
export async function clearStoredPedidos(): Promise<void> {
    try {
        if (typeof window === 'undefined' || !window.indexedDB) return

        const db = await openDatabase()
        return new Promise((resolve) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite')
            const store = transaction.objectStore(STORE_NAME)
            const request = store.delete(CACHE_KEY)

            request.onsuccess = () => resolve()
            request.onerror = () => resolve()
        })
    } catch {
        // silencioso
    }
}
