'use client'

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useRef,
    ReactNode
} from 'react'
import { Order } from '@/src/lib/order-types'
import { getStoredPedidos, saveStoredPedidos } from '@/src/lib/db/pedidos-idb'
import {
    adaptPedido,
    adaptRequisicao,
    enrichPedidoWithRequisicao,
    getOrderKey
} from '@/src/lib/api/pedidos-adapter'
import { useAuth } from '@/src/hooks/useAuth'

export interface SyncProgress {
    current: number
    total: number
    percentage: number
}

export interface PedidosContextValue {
    pedidos: Order[]
    data: Order[] // Alias para retrocompatibilidade
    loading: boolean
    isSyncing: boolean
    syncProgress: SyncProgress
    loadingProgress: { current: number; total: number } // Alias para retrocompatibilidade
    loadError: string | null
    reload: (force?: boolean) => void
    lastSync: Date | null
}

const PedidosContext = createContext<PedidosContextValue | null>(null)

const BATCH_SIZE = 4
const BATCH_DELAY_MS = 150

/**
 * Consolida pedidos e requisições em memória:
 * - Enriquece pedidos existentes com dados da requisição correspondente
 * - Cria ordens sintéticas para requisições em Etapas 1 a 4 ou canceladas sem pedido
 */
function buildConsolidatedList(
    pedidosMap: Map<string, Order>,
    requisicoesMap: Map<string, any>
): Order[] {
    const matchedReqIds = new Set<string>()
    const result: Order[] = []

    // 1. Processar todos os pedidos existentes
    pedidosMap.forEach((pedido) => {
        const reqId = pedido.id_requisicao ? String(pedido.id_requisicao) : null
        if (reqId && requisicoesMap.has(reqId)) {
            matchedReqIds.add(reqId)
            const req = requisicoesMap.get(reqId)
            result.push(enrichPedidoWithRequisicao(pedido, req))
        } else {
            result.push(pedido)
        }
    })

    // 2. Incluir requisições sem pedido associado (Etapas 1-4 ou canceladas antes do pedido)
    requisicoesMap.forEach((req, reqId) => {
        if (!matchedReqIds.has(reqId)) {
            result.push(adaptRequisicao(req))
        }
    })

    return result
}

export function PedidosProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated, isLoading: authLoading } = useAuth()
    const [pedidos, setPedidos] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [isSyncing, setIsSyncing] = useState(false)
    const [syncProgress, setSyncProgress] = useState<SyncProgress>({ current: 0, total: 0, percentage: 0 })
    const [loadError, setLoadError] = useState<string | null>(null)
    const [lastSync, setLastSync] = useState<Date | null>(null)

    const pedidosMapRef = useRef<Map<string, Order>>(new Map())
    const requisicoesMapRef = useRef<Map<string, any>>(new Map())
    const isSyncingRef = useRef(false)
    const abortControllerRef = useRef<AbortController | null>(null)
    const hasInitializedRef = useRef(false)

    // Helper para buscar uma página individual de pedidos ou requisições
    const fetchPage = async (
        type: 'pedidos' | 'requisicoes',
        page: number,
        signal: AbortSignal
    ): Promise<{ data: any[]; totalPages: number; totalItems: number }> => {
        const endpoint = type === 'pedidos' ? `/api/pedidos?page=${page}` : `/api/requisicoes?page=${page}`
        const response = await fetch(endpoint, { signal })
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ao carregar ${type} página ${page}`)
        }
        return response.json()
    }

    // Função de sincronização progressiva (Stale-While-Revalidate) para /api/v2/pedidos E /api/v2/requisicoes
    const syncProgressive = useCallback(async (_force = false) => {
        if (isSyncingRef.current) return
        isSyncingRef.current = true

        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }
        const controller = new AbortController()
        abortControllerRef.current = controller

        setIsSyncing(true)
        setLoadError(null)

        try {
            console.log('🔄 [PedidosContext] Iniciando carga progressiva de pedidos e requisições...')

            // 1. Buscar a primeira página de ambos em paralelo para obter totais
            const [pedidosP1, requisicoesP1] = await Promise.all([
                fetchPage('pedidos', 1, controller.signal).catch((err) => {
                    console.warn('⚠️ Falha ao buscar página 1 de pedidos:', err)
                    return { data: [], totalPages: 1, totalItems: 0 }
                }),
                fetchPage('requisicoes', 1, controller.signal).catch((err) => {
                    console.warn('⚠️ Falha ao buscar página 1 de requisições:', err)
                    return { data: [], totalPages: 1, totalItems: 0 }
                })
            ])

            const totalPedidosPages = pedidosP1.totalPages || 1
            const totalRequisicoesPages = requisicoesP1.totalPages || 1
            const totalAllPages = totalPedidosPages + totalRequisicoesPages

            // Inserir itens da página 1 nos mapas
            pedidosP1.data.forEach((p: any) => {
                const adapted = adaptPedido(p)
                pedidosMapRef.current.set(getOrderKey(adapted), adapted)
            })

            requisicoesP1.data.forEach((req: any) => {
                if (req.idRequisicao !== undefined && req.idRequisicao !== null) {
                    requisicoesMapRef.current.set(String(req.idRequisicao), req)
                }
            })

            // Primeiro merge instantâneo com a página 1
            const initialMerged = buildConsolidatedList(pedidosMapRef.current, requisicoesMapRef.current)
            setPedidos(initialMerged)
            setLoading(false)
            setSyncProgress({
                current: 2,
                total: totalAllPages,
                percentage: Math.round((2 / totalAllPages) * 100)
            })

            // 2. Montar a fila de páginas restantes de pedidos e requisições
            const queue: Array<{ type: 'pedidos' | 'requisicoes'; page: number }> = []
            for (let p = 2; p <= totalPedidosPages; p++) {
                queue.push({ type: 'pedidos', page: p })
            }
            for (let r = 2; r <= totalRequisicoesPages; r++) {
                queue.push({ type: 'requisicoes', page: r })
            }

            console.log(`📊 [PedidosContext] Total de páginas a sincronizar: ${totalAllPages} (${totalPedidosPages} pedidos + ${totalRequisicoesPages} requisições)`)

            // 3. Executar em pequenos lotes controlados (BATCH_SIZE)
            let completedCount = 2
            for (let i = 0; i < queue.length; i += BATCH_SIZE) {
                if (controller.signal.aborted) break

                const batch = queue.slice(i, i + BATCH_SIZE)
                const batchPromises = batch.map((item) =>
                    fetchPage(item.type, item.page, controller.signal).catch((err) => {
                        console.warn(`⚠️ [PedidosContext] Falha em ${item.type} página ${item.page}:`, err.message)
                        return null
                    })
                )

                const results = await Promise.allSettled(batchPromises)
                let hasNewItems = false

                results.forEach((res, idx) => {
                    completedCount++
                    if (res.status === 'fulfilled' && res.value?.data) {
                        const itemType = batch[idx].type
                        if (itemType === 'pedidos') {
                            res.value.data.forEach((p: any) => {
                                const adapted = adaptPedido(p)
                                pedidosMapRef.current.set(getOrderKey(adapted), adapted)
                            })
                        } else {
                            res.value.data.forEach((req: any) => {
                                if (req.idRequisicao !== undefined && req.idRequisicao !== null) {
                                    requisicoesMapRef.current.set(String(req.idRequisicao), req)
                                }
                            })
                        }
                        hasNewItems = true
                    }
                })

                // Atualizar estado ativo de forma incremental se novos itens chegaram
                if (hasNewItems) {
                    const currentMerged = buildConsolidatedList(pedidosMapRef.current, requisicoesMapRef.current)
                    setPedidos(currentMerged)
                }

                setSyncProgress({
                    current: Math.min(completedCount, totalAllPages),
                    total: totalAllPages,
                    percentage: Math.min(100, Math.round((completedCount / totalAllPages) * 100))
                })

                if (i + BATCH_SIZE < queue.length) {
                    await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
                }
            }

            // 4. Salvar bloco totalmente consolidado de volta no IndexedDB
            const finalMerged = buildConsolidatedList(pedidosMapRef.current, requisicoesMapRef.current)
            if (finalMerged.length > 0) {
                await saveStoredPedidos(finalMerged)
                const now = new Date()
                setLastSync(now)
                console.log(`✅ [PedidosContext] Sincronização concluída! ${finalMerged.length} pedidos e requisições consolidados no IndexedDB.`)
            }
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('❌ [PedidosContext] Erro durante sincronização:', error)
                setLoadError(error.message || 'Erro ao sincronizar pedidos e requisições')
            }
        } finally {
            isSyncingRef.current = false
            setIsSyncing(false)
            setLoading(false)
        }
    }, [])

    // Inicialização Stale-While-Revalidate com IndexedDB
    useEffect(() => {
        if (!isAuthenticated || authLoading || hasInitializedRef.current) return
        hasInitializedRef.current = true

        const initializeData = async () => {
            // 1. PERSISTÊNCIA INICIAL (IndexedDB):
            // Recupera instantaneamente os dados consolidados salvos no IndexedDB
            try {
                const cached = await getStoredPedidos()
                if (cached && Array.isArray(cached.data) && cached.data.length > 0) {
                    console.log(`⚡ [PedidosContext] Cache IndexedDB restaurado instantaneamente com ${cached.data.length} registros!`)
                    cached.data.forEach((order) => {
                        const key = getOrderKey(order)
                        pedidosMapRef.current.set(key, order)
                        if (order.id_requisicao) {
                            requisicoesMapRef.current.set(String(order.id_requisicao), order)
                        }
                    })
                    setPedidos(cached.data)
                    setLoading(false)
                    setLastSync(new Date(cached.timestamp))
                }
            } catch (err) {
                console.warn('⚠️ Falha ao ler cache inicial do IndexedDB:', err)
            }

            // 2. CARGA PROGRESSIVA DAS ROTAS EXTERNAS EM SEGUNDO PLANO:
            syncProgressive()
        }

        initializeData()

        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }
        }
    }, [isAuthenticated, authLoading, syncProgressive])

    const reload = useCallback((force = true) => {
        syncProgressive(force)
    }, [syncProgressive])

    const value: PedidosContextValue = {
        pedidos,
        data: pedidos,
        loading,
        isSyncing,
        syncProgress,
        loadingProgress: { current: syncProgress.current, total: syncProgress.total },
        loadError,
        reload,
        lastSync
    }

    return (
        <PedidosContext.Provider value={value}>
            {children}
        </PedidosContext.Provider>
    )
}

/**
 * Hook reutilizável de dados de pedidos (Stale-While-Revalidate + IndexedDB + Carga Progressiva).
 */
export function usePedidosData(): PedidosContextValue {
    const context = useContext(PedidosContext)
    if (!context) {
        throw new Error('usePedidosData deve ser utilizado dentro de um PedidosProvider')
    }
    return context
}

/**
 * Alias de conveniência para usePedidosData
 */
export function usePedidos(): PedidosContextValue {
    return usePedidosData()
}