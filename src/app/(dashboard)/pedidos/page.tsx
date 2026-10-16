'use client'

import { useState, useEffect, useMemo, useCallback } from "react"
import { motion } from "framer-motion"
import {
    Search,
    Eye,
    ChevronLeft,
    ChevronRight,
    Download,
    Filter,
    Clock,
    CheckCircle2,
    XCircle,
    AlertCircle,
    User,
    Calendar,
    Layers,
    Flag,
    Loader2,
    Building2,
    RotateCcw
} from "lucide-react"
import { Input } from "@/src/components/ui/input"
import { Button } from "@/src/components/ui/button"
import { Badge } from "@/src/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select"
import { Skeleton } from "@/src/components/ui/skeleton"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/src/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu"
import { formatCurrency } from "@/src/lib/utils"
import {
    ETAPAS,
    agruparLogsPorEtapa,
    identificarEtapaAtual,
    calcularAtrasoCotacao,
    getDataEntradaCotacao,
    getDataEntradaAprovacaoCotacao,
    getDataAprovacaoCotacao,
    getDataFinalizacao,
    type EtapaEstatistica
} from "@/src/lib/order-types"
import { useAuth } from "@/src/hooks/useAuth"
import { usePedidos } from "@/src/contexts/PedidosContext"
import { getCostCenterName, getAtitudeOnlyCostCenters, getCanonicalCostCenterCode } from "@/src/lib/cost-centers-map"
import { LoadingScreen } from "@/src/components/ui/LoadingScreen"

const PAGE_SIZE = 20

interface Order {
    id: number | string
    id_requisicao: string
    id_pedido?: string
    titulo: string
    status_pedido: string
    etapa?: string
    fornecedor_nome: string
    fornecedor_documento?: string
    requisitante?: string
    solicitante?: string
    comprador?: string
    responsavel_cotacao?: string
    data_pedido: string
    dataEntregaEstimada?: string
    tipo_pedido: string
    tipo_requisicao?: string
    subprojeto?: string
    valor_total: number
    local_entrega?: any
    itens_pedido?: any[]
    logs?: any[]
    descricao_pedido?: string
    justificativa_compra?: string
    fonte_pagadora?: string
    conta_plano_financeiro?: string
    cancelamento?: {
        data?: string
        usuario?: string
        justificativa?: string
    } | null
    aprovacoes?: any[]
    aprovacoesCotacao?: any[]
}

const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
        'Ordem finalizada': 'border-success/30 text-success',
        'Aguardando aprovação': 'border-warning/30 text-warning',
        'Em andamento': 'border-blue-500/30 text-blue-500',
        'Cancelado': 'border-destructive/30 text-destructive',
        'Rascunho': 'border-muted-foreground/30 text-muted-foreground'
    }
    return colors[status] || 'border-muted-foreground/30 text-muted-foreground'
}

const getEtapaColor = (etapa: string): string => {
    const colors: Record<string, string> = {
        'ETAPA 01': 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/30',
        'ETAPA 02': 'border-green-500 text-green-600 bg-green-50 dark:bg-green-950/30',
        'ETAPA 03': 'border-yellow-500 text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30',
        'ETAPA 04': 'border-purple-500 text-purple-600 bg-purple-50 dark:bg-purple-950/30',
        'ETAPA 05': 'border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-950/30',
        'ETAPA 06': 'border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30',
        'CANCELADO': 'border-red-500 text-red-600 bg-red-50 dark:bg-red-950/30'
    }
    return colors[etapa] || 'border-gray-500 text-gray-600 bg-gray-50 dark:bg-gray-950/30'
}

// Função para extrair informações do pedido
const getPedidoInfo = (pedido: Order) => {
    const primeiroItem = pedido.itens_pedido?.[0]
    return {
        centroCusto: primeiroItem?.centroCusto || '---',
        grupo: primeiroItem?.grupo || '---'
    }
}

// Extrai data contextual e rótulo de acordo com a etapa do pedido
const getEtapaDateInfo = (order: Order, etapaAtualNome?: string | null) => {
    const et = etapaAtualNome || order.etapa
    if (et === 'ETAPA 03') {
        const d = getDataEntradaCotacao(order)
        return { label: 'Entrada Cotação', date: d }
    }
    if (et === 'ETAPA 04') {
        const d = getDataEntradaAprovacaoCotacao(order)
        return { label: 'Envio p/ Aprov.', date: d }
    }
    if (et === 'ETAPA 05') {
        const d = getDataAprovacaoCotacao(order)
        return { label: 'Aprov. Cotação', date: d }
    }
    if (et === 'ETAPA 06') {
        const d = getDataFinalizacao(order)
        return { label: 'Finalização', date: d }
    }
    return null
}

const getEtapaHeaderLabel = (selectedEtapa: string) => {
    if (selectedEtapa === 'ETAPA 03') return 'Entrada Cotação'
    if (selectedEtapa === 'ETAPA 04') return 'Envio Cotação'
    if (selectedEtapa === 'ETAPA 05') return 'Aprovação Cotação'
    if (selectedEtapa === 'ETAPA 06') return 'Data Finalização'
    return 'Marco da Etapa'
}

export default function PedidosPage() {
    const { isLoading: authLoading, isAuthenticated, user } = useAuth()
    const { data: allOrdersRaw, loading, loadingProgress, loadError, reload } = usePedidos()
    const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
    const [search, setSearch] = useState("")
    const [status, setStatus] = useState("todos")
    const [tipo, setTipo] = useState("todos")
    const [etapa, setEtapa] = useState("Todas")
    const [centroCusto, setCentroCusto] = useState("todos")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [periodoPreset, setPeriodoPreset] = useState("todos")
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalItems, setTotalItems] = useState(0)
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
    const [exporting, setExporting] = useState(false)
    const [activeTab, setActiveTab] = useState("detalhes")
    const [timelineFilter, setTimelineFilter] = useState<'todos' | 'etapas'>('todos')
    const isSepod = user?.role === 'SEPOD'

    const handlePresetChange = (preset: string) => {
        setPeriodoPreset(preset)
        const now = new Date()
        if (preset === 'todos') {
            setStartDate('')
            setEndDate('')
        } else if (preset === 'hoje') {
            const hoje = now.toISOString().split('T')[0]
            setStartDate(hoje)
            setEndDate(hoje)
        } else if (preset === '7d') {
            const d = new Date()
            d.setDate(d.getDate() - 7)
            setStartDate(d.toISOString().split('T')[0])
            setEndDate(now.toISOString().split('T')[0])
        } else if (preset === '30d') {
            const d = new Date()
            d.setDate(d.getDate() - 30)
            setStartDate(d.toISOString().split('T')[0])
            setEndDate(now.toISOString().split('T')[0])
        } else if (preset === 'mes_atual') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
            setStartDate(firstDay)
            setEndDate(lastDay)
        } else if (preset === 'ano_atual') {
            setStartDate(`${now.getFullYear()}-01-01`)
            setEndDate(`${now.getFullYear()}-12-31`)
        }
    }

    // PEGAR DADOS DO USUÁRIO DA SESSÃO
    const userRole = user?.role
    const atitudeDefaultCodes = useMemo(() => getAtitudeOnlyCostCenters().map(c => c.code), [])
    const userCentrosCusto: string[] = useMemo(() => {
        const fromSession = user?.centrosCusto ?? []
        if (userRole === 'SEPOD') {
            return fromSession.length > 0 ? fromSession : atitudeDefaultCodes
        }
        return fromSession
    }, [user?.centrosCusto, userRole, atitudeDefaultCodes])

    // FUNÇÃO PARA EXTRAIR CENTROS DE CUSTO DE UM PEDIDO (unifica códigos legados nos oficiais)
    const getPedidoCentrosCusto = useCallback((pedido: Order): string[] => {
        const centros = new Set<string>()
        pedido.itens_pedido?.forEach((item: any) => {
            const cc = item.centroCusto || item.centro_custo || item.codigoCentroCusto
            if (cc) centros.add(getCanonicalCostCenterCode(String(cc).trim()))
        })
        if (pedido.subprojeto) centros.add(getCanonicalCostCenterCode(String(pedido.subprojeto).trim()))
        if ((pedido as any).centro_custo) centros.add(getCanonicalCostCenterCode(String((pedido as any).centro_custo).trim()))
        if ((pedido as any).raw?.subprojeto) centros.add(getCanonicalCostCenterCode(String((pedido as any).raw.subprojeto).trim()))
        return Array.from(centros)
    }, [])

    // FUNÇÃO PARA VERIFICAR SE PEDIDO PERTENCE AOS CENTROS DO USUÁRIO
    const pedidoPertenceAoUsuario = useCallback((pedido: Order): boolean => {
        if (userRole === 'SUPER_ADMIN' || userRole === 'OPERADOR_SEDE') return true
        if (userRole === 'SEPOD') {
            const allowed = userCentrosCusto.length > 0 ? userCentrosCusto : atitudeDefaultCodes
            const centrosPedido = getPedidoCentrosCusto(pedido)
            return centrosPedido.some(centro => allowed.includes(centro))
        }
        if (userRole === 'CONSULTOR') {
            if (!userCentrosCusto.length) return false
            const centrosPedido = getPedidoCentrosCusto(pedido)
            return centrosPedido.some(centro => userCentrosCusto.includes(centro))
        }
        return true
    }, [userRole, userCentrosCusto, atitudeDefaultCodes, getPedidoCentrosCusto])

    // FUNÇÃO PARA APLICAR FILTRO DE CENTRO DE CUSTO
    const aplicarFiltroCentroCusto = useCallback((pedidos: Order[]): Order[] => {
        if (userRole === 'CONSULTOR' || userRole === 'SEPOD') {
            return pedidos.filter(pedido => pedidoPertenceAoUsuario(pedido))
        }
        return pedidos
    }, [userRole, pedidoPertenceAoUsuario])

    // CALCULAR CENTROS DE CUSTO DISPONÍVEIS PARA O FILTRO
    const availableCostCenters = useMemo(() => {
        if (userRole === 'CONSULTOR') {
            return userCentrosCusto.map(code => ({
                code,
                name: getCostCenterName(code)
            }))
        }
        if (userRole === 'SEPOD') {
            const codes = userCentrosCusto.length > 0 ? userCentrosCusto : atitudeDefaultCodes
            return codes.map(code => ({
                code,
                name: getCostCenterName(code)
            })).sort((a, b) => a.name.localeCompare(b.name))
        }

        const centrosSet = new Set<string>()
        allOrdersRaw.forEach((pedido: Order) => {
            getPedidoCentrosCusto(pedido).forEach(centro => centrosSet.add(centro))
        })
        return Array.from(centrosSet)
            .map(code => ({ code, name: getCostCenterName(code) }))
            .sort((a, b) => a.name.localeCompare(b.name))
    }, [userRole, userCentrosCusto, atitudeDefaultCodes, allOrdersRaw, getPedidoCentrosCusto])

    useEffect(() => {
        if (allOrdersRaw.length === 0) return

        // Deduplicar pedidos brutos por id_pedido/id_requisicao
        const seen = new Set<string>()
        const uniqueRaw: Order[] = []
        allOrdersRaw.forEach(order => {
            const reqId = order.id_requisicao || (order as any).idRequisicao
            const pedId = order.id_pedido || (order as any).idPedido
            const key = pedId
                ? `p_${pedId}`
                : (reqId ? `r_${reqId}` : `id_${order.id}`)
            if (!seen.has(key)) {
                seen.add(key)
                uniqueRaw.push(order)
            }
        })

        let filtered = [...uniqueRaw]
        filtered = aplicarFiltroCentroCusto(filtered)

        if (centroCusto !== 'todos') {
            filtered = filtered.filter((pedido: Order) =>
                getPedidoCentrosCusto(pedido).includes(centroCusto)
            )
        }

        if (search) {
            const searchLower = search.toLowerCase()
            filtered = filtered.filter((order: Order) => {
                const titulo = order.titulo ? String(order.titulo).toLowerCase() : ''
                const idRequisicao = (order.id_requisicao || (order as any).idRequisicao) ? String(order.id_requisicao || (order as any).idRequisicao).toLowerCase() : ''
                const idPedido = (order.id_pedido || (order as any).idPedido) ? String(order.id_pedido || (order as any).idPedido).toLowerCase() : ''
                const fornecedor = order.fornecedor_nome ? String(order.fornecedor_nome).toLowerCase() : ''

                return titulo.includes(searchLower) ||
                    idRequisicao.includes(searchLower) ||
                    idPedido.includes(searchLower) ||
                    fornecedor.includes(searchLower)
            })
        }

        if (status !== 'todos') {
            filtered = filtered.filter((order: Order) => order.status_pedido === status)
        }

        if (tipo !== 'todos') {
            filtered = filtered.filter((order: Order) => order.tipo_pedido === tipo)
        }

        if (etapa !== 'Todas') {
            filtered = filtered.filter((order: Order) => {
                const etapaAtual = identificarEtapaAtual(order)
                return etapaAtual === etapa
            })
        }

        if (startDate) {
            filtered = filtered.filter((order: Order) => {
                const rawDate = order.data_pedido || order.dataEntregaEstimada
                if (!rawDate) return false
                const dateStr = String(rawDate).split('T')[0].split(' ')[0]
                return dateStr >= startDate
            })
        }

        if (endDate) {
            filtered = filtered.filter((order: Order) => {
                const rawDate = order.data_pedido || order.dataEntregaEstimada
                if (!rawDate) return false
                const dateStr = String(rawDate).split('T')[0].split(' ')[0]
                return dateStr <= endDate
            })
        }

        // Ordenar os pedidos filtrados por ID (do menor para o maior)
        filtered.sort((a, b) => {
            const idA = a.id_requisicao || a.id_pedido || a.id
            const idB = b.id_requisicao || b.id_pedido || b.id

            const numA = parseInt(String(idA || '0').replace(/\D/g, '')) || 0
            const numB = parseInt(String(idB || '0').replace(/\D/g, '')) || 0

            if (numA !== numB) {
                return numA - numB
            }

            return String(idA || '').localeCompare(String(idB || ''), undefined, { numeric: true })
        })

        setFilteredOrders(filtered)
        setTotalItems(filtered.length)
        setTotalPages(Math.ceil(filtered.length / PAGE_SIZE))
        setPage(1)
    }, [allOrdersRaw, search, status, tipo, etapa, centroCusto, startDate, endDate, aplicarFiltroCentroCusto, getPedidoCentrosCusto])

    useEffect(() => {
        console.log('📊 [PedidosPage] Estado atual:', {
            dataLength: allOrdersRaw.length,
            loading,
            loadError,
            hasData: allOrdersRaw.length > 0
        })
    }, [allOrdersRaw, loading, loadError])

    // Estatísticas de etapas (filtrando apenas etapas visíveis)
    const etapasEstatisticas = useMemo(() => {
        if (filteredOrders.length === 0) return []
        const etapasVisiveis = ETAPAS.filter(e => !e.oculta)
        const estatisticas: EtapaEstatistica[] = etapasVisiveis.map(etapa => ({
            nome: etapa.nome,
            descricao: etapa.descricao,
            quantidade: 0,
            ordem: etapa.ordem
        }))
        filteredOrders.forEach((order: Order) => {
            const etapaAtual = identificarEtapaAtual(order)
            if (etapaAtual) {
                const etapaInfo = estatisticas.find(e => e.nome === etapaAtual)
                if (etapaInfo) etapaInfo.quantidade++
            }
        })
        return estatisticas
    }, [filteredOrders])

    // Status e tipos únicos
    const uniqueStatus = useMemo(() => {
        const statusSet = new Set<string>()
        const pedidosPermitidos = aplicarFiltroCentroCusto(allOrdersRaw)
        pedidosPermitidos.forEach((order: Order) => {
            if (order.status_pedido) statusSet.add(order.status_pedido)
        })
        return ['todos', ...Array.from(statusSet)]
    }, [allOrdersRaw, aplicarFiltroCentroCusto])

    const uniqueTipos = useMemo(() => {
        const tipoSet = new Set<string>()
        const pedidosPermitidos = aplicarFiltroCentroCusto(allOrdersRaw)
        pedidosPermitidos.forEach((order: Order) => {
            if (order.tipo_pedido) tipoSet.add(order.tipo_pedido)
        })
        return ['todos', ...Array.from(tipoSet)]
    }, [allOrdersRaw, aplicarFiltroCentroCusto])

    const paginatedOrders = filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    const handleExport = async (exportTipo: 'pagina' | 'filtro' | 'tudo') => {
        setExporting(true)
        try {
            await new Promise(resolve => setTimeout(resolve, 1000))
            const dadosExportar = exportTipo === 'pagina' ? paginatedOrders : filteredOrders
            alert(`Exportação simulada! ${dadosExportar.length} itens.`)
        } catch (error) {
            console.error('Erro ao exportar:', error)
            alert('Erro ao exportar pedidos. Tente novamente.')
        } finally {
            setExporting(false)
        }
    }

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    if (!isAuthenticated) return null

    if (loadError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-6">
                <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg max-w-md">
                    <h2 className="font-semibold">Erro ao carregar pedidos</h2>
                    <p className="text-sm mt-1">{loadError}</p>
                    <Button variant="outline" className="mt-3" onClick={reload}>
                        Tentar novamente
                    </Button>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <LoadingScreen
                variant="skeleton"
                title="Carregando pedidos..."
                description="Buscando e organizando a lista de requisições e ordens de compra."
                currentProgress={loadingProgress.current}
                totalProgress={loadingProgress.total}
            />
        )
    }

    return (
        <div className="space-y-5 animate-fade-in p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Pedidos</h1>
                    <p className="text-muted-foreground">
                        {totalItems.toLocaleString("pt-BR")} pedidos encontrados
                        {totalItems > PAGE_SIZE && (
                            <span className="text-xs ml-2">
                                (mostrando {paginatedOrders.length} na página {page})
                            </span>
                        )}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => reload()}
                        disabled={loading}
                        title="Recarregar dados da API OngSys"
                    >
                        <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline ml-2">Recarregar</span>
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" disabled={exporting}>
                                <Download className="w-4 h-4 mr-2" />
                                {exporting ? 'Exportando...' : 'Exportar'}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Opções de Exportação</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleExport('pagina')}>
                                <Filter className="w-4 h-4 mr-2" />
                                Página atual ({paginatedOrders.length} itens)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport('filtro')}>
                                <Filter className="w-4 h-4 mr-2" />
                                Filtro atual ({totalItems} itens)
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleExport('tudo')}>
                                <Download className="w-4 h-4 mr-2" />
                                Todos os pedidos ({allOrdersRaw.length} itens)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por título, fornecedor ou ID..."
                        className="pl-10"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* Filtro de Período Rápido */}
                <Select value={periodoPreset} onValueChange={handlePresetChange}>
                    <SelectTrigger className="w-36">
                        <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Período" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todo o período</SelectItem>
                        <SelectItem value="hoje">Hoje</SelectItem>
                        <SelectItem value="7d">Últimos 7 dias</SelectItem>
                        <SelectItem value="30d">Últimos 30 dias</SelectItem>
                        <SelectItem value="mes_atual">Este mês</SelectItem>
                        <SelectItem value="ano_atual">Este ano</SelectItem>
                        <SelectItem value="personalizado">Personalizado</SelectItem>
                    </SelectContent>
                </Select>

                {/* Campos de Data De/Até */}
                <div className="flex items-center gap-1.5 bg-card border border-input rounded-md px-2.5 h-10 shadow-sm text-xs">
                    <span className="text-muted-foreground hidden sm:inline">De:</span>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                            setStartDate(e.target.value)
                            setPeriodoPreset('personalizado')
                        }}
                        className="bg-transparent text-foreground focus:outline-none cursor-pointer text-xs"
                        title="Data inicial"
                    />
                    <span className="text-muted-foreground">até</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                            setEndDate(e.target.value)
                            setPeriodoPreset('personalizado')
                        }}
                        className="bg-transparent text-foreground focus:outline-none cursor-pointer text-xs"
                        title="Data final"
                    />
                    {(startDate || endDate) && (
                        <button
                            type="button"
                            onClick={() => {
                                setStartDate('')
                                setEndDate('')
                                setPeriodoPreset('todos')
                            }}
                            className="text-muted-foreground hover:text-foreground font-bold ml-1 px-1 rounded hover:bg-muted"
                            title="Limpar período"
                        >
                            ×
                        </button>
                    )}
                </div>

                <Select value={centroCusto} onValueChange={setCentroCusto}>
                    <SelectTrigger className="w-48">
                        <Building2 className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Centro de Custo" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">
                            {(userRole === 'CONSULTOR' || userRole === 'SEPOD') ? 'Todos os meus centros' : 'Todos os centros'}
                        </SelectItem>
                        {availableCostCenters.map((center) => (
                            <SelectItem key={center.code} value={center.code}>
                                {center.name} ({center.code})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        {uniqueStatus.map((s) => (
                            <SelectItem key={s} value={s}>
                                {s === 'todos' ? 'Todos os status' : s}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                        {uniqueTipos.map((t) => (
                            <SelectItem key={t} value={t}>
                                {t === 'todos' ? 'Todos os tipos' : t}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={etapa} onValueChange={setEtapa}>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Etapa" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Todas">Todas as Etapas</SelectItem>
                        {etapasEstatisticas
                            .sort((a, b) => a.ordem - b.ordem)
                            .map((e) => (
                                <SelectItem key={e.nome} value={e.nome}>
                                    <div className="flex items-center gap-2">
                                        {e.nome === 'CANCELADO' ? (
                                            <XCircle className="w-3 h-3 text-destructive" />
                                        ) : (
                                            <Flag className="w-3 h-3" />
                                        )}
                                        <span>{e.nome} ({e.quantidade})</span>
                                    </div>
                                </SelectItem>
                            ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Cards de Estatísticas de Etapas */}
            {etapasEstatisticas.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {etapasEstatisticas
                        .sort((a, b) => a.ordem - b.ordem)
                        .map((etapaItem) => {
                            const isFinal = etapaItem.nome === 'ETAPA 06' || etapaItem.nome === 'CANCELADO'
                            return (
                                <motion.button
                                    key={etapaItem.nome}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setEtapa(etapaItem.nome)}
                                    className={`rounded-lg border p-3 text-left transition-all ${etapa === etapaItem.nome
                                        ? getEtapaColor(etapaItem.nome) + ' border-2'
                                        : 'bg-card border-border hover:border-primary/50'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        {etapaItem.nome === 'CANCELADO' ? (
                                            <XCircle className="w-4 h-4 text-red-500" />
                                        ) : (
                                            <Flag className="w-4 h-4" />
                                        )}
                                        <Badge variant="outline" className="text-xs">
                                            {etapaItem.quantidade}
                                        </Badge>
                                    </div>
                                    <p className="text-sm font-medium">{etapaItem.nome}</p>
                                    <p className="text-xs opacity-80 mt-1 line-clamp-2">{etapaItem.descricao}</p>
                                    {isFinal && (
                                        <div className="mt-2 pt-2 border-t border-border/50">
                                            <p className="text-[10px] text-muted-foreground text-center">
                                                {etapaItem.nome === 'CANCELADO' ? 'Pedidos cancelados' : 'Etapa final'}
                                            </p>
                                        </div>
                                    )}
                                </motion.button>
                            )
                        })}
                </div>
            )}

            {/* Indicadores de filtros ativos */}
            {(search || status !== 'todos' || tipo !== 'todos' || etapa !== 'Todas' || centroCusto !== 'todos' || startDate || endDate) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                    <span>Filtros ativos:</span>
                    {(startDate || endDate) && (
                        <Badge variant="secondary" className="gap-1">
                            Período: {startDate ? new Date(startDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'Início'} até {endDate ? new Date(endDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'Hoje'}
                            <button onClick={() => { setStartDate(''); setEndDate(''); setPeriodoPreset('todos') }} className="ml-1 hover:text-foreground">×</button>
                        </Badge>
                    )}
                    {centroCusto !== 'todos' && (
                        <Badge variant="secondary" className="gap-1">
                            Centro: {getCostCenterName(centroCusto)}
                            <button onClick={() => setCentroCusto('todos')} className="ml-1 hover:text-foreground">×</button>
                        </Badge>
                    )}
                    {search && (
                        <Badge variant="secondary" className="gap-1">
                            Busca: "{search}"
                            <button onClick={() => setSearch('')} className="ml-1 hover:text-foreground">×</button>
                        </Badge>
                    )}
                    {status !== 'todos' && (
                        <Badge variant="secondary" className="gap-1">
                            Status: {status}
                            <button onClick={() => setStatus('todos')} className="ml-1 hover:text-foreground">×</button>
                        </Badge>
                    )}
                    {tipo !== 'todos' && (
                        <Badge variant="secondary" className="gap-1">
                            Tipo: {tipo}
                            <button onClick={() => setTipo('todos')} className="ml-1 hover:text-foreground">×</button>
                        </Badge>
                    )}
                    {etapa !== 'Todas' && (
                        <Badge variant="secondary" className="gap-1">
                            Etapa: {etapa}
                            <button onClick={() => setEtapa('Todas')} className="ml-1 hover:text-foreground">×</button>
                        </Badge>
                    )}
                </div>
            )}

            {/* Tabela de pedidos */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/50">
                                {isSepod ? (
                                    // Cabeçalho para SEPOD
                                    <>
                                        <th className="text-left p-3 text-muted-foreground font-medium w-[130px]">Req / Pedido</th>
                                        <th className="text-left p-3 text-muted-foreground font-medium min-w-[200px]">Título</th>
                                        <th className="text-left p-3 text-muted-foreground font-medium w-[150px]">Centro de Custo</th>
                                        <th className="text-left p-3 text-muted-foreground font-medium w-[150px]">Grupo</th>
                                        <th className="text-left p-3 text-muted-foreground font-medium min-w-[180px]">Requisitante</th>
                                        <th className="text-left p-3 text-muted-foreground font-medium min-w-[180px]">Comprador</th>
                                        <th className="text-left p-3 text-muted-foreground font-medium w-[110px]">Data Pedido</th>
                                        <th className="text-left p-3 text-muted-foreground font-medium w-[130px] whitespace-nowrap">{getEtapaHeaderLabel(etapa)}</th>
                                        <th className="text-left p-3 text-muted-foreground font-medium w-[110px]">Data Entrega</th>
                                        <th className="text-center p-3 text-muted-foreground font-medium w-[120px]">Status</th>
                                        <th className="text-center p-3 text-muted-foreground font-medium w-[110px]">Etapa</th>
                                        <th className="text-center p-3 text-muted-foreground font-medium w-[80px]">Ações</th>
                                    </>
                                ) : (
                                    // Cabeçalho normal para outros usuários
                                    <>
                                        <th className="text-left p-3 text-muted-foreground font-medium w-[130px]">Req / Pedido</th>
                                        <th className="text-left p-3 text-muted-foreground font-medium min-w-[250px]">Título</th>
                                        <th className="text-left p-3 text-muted-foreground font-medium hidden md:table-cell min-w-[200px]">Fornecedor</th>
                                        <th className="text-left p-3 text-muted-foreground font-medium hidden lg:table-cell w-[110px]">Data Pedido</th>
                                        <th className="text-left p-3 text-muted-foreground font-medium hidden lg:table-cell w-[130px] whitespace-nowrap">{getEtapaHeaderLabel(etapa)}</th>
                                        <th className="text-right p-3 text-muted-foreground font-medium hidden xl:table-cell w-[120px]">Valor</th>
                                        <th className="text-center p-3 text-muted-foreground font-medium w-[120px]">Status</th>
                                        <th className="text-center p-3 text-muted-foreground font-medium hidden lg:table-cell w-[110px]">Etapa Atual</th>
                                        <th className="text-center p-3 text-muted-foreground font-medium w-[80px]">Ações</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedOrders.map((order, index) => {
                                const etapaAtual = identificarEtapaAtual(order)
                                const atrasoCotacao = calcularAtrasoCotacao(order)
                                const pedidoInfo = getPedidoInfo(order)

                                if (isSepod) {
                                    // Linha para SEPOD
                                    return (
                                        <motion.tr
                                            key={order.id ? String(order.id) : (order.id_pedido ? `${order.id_requisicao}_${order.id_pedido}` : `${order.id_requisicao}_${index}`)}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.03 }}
                                            className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                                        >
                                            <td className="p-3 font-mono text-xs text-card-foreground align-top">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-foreground whitespace-normal break-words" title="ID Requisição">
                                                        Req #{order.id_requisicao || '---'}
                                                    </span>
                                                    {order.id_pedido ? (
                                                        <span className="text-[11px] text-muted-foreground font-normal" title="Número do Pedido de Compra">
                                                            Ped #{order.id_pedido}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-muted-foreground/60 italic">Sem pedido</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3 text-card-foreground font-medium align-top">
                                                <div className="whitespace-normal break-words max-w-[300px]">
                                                    {order.titulo}
                                                </div>
                                            </td>
                                            <td className="p-3 text-card-foreground align-top">
                                                <div className="flex flex-col">
                                                    <span className="font-mono text-xs whitespace-normal break-words">
                                                        {pedidoInfo.centroCusto}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground mt-1">
                                                        {getCostCenterName(pedidoInfo.centroCusto)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-3 text-card-foreground align-top">
                                                <span className="whitespace-normal break-words">
                                                    {pedidoInfo.grupo}
                                                </span>
                                            </td>
                                            <td className="p-3 text-card-foreground align-top">
                                                <div className="whitespace-normal break-words max-w-[200px]">
                                                    {order.requisitante || '---'}
                                                </div>
                                            </td>
                                            <td className="p-3 text-card-foreground align-top">
                                                <div className="whitespace-normal break-words max-w-[200px]">
                                                    {order.comprador || order.requisitante || '---'}
                                                </div>
                                            </td>
                                            <td className="p-3 text-muted-foreground align-top whitespace-nowrap">
                                                {order.data_pedido ? new Date(order.data_pedido).toLocaleDateString("pt-BR") : '---'}
                                            </td>
                                            <td className="p-3 text-muted-foreground align-top whitespace-nowrap text-xs">
                                                {(() => {
                                                    const etapaDateInfo = getEtapaDateInfo(order, etapaAtual)
                                                    const formattedDate = etapaDateInfo?.date
                                                        ? new Date(etapaDateInfo.date.includes(' ') ? etapaDateInfo.date.replace(' ', 'T') : etapaDateInfo.date).toLocaleDateString("pt-BR")
                                                        : '---'
                                                    return (
                                                        <div>
                                                            {etapa === 'Todas' && etapaDateInfo && (
                                                                <div className="text-[10px] text-muted-foreground/70">{etapaDateInfo.label}</div>
                                                            )}
                                                            <span>{formattedDate}</span>
                                                        </div>
                                                    )
                                                })()}
                                            </td>
                                            <td className="p-3 text-muted-foreground align-top whitespace-nowrap">
                                                {order.dataEntregaEstimada ? new Date(order.dataEntregaEstimada).toLocaleDateString("pt-BR") : '---'}
                                            </td>
                                            <td className="p-3 text-center align-top">
                                                <Badge variant="outline" className={getStatusColor(order.status_pedido || '')}>
                                                    {order.status_pedido || '---'}
                                                </Badge>
                                            </td>
                                            <td className="p-3 text-center align-top">
                                                <div className="flex flex-col items-center gap-1">
                                                    {etapaAtual ? (
                                                        <Badge variant="outline" className={getEtapaColor(etapaAtual)}>
                                                            {etapaAtual}
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline">---</Badge>
                                                    )}
                                                    {atrasoCotacao && (
                                                        <Badge
                                                            variant="outline"
                                                            className={`text-[10px] px-1.5 py-0.5 flex items-center gap-1 cursor-help ${atrasoCotacao.cor}`}
                                                            title={atrasoCotacao.label}
                                                        >
                                                            <Clock className="w-3 h-3" />
                                                            <span>{atrasoCotacao.dias}d sem cotação</span>
                                                        </Badge>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3 text-center align-top">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setSelectedOrder(order)
                                                        setActiveTab("detalhes")
                                                        setTimelineFilter('todos')
                                                    }}
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        </motion.tr>
                                    )
                                } else {
                                    // Linha normal para outros usuários
                                    return (
                                        <motion.tr
                                            key={order.id ? String(order.id) : (order.id_pedido ? `${order.id_requisicao}_${order.id_pedido}` : `${order.id_requisicao}_${index}`)}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.03 }}
                                            className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                                        >
                                            <td className="p-3 font-mono text-xs text-card-foreground align-top">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-foreground whitespace-normal break-words" title="ID Requisição">
                                                        Req #{order.id_requisicao || '---'}
                                                    </span>
                                                    {order.id_pedido ? (
                                                        <span className="text-[11px] text-muted-foreground font-normal" title="Número do Pedido de Compra">
                                                            Ped #{order.id_pedido}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-muted-foreground/60 italic">Sem pedido</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3 text-card-foreground font-medium align-top">
                                                <div className="whitespace-normal break-words max-w-[300px]">
                                                    {order.titulo}
                                                </div>
                                            </td>
                                            <td className="p-3 hidden md:table-cell text-card-foreground align-top">
                                                <div className="whitespace-normal break-words max-w-[250px]">
                                                    {order.fornecedor_nome || '---'}
                                                </div>
                                            </td>
                                            <td className="p-3 hidden lg:table-cell text-muted-foreground align-top whitespace-nowrap">
                                                {order.data_pedido ? new Date(order.data_pedido).toLocaleDateString("pt-BR") : '---'}
                                            </td>
                                            <td className="p-3 hidden lg:table-cell text-muted-foreground align-top whitespace-nowrap text-xs">
                                                {(() => {
                                                    const etapaDateInfo = getEtapaDateInfo(order, etapaAtual)
                                                    const formattedDate = etapaDateInfo?.date
                                                        ? new Date(etapaDateInfo.date.includes(' ') ? etapaDateInfo.date.replace(' ', 'T') : etapaDateInfo.date).toLocaleDateString("pt-BR")
                                                        : '---'
                                                    return (
                                                        <div>
                                                            {etapa === 'Todas' && etapaDateInfo && (
                                                                <div className="text-[10px] text-muted-foreground/70">{etapaDateInfo.label}</div>
                                                            )}
                                                            <span>{formattedDate}</span>
                                                        </div>
                                                    )
                                                })()}
                                            </td>
                                            <td className="p-3 text-right hidden xl:table-cell text-card-foreground font-medium align-top whitespace-nowrap">
                                                {formatCurrency(order.valor_total || 0)}
                                            </td>
                                            <td className="p-3 text-center align-top">
                                                <Badge variant="outline" className={getStatusColor(order.status_pedido || '')}>
                                                    {order.status_pedido || '---'}
                                                </Badge>
                                            </td>
                                            <td className="p-3 text-center hidden lg:table-cell align-top">
                                                <div className="flex flex-col items-center gap-1">
                                                    {etapaAtual ? (
                                                        <Badge variant="outline" className={getEtapaColor(etapaAtual)}>
                                                            {etapaAtual}
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline">---</Badge>
                                                    )}
                                                    {atrasoCotacao && (
                                                        <Badge
                                                            variant="outline"
                                                            className={`text-[10px] px-1.5 py-0.5 flex items-center gap-1 cursor-help ${atrasoCotacao.cor}`}
                                                            title={atrasoCotacao.label}
                                                        >
                                                            <Clock className="w-3 h-3" />
                                                            <span>{atrasoCotacao.dias}d sem cotação</span>
                                                        </Badge>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3 text-center align-top">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setSelectedOrder(order)
                                                        setActiveTab("detalhes")
                                                        setTimelineFilter('todos')
                                                    }}
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        </motion.tr>
                                    )
                                }
                            })}
                            {paginatedOrders.length === 0 && (
                                <tr>
                                    <td colSpan={isSepod ? 11 : 8} className="p-8 text-center text-muted-foreground">
                                        Nenhum pedido encontrado com os filtros selecionados
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginação */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30">
                        <p className="text-sm text-muted-foreground">
                            {totalItems > 0 ? (
                                <>Mostrando {((page - 1) * PAGE_SIZE) + 1} - {Math.min(page * PAGE_SIZE, totalItems)} de {totalItems} pedidos</>
                            ) : (
                                'Nenhum pedido encontrado'
                            )}
                        </p>
                        <div className="flex gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage(page - 1)}
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= totalPages}
                                onClick={() => setPage(page + 1)}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de detalhes */}
            <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl">
                            Detalhes: Requisição #{selectedOrder?.id_requisicao}
                            {selectedOrder?.id_pedido && ` (Pedido #${selectedOrder?.id_pedido})`}
                        </DialogTitle>
                    </DialogHeader>
                    {selectedOrder && (
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
                            <TabsList className={`grid w-full ${isSepod ? 'grid-cols-4' : 'grid-cols-5'}`}>
                                <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                                <TabsTrigger value="itens">Itens</TabsTrigger>
                                <TabsTrigger value="aprovacoes">Aprovações</TabsTrigger>
                                <TabsTrigger value="entrega">Entrega</TabsTrigger>
                                {!isSepod && (
                                    <TabsTrigger value="timeline">Linha do Tempo</TabsTrigger>
                                )}
                            </TabsList>

                            <TabsContent value="detalhes" className="space-y-4 mt-4">
                                {selectedOrder.cancelamento && (
                                    <div className="p-3.5 rounded-lg border border-red-500/40 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 space-y-1.5">
                                        <div className="flex items-center gap-2 font-semibold text-sm">
                                            <XCircle className="w-4 h-4 shrink-0 text-red-600" />
                                            <span>Requisição Cancelada</span>
                                        </div>
                                        <p className="text-xs">
                                            <strong>Cancelado por:</strong> {selectedOrder.cancelamento.usuario || 'Não informado'}
                                            {selectedOrder.cancelamento.data && (
                                                <span> em {new Date(selectedOrder.cancelamento.data).toLocaleString("pt-BR")}</span>
                                            )}
                                        </p>
                                        {selectedOrder.cancelamento.justificativa && (
                                            <p className="text-xs">
                                                <strong>Justificativa:</strong> {selectedOrder.cancelamento.justificativa}
                                            </p>
                                        )}
                                    </div>
                                )}
                                {(() => {
                                    const atrasoModal = calcularAtrasoCotacao(selectedOrder)
                                    if (!atrasoModal) return null
                                    return (
                                        <div className={`p-3 rounded-lg border flex items-center justify-between text-xs font-medium ${atrasoModal.cor}`}>
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 shrink-0" />
                                                <span>Atenção: Este pedido está pendente de cotação há <strong>{atrasoModal.dias} dias</strong>.</span>
                                            </div>
                                            <Badge className={atrasoModal.badgeBg}>
                                                {atrasoModal.nivel.toUpperCase()}
                                            </Badge>
                                        </div>
                                    )
                                })()}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Identificadores</p>
                                        <p className="text-sm font-medium">
                                            Req #{selectedOrder.id_requisicao}
                                            {selectedOrder.id_pedido && (
                                                <span className="text-muted-foreground text-xs ml-1 font-normal">(Pedido #{selectedOrder.id_pedido})</span>
                                            )}
                                        </p>
                                    </div>
                                    <div><p className="text-xs text-muted-foreground">Status</p><Badge variant="outline" className={getStatusColor(selectedOrder.status_pedido || '')}>{selectedOrder.status_pedido}</Badge></div>
                                </div>
                                <div><p className="text-xs text-muted-foreground">Título</p><p className="text-sm">{selectedOrder.titulo}</p></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        {isSepod ? (
                                            <>
                                                <p className="text-xs text-muted-foreground">Comprador</p>
                                                <p className="text-sm font-medium">{selectedOrder.comprador || '---'}</p>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-xs text-muted-foreground">Fornecedor</p>
                                                <p className="text-sm font-medium">{selectedOrder.fornecedor_nome || '---'}</p>
                                            </>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Requisitante</p>
                                        <p className="text-sm">{selectedOrder.requisitante || '---'}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><p className="text-xs text-muted-foreground">Data</p><p className="text-sm">{selectedOrder.data_pedido ? new Date(selectedOrder.data_pedido).toLocaleDateString("pt-BR") : '---'}</p></div>
                                    <div>
                                        {!isSepod && (
                                            <>
                                                <p className="text-xs text-muted-foreground">Valor</p>
                                                <p className="text-sm font-bold text-primary">{formatCurrency(selectedOrder.valor_total || 0)}</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><p className="text-xs text-muted-foreground">Tipo</p><p className="text-sm">{selectedOrder.tipo_pedido || '---'}</p></div>
                                    <div>
                                        {!isSepod && (
                                            <>
                                                <p className="text-xs text-muted-foreground">Fonte Pagadora</p><p className="text-sm">{selectedOrder.fonte_pagadora || '---'}</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {selectedOrder.descricao_pedido && (
                                    <div><p className="text-xs text-muted-foreground">Descrição</p><p className="text-sm bg-muted/30 p-3 rounded-md">{selectedOrder.descricao_pedido}</p></div>
                                )}
                            </TabsContent>

                            <TabsContent value="itens" className="space-y-4 mt-4">
                                {selectedOrder.itens_pedido && selectedOrder.itens_pedido.length > 0 ? (
                                    <div className="space-y-3">
                                        {selectedOrder.itens_pedido.map((item, idx) => (
                                            <div key={idx} className="bg-muted/30 p-3 rounded-lg">
                                                <p className="font-medium">{item.nomeServico || item.nomeProduto}</p>
                                                <p className="text-xs text-muted-foreground">Grupo: {item.grupo} | Qtd: {item.quantidade}</p>
                                                <p className="text-xs text-muted-foreground mt-1">Centro de Custo: {item.centroCusto}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="text-center py-4">Nenhum item encontrado</p>}
                            </TabsContent>

                            <TabsContent value="aprovacoes" className="space-y-4 mt-4">
                                {((selectedOrder.aprovacoes && selectedOrder.aprovacoes.length > 0) || (selectedOrder.aprovacoesCotacao && selectedOrder.aprovacoesCotacao.length > 0)) ? (
                                    <div className="space-y-4">
                                        {selectedOrder.aprovacoes && selectedOrder.aprovacoes.length > 0 && (
                                            <div className="space-y-2">
                                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aprovações da Requisição</h4>
                                                <div className="space-y-2">
                                                    {selectedOrder.aprovacoes.map((ap: any, idx: number) => {
                                                        const aprovadorNome = ap.aprovador || ap.usuario || ap.nome || 'Aprovador não informado'
                                                        const dataAprov = ap.data || ap.dataAprovacao
                                                        const obs = ap.justificativaRecusa || ap.justificativa || ap.comentario
                                                        return (
                                                            <div key={idx} className="p-3 rounded-lg border border-border bg-muted/20 flex flex-col gap-1 text-xs">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="font-semibold text-foreground">
                                                                        Nível {ap.nivel ?? idx + 1}: {aprovadorNome}
                                                                    </span>
                                                                    <Badge variant="outline" className={ap.status === 'Aprovado' || ap.status === 'Requisição aprovada' ? 'border-green-500 text-green-600' : 'border-yellow-500 text-yellow-600'}>
                                                                        {ap.status || 'Pendente'}
                                                                    </Badge>
                                                                </div>
                                                                {dataAprov && (
                                                                    <span className="text-muted-foreground">Data: {new Date(dataAprov.includes(' ') ? dataAprov.replace(' ', 'T') : dataAprov).toLocaleString('pt-BR')}</span>
                                                                )}
                                                                {obs && (
                                                                    <p className="text-muted-foreground mt-1">Obs: {obs}</p>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                        {selectedOrder.aprovacoesCotacao && selectedOrder.aprovacoesCotacao.length > 0 && (
                                            <div className="space-y-2">
                                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aprovações de Cotação</h4>
                                                <div className="space-y-2">
                                                    {selectedOrder.aprovacoesCotacao.map((ap: any, idx: number) => {
                                                        const aprovadorNome = ap.aprovador || ap.usuario || ap.nome || 'Aprovador de Cotação'
                                                        const dataAprov = ap.data || ap.dataAprovacao
                                                        const obs = ap.justificativaRecusa || ap.justificativa || ap.comentario
                                                        return (
                                                            <div key={idx} className="p-3 rounded-lg border border-border bg-muted/20 flex flex-col gap-1 text-xs">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="font-semibold text-foreground">
                                                                        {ap.nivel ? `Nível ${ap.nivel}: ` : ''}{aprovadorNome}
                                                                    </span>
                                                                    <Badge variant="outline" className={ap.status === 'Aprovado' || ap.status === 'Cotação aprovada' ? 'border-green-500 text-green-600' : 'border-yellow-500 text-yellow-600'}>
                                                                        {ap.status || 'Pendente'}
                                                                    </Badge>
                                                                </div>
                                                                {dataAprov && (
                                                                    <span className="text-muted-foreground">Data: {new Date(dataAprov.includes(' ') ? dataAprov.replace(' ', 'T') : dataAprov).toLocaleString('pt-BR')}</span>
                                                                )}
                                                                {obs && (
                                                                    <p className="text-muted-foreground mt-1">Obs: {obs}</p>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-center py-6 text-muted-foreground text-sm">Nenhum registro de aprovação para esta requisição.</p>
                                )}
                            </TabsContent>

                            <TabsContent value="entrega" className="space-y-4 mt-4">
                                {selectedOrder.local_entrega ? (
                                    <div className="space-y-2">
                                        <p><span className="text-muted-foreground">Responsável:</span> {selectedOrder.local_entrega.responsavel}</p>
                                        <p><span className="text-muted-foreground">Endereço:</span> {selectedOrder.local_entrega.endereco}, {selectedOrder.local_entrega.numero}</p>
                                        <p><span className="text-muted-foreground">Cidade:</span> {selectedOrder.local_entrega.cidade}/{selectedOrder.local_entrega.estado} - CEP: {selectedOrder.local_entrega.cep}</p>
                                    </div>
                                ) : <p className="text-center py-4">Sem informação de entrega</p>}
                            </TabsContent>

                            {!isSepod && (
                                <TabsContent value="timeline" className="space-y-4 mt-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-sm font-medium text-foreground">Histórico do Pedido</h4>
                                        <div className="flex items-center gap-7">
                                            <Button variant={timelineFilter === 'todos' ? 'default' : 'outline'} size="sm" onClick={() => setTimelineFilter('todos')} className="h-8">
                                                <Layers className="w-3 h-3 mr-1" />
                                                Todos
                                            </Button>
                                            <Button variant={timelineFilter === 'etapas' ? 'default' : 'outline'} size="sm" onClick={() => setTimelineFilter('etapas')} className="h-8">
                                                <Flag className="w-3 h-3 mr-1" />
                                                Por Etapas
                                            </Button>
                                        </div>
                                    </div>
                                    {selectedOrder.logs && selectedOrder.logs.length > 0 ? (
                                        <div className="space-y-3">
                                            {selectedOrder.logs.map((log, idx) => (
                                                <div key={idx} className="border-l-2 border-primary/30 pl-4 py-2">
                                                    <p className="text-sm font-medium">{log.acao}</p>
                                                    <p className="text-xs text-muted-foreground">{log.autor} - {new Date(log.data).toLocaleString("pt-BR")}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-center py-4">Nenhum log encontrado</p>}
                                </TabsContent>
                            )}
                        </Tabs>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}