'use client'

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
    Package,
    DollarSign,
    Briefcase,
    Calendar,
    Filter,
    X,
    Building2,
    AlertCircle,
    Clock,
    BarChart3,
    ChartArea
} from "lucide-react"
import { StatCard } from "@/src/components/StatCard"
import { Skeleton } from "@/src/components/ui/skeleton"
import { Badge } from "@/src/components/ui/badge"
import { Button } from "@/src/components/ui/button"
import { Input } from "@/src/components/ui/input"
import { DashboardSummary, CostCenter } from "@/src/lib/dashboard-types"
import { getCostCenterName } from '@/src/lib/cost-centers-map'
import { useAuth } from '@/src/hooks/useAuth'
import { LoadingScreen } from '@/src/components/ui/LoadingScreen'

const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

const formatNumber = (v: number) =>
    new Intl.NumberFormat("pt-BR").format(v)

export default function DashboardPage() {
    const { isLoading: authLoading, isAuthenticated, user } = useAuth()
    const [data, setData] = useState<DashboardSummary | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [partialData, setPartialData] = useState(false)
    const userCentrosCusto = user?.centrosCusto ?? []

    // Verificar se o usuário é SEPOD
    const userRole = user?.role
    const isSepod = userRole === 'SEPOD'

    // Estados para filtros
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [selectedCostCenter, setSelectedCostCenter] = useState('todos')
    const [availableCostCenters, setAvailableCostCenters] = useState<CostCenter[]>([])
    const [showDateFilter, setShowDateFilter] = useState(false)

    // Função para buscar dados com filtros
    const fetchData = async () => {
        if (!isAuthenticated) return

        setLoading(true)
        setPartialData(true)
        setError(null)

        let isTimeout = false
        const controller = new AbortController()
        const timeoutId = setTimeout(() => {
            isTimeout = true
            controller.abort()
        }, 300000) // 5 minutos de tolerância para a primeira carga completa

        try {
            const params = new URLSearchParams()
            if (startDate) params.append('startDate', startDate)
            if (endDate) params.append('endDate', endDate)
            if (selectedCostCenter && selectedCostCenter !== 'todos') {
                params.append('costCenter', selectedCostCenter)
            }

            console.log('🔄 Buscando dados do dashboard...')

            const response = await fetch(`/api/dashboard?${params.toString()}`, {
                signal: controller.signal
            })

            clearTimeout(timeoutId)

            if (!response.ok) {
                const errorJson = await response.json().catch(() => ({}))
                throw new Error(errorJson.error || `Erro ${response.status} ao carregar dados do dashboard`)
            }

            const json = await response.json()

            console.log('✅ Dados recebidos com sucesso!')
            setData(json)
            setAvailableCostCenters(json.availableCostCenters || [])
        } catch (err: any) {
            clearTimeout(timeoutId)

            if (err.name === 'AbortError') {
                if (isTimeout) {
                    console.warn('⚠️ Requisição excedeu o tempo limite')
                    setError('A requisição demorou muito tempo para responder. O servidor pode estar lento. Tente novamente.')
                } else {
                    console.log('ℹ️ Requisição anterior cancelada devido a mudança de filtro ou navegação.')
                    return
                }
            } else {
                console.error('❌ Erro no fetch do dashboard:', err)
                setError(err instanceof Error ? err.message : 'Erro desconhecido')
            }
        } finally {
            if (!isTimeout) {
                setLoading(false)
                setPartialData(false)
            }
        }
    }

    // Buscar dados quando os filtros mudarem e autenticação estiver pronta
    useEffect(() => {
        if (isAuthenticated) {
            fetchData()
        }
    }, [startDate, endDate, selectedCostCenter, isAuthenticated])

    // Aplicar filtro de data
    const handleApplyFilter = () => {
        if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
            alert('Data inicial não pode ser maior que data final')
            return
        }
        setShowDateFilter(false)
    }

    // Limpar filtro de data
    const handleClearFilter = () => {
        setStartDate('')
        setEndDate('')
        setSelectedCostCenter('todos')
        setShowDateFilter(false)
    }

    // Mostrar loading da autenticação ou de dados do dashboard
    if (authLoading || (loading && !data)) {
        return (
            <LoadingScreen
                variant="skeleton"
                title="Carregando Dashboard..."
                description="Processando resumos de pedidos, fornecedores e estatísticas financeiras."
            />
        )
    }
    if (error) {
        return (
            <div className="p-6">
                <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        <h2 className="font-semibold">Erro ao carregar dashboard</h2>
                    </div>
                    <p className="text-sm mt-1">{error}</p>
                    <Button
                        variant="outline"
                        className="mt-3"
                        onClick={() => fetchData()}
                    >
                        Tentar novamente
                    </Button>
                </div>
            </div>
        )
    }

    if (!data) return null

    return (
        <div className="space-y-6 animate-fade-in p-6">
            {/* Indicador de carregamento parcial */}
            {partialData && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:text-yellow-400 p-2 rounded-lg text-sm text-center">
                    ⚠️ Atualizando dados... Esta operação pode levar alguns segundos.
                </div>
            )}

            {/* Cabeçalho */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
                    <p className="text-muted-foreground">Visão geral do sistema</p>
                </div>

                {/* Botão de filtro */}
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDateFilter(!showDateFilter)}
                        className="flex items-center gap-2"
                    >
                        <Calendar className="w-4 h-4 text-foreground" />
                        {startDate && endDate ? (
                            <span>Filtro ativo</span>
                        ) : (
                            <span>Filtrar</span>
                        )}
                    </Button>

                    {(startDate || endDate || selectedCostCenter !== 'todos') && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClearFilter}
                            className="text-muted-foreground"
                        >
                            <X className="w-4 h-4 text-foreground" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Painel de filtros */}
            {showDateFilter && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border rounded-lg p-4 mb-4"
                >
                    <h3 className="text-sm font-medium mb-3">Filtrar por período e centro de custo</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Data inicial</label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Data final</label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Centro de Custo</label>
                            <select
                                value={selectedCostCenter}
                                onChange={(e) => setSelectedCostCenter(e.target.value)}
                                className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
                            >
                                <option value="todos">Todos os centros</option>
                                {availableCostCenters.map((cc) => (
                                    <option key={cc.code} value={cc.code}>
                                        {cc.name} ({cc.code})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end gap-2">
                            <Button onClick={handleApplyFilter} className="h-10 flex-1">
                                <Filter className="w-4 h-4 mr-2" />
                                Aplicar
                            </Button>
                            <Button variant="ghost" onClick={() => setShowDateFilter(false)} className="h-10">
                                Cancelar
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Cards de estatísticas principais */}
             {isSepod ? (
                // Layout para SEPOD - cards ocupam 2 colunas
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <StatCard
                            title="Total de Requisições de Produtos"
                            value={formatNumber(data.totalProductOrders)}
                            subtitle="Quantidade de pedidos de produto"
                            icon={Package}
                            variant="info"
                        />
                    <StatCard
                        title="Total de Requisições de Serviço"
                        value={formatNumber(data.totalServiceOrders)}
                        subtitle="Quantidade de pedidos de serviço"
                        icon={Briefcase}
                        variant="info"
                    />
                </div>
            ) : (
                // Layout normal para outros usuários
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        title="Total de Requisições de Produtos"
                        value={formatNumber(data.totalProductOrders)}
                        subtitle="Quantidade de pedidos de produto"
                        icon={Package}
                        variant="info"
                    />
                    <StatCard
                        title="Valor Total dos Produtos por Pedido"
                        value={formatCurrency(data.totalProductOrdersValue)}
                        subtitle="Soma dos valores de pedidos de produto"
                        icon={DollarSign}
                        variant="success"
                    />
                    <StatCard
                        title="Total de Requisições de Serviço"
                        value={formatNumber(data.totalServiceOrders)}
                        subtitle="Quantidade de pedidos de serviço"
                        icon={Briefcase}
                        variant="info"
                    />
                    <StatCard
                        title="Valor Total de Serviços por Pedido"
                        value={formatCurrency(data.totalServiceOrdersValue)}
                        subtitle="Soma dos valores de pedidos de serviço"
                        icon={DollarSign}
                        variant="success"
                    />
                </div>
            )}

            {/* Top 10 Fornecedores e Itens */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-card rounded-xl border p-5 h-fit"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-card-foreground">Top 10 Fornecedores</h3>
                        <Building2 className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                        {data.topSuppliers.length > 0 ? (
                            data.topSuppliers.map((supplier, index) => (
                                <div key={supplier.document} className="flex items-center justify-between p-2 hover:bg-muted/30 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                                            {index + 1}
                                        </span>
                                        <div>
                                            <p className="text-sm font-medium">{supplier.name}</p>
                                            <p className="text-xs text-muted-foreground">{supplier.orderCount} pedidos</p>
                                        </div>
                                    </div>
                                    {!isSepod && (
                                        <p className="text-sm font-bold text-primary">{formatCurrency(supplier.totalValue)}</p>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-muted-foreground py-8">
                                Nenhum fornecedor encontrado
                            </div>
                        )}
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-card rounded-xl border p-5 h-fit"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-card-foreground">Top 10 Itens Mais Pedidos</h3>
                        <Package className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                        {data.topItems.length > 0 ? (
                            data.topItems.map((item, index) => (
                                <div key={`${item.name}-${index}`} className="flex items-center justify-between p-2 hover:bg-muted/30 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                                            {index + 1}
                                        </span>
                                        <div>
                                            <p className="text-sm font-medium">{item.name}</p>
                                            <p className="text-xs text-muted-foreground">{item.group} • {item.orderCount}x</p>
                                        </div>
                                    </div>
                                    {!isSepod && (
                                        <p className="text-sm font-bold text-primary">{formatCurrency(item.totalValue)}</p>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-muted-foreground py-8">
                                Nenhum item encontrado
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Card de métrica de tempo */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-xl border bg-card p-5"
            >
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-card-foreground">Métricas de Tempo</h3>
                    <Clock className="w-5 h-5 text-primary" />
                </div>

                <div className="space-y-4">
                    <div>
                        <p className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Clock className="w-5 h-5 text-primary" />
                            <span>Tempo Médio: Aprovação → Preenchimento da Cotação</span>
                        </p>
                        <p className="text-3xl font-bold text-primary">
                            {data.averageTimeApprovalToQuotation.formatted}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                            Baseado em {data.averageTimeApprovalToQuotation.totalOrders} pedido
                            {data.averageTimeApprovalToQuotation.totalOrders !== 1 ? 's' : ''}
                        </p>
                    </div>

                    <div className="pt-3 border-t border-border">
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                            <ChartArea className="w-5 h-5 text-primary" /> Tempo decorrido entre a <strong className="text-foreground">segunda aprovação da requisição</strong> (ETAPA 3)
                            e o <strong className="text-foreground">preenchimento da cotação</strong> (ETAPA 4)
                        </p>
                    </div>
                </div>
            </motion.div>

        </div>
    )
}