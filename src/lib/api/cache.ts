import fs from 'fs'
import path from 'path'
import { CACHE_TTL_MS } from './cache-config'

interface CacheItem {
    data: any
    timestamp: number
}

const cache = new Map<string, CacheItem>()
const CACHE_TTL = CACHE_TTL_MS
const CACHE_DIR = path.join(process.cwd(), '.cache')

function getFilePath(key: string): string {
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_')
    return path.join(CACHE_DIR, `${safeKey}.json`)
}

export function getCached<T>(key: string): T | null {
    // 1. Checar memória
    const item = cache.get(key)
    if (item && Date.now() - item.timestamp < CACHE_TTL) {
        if (!Array.isArray(item.data) || item.data.length > 0) {
            console.log(`📦 Cache hit (memória): ${key}`)
            return item.data as T
        }
    }

    // 2. Checar arquivo em disco (.cache/)
    try {
        const filePath = getFilePath(key)
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8')
            const diskItem: CacheItem = JSON.parse(content)
            if (Date.now() - diskItem.timestamp < CACHE_TTL) {
                if (!Array.isArray(diskItem.data) || diskItem.data.length > 0) {
                    console.log(`💾 Cache hit (disco): ${key} (${Array.isArray(diskItem.data) ? diskItem.data.length : 'ok'} itens)`)
                    cache.set(key, diskItem)
                    return diskItem.data as T
                }
            }
        }
    } catch (err) {
        console.warn('⚠️ Erro ao ler cache em disco:', err)
    }

    return null
}

export function setCached(key: string, data: any): void {
    if (!data || (Array.isArray(data) && data.length === 0)) return

    const item: CacheItem = {
        data,
        timestamp: Date.now()
    }

    cache.set(key, item)

    try {
        if (!fs.existsSync(CACHE_DIR)) {
            fs.mkdirSync(CACHE_DIR, { recursive: true })
        }
        const filePath = getFilePath(key)
        fs.writeFileSync(filePath, JSON.stringify(item), 'utf-8')
        console.log(`💾 Cache salvo em disco e memória: ${key}`)
    } catch (err) {
        console.warn('⚠️ Erro ao salvar cache em disco:', err)
    }
}

export function clearCache(): void {
    cache.clear()
    try {
        if (fs.existsSync(CACHE_DIR)) {
            fs.rmSync(CACHE_DIR, { recursive: true, force: true })
        }
    } catch { }
    console.log('🧹 Cache limpo')
}