'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { CACHE_TTL_MS } from '@/src/lib/api/cache-config'
import { useAuth } from '@/src/hooks/useAuth'

interface CacheData<T> {
    data: T[]
    timestamp: number
}

interface DataContextValue<T> {
    data: T[]
    loading: boolean
    loadingProgress: { current: number; total: number }
    loadError: string | null
    reload: () => void
}

interface CreateDataContextOptions {
    cacheKey: string
    endpoint: string
}

export function createDataContext<T>(options: CreateDataContextOptions) {
    const { cacheKey, endpoint } = options

    const Context = createContext<DataContextValue<T> | null>(null)

    function Provider({ children }: { children: ReactNode }) {
        const { isAuthenticated, isLoading: authLoading } = useAuth()
        const [data, setData] = useState<T[]>([])
        const [loading, setLoading] = useState(false)
        const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 })
        const [loadError, setLoadError] = useState<string | null>(null)
        const hasLoadedRef = useRef(false)
        const abortControllerRef = useRef<AbortController | null>(null)

        const load = useCallback(async (force = false) => {
            if (!force) {
                try {
                    const cached = localStorage.getItem(cacheKey)
                    if (cached) {
                        const parsed: CacheData<T> = JSON.parse(cached)
                        if (Date.now() - parsed.timestamp < CACHE_TTL_MS && parsed.data && parsed.data.length > 0) {
                            setData(parsed.data)
                            return
                        }
                    }
                } catch { }
            }

            if (abortControllerRef.current) abortControllerRef.current.abort()
            const controller = new AbortController()
            abortControllerRef.current = controller

            setLoading(true)
            setLoadError(null)

            try {
                setLoadingProgress({ current: 0, total: 1 })

                const res = await fetch(`/api/${endpoint}/todos`, { signal: controller.signal })
                if (!res.ok) throw new Error(`HTTP ${res.status}`)

                const json = await res.json()
                const allData: T[] = json.data || []

                setData(allData)
                setLoadingProgress({ current: 1, total: 1 })

                try {
                    if (allData.length > 0) {
                        localStorage.setItem(cacheKey, JSON.stringify({
                            data: allData,
                            timestamp: Date.now()
                        } satisfies CacheData<T>))
                    } else {
                        localStorage.removeItem(cacheKey)
                    }
                } catch { }

            } catch (error: any) {
                if (error.name !== 'AbortError') {
                    const rawMsg = String(error?.message || '')
                    let friendlyMsg = rawMsg
                    if (rawMsg.includes('524') || rawMsg.includes('504') || rawMsg.includes('502') || rawMsg.includes('Timeout')) {
                        friendlyMsg = 'O servidor da OngSys demorou para responder às requisições (Timeout Cloudflare 524). Tente recarregar novamente.'
                    }

                    // Tentar recuperar do localStorage se houver dados salvos
                    try {
                        const cached = localStorage.getItem(cacheKey)
                        if (cached) {
                            const parsed: CacheData<T> = JSON.parse(cached)
                            if (parsed.data && parsed.data.length > 0) {
                                setData(parsed.data)
                                console.warn('⚠️ Restaurados dados do cache local após erro de rede:', friendlyMsg)
                            }
                        }
                    } catch { }

                    setLoadError(friendlyMsg)
                } else {
                    hasLoadedRef.current = false
                }
            } finally {
                setLoading(false)
                setLoadingProgress({ current: 0, total: 0 })
            }
        }, [])

        useEffect(() => {
            if (isAuthenticated && !authLoading && !hasLoadedRef.current) {
                hasLoadedRef.current = true
                load()
            }
        }, [isAuthenticated, authLoading, load])

        return (
            <Context.Provider value={{
                data,
                loading,
                loadingProgress,
                loadError,
                reload: () => { hasLoadedRef.current = true; load(true) }
            }}>
                {children}
            </Context.Provider>
        )
    }

    function useData() {
        const ctx = useContext(Context)
        if (!ctx) throw new Error(`useData deve ser usado dentro do Provider de ${cacheKey}`)
        return ctx
    }

    return { Provider, useData }
}