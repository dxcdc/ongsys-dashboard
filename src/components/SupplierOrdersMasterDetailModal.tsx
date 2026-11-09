'use client'

import { useState, useMemo, useEffect } from "react"
import {
    Building2,
    Search,
    Calendar,
    DollarSign,
    Package,
    Clock,
    XCircle,
    User,
    Layers,
    Flag,
    ArrowLeft,
    FileText,
    MapPin,
    ShieldCheck,
    Briefcase
} from "lucide-react"
import { Input } from "@/src/components/ui/input"
import { Button } from "@/src/components/ui/button"
import { Badge } from "@/src/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/src/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs"
import { formatCurrency, formatDocument } from "@/src/lib/utils"
import {
    identificarEtapaAtual,
    calcularAtrasoCotacao
} from "@/src/lib/order-types"
import { TopSupplier } from "@/src/lib/dashboard-types"
import { Order } from "@/src/lib/order-types"
import { extractValueFromPedido } from "@/src/lib/dashboard-calc"
import { getAllEquivalentCostCenterCodes, getCostCenterName } from "@/src/lib/cost-centers-map"

interface SupplierOrdersMasterDetailModalProps {
    isOpen: boolean
    onClose: () => void
    supplier: TopSupplier | null
    allOrders: Order[]
    currentFilters?: {
        startDate?: string
        endDate?: string
        costCenter?: string
    }
    isSepod?: boolean
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

function matchesSupplier(pedido: Order, supplier: TopSupplier): boolean {
    const nomeFornecedor = pedido.fornecedor_nome || (pedido as any).fornecedor?.nome
    const docFornecedor = pedido.fornecedor_documento || (pedido as any).fornecedor?.documento

    if (supplier.document && supplier.document !== '---' && docFornecedor && docFornecedor !== '---') {
        const cleanDocSupplier = String(supplier.document).replace(/\D/g, '')
        const cleanDocOrder = String(docFornecedor).replace(/\D/g, '')
        if (cleanDocSupplier && cleanDocOrder && cleanDocSupplier === cleanDocOrder) {
            return true
        }
    }

    if (nomeFornecedor && supplier.name) {
        return nomeFornecedor.trim().toLowerCase() === supplier.name.trim().toLowerCase()
    }

    return false
}

export function SupplierOrdersMasterDetailModal({
    isOpen,
    onClose,
    supplier,
    allOrders,
    currentFilters,
    isSepod = false
}: SupplierOrdersMasterDetailModalProps) {
    const [search, setSearch] = useState("")
    const [filterScope, setFilterScope] = useState<'filtered' | 'all'>('filtered')
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
    const [activeTab, setActiveTab] = useState("detalhes")
    const [timelineFilter, setTimelineFilter] = useState<'todos' | 'etapas'>('todos')

    // 1. Filtrar todos os pedidos pertencentes a este fornecedor
    const supplierOrdersRaw = useMemo(() => {
        if (!supplier || !allOrders) return []
        return allOrders.filter(p => matchesSupplier(p, supplier))
    }, [supplier, allOrders])

    // 2. Pedidos com filtros do Dashboard aplicados
    const supplierOrdersFiltered = useMemo(() => {
        if (!currentFilters) return supplierOrdersRaw

        let list = supplierOrdersRaw
        const { startDate, endDate, costCenter } = currentFilters

        if (costCenter && costCenter !== 'todos') {
            const centrosExpandidos = getAllEquivalentCostCenterCodes(costCenter)
            list = list.filter(pedido => {
                const itens = pedido.itens_pedido || (pedido as any).itensPedido || []
                const matchItem = itens.some((item: any) => {
                    const code = item.centroCusto || item.centro_custo || item.codigoCentroCusto
                    return code && centrosExpandidos.includes(String(code).trim())
                })
                if (matchItem) return true
                if (pedido.subprojeto && centrosExpandidos.includes(String(pedido.subprojeto).trim())) return true
                if ((pedido as any).centro_custo && centrosExpandidos.includes(String((pedido as any).centro_custo).trim())) return true
                return false
            })
        }

        if (startDate) {
            list = list.filter(pedido => {
                const rawDate = pedido.data_pedido || pedido.dataEntregaEstimada
                if (!rawDate) return false
                const d = String(rawDate).split('T')[0].split(' ')[0]
                return d >= startDate
            })
        }

        if (endDate) {
            list = list.filter(pedido => {
                const rawDate = pedido.data_pedido || pedido.dataEntregaEstimada
                if (!rawDate) return false
                const d = String(rawDate).split('T')[0].split(' ')[0]
                return d <= endDate
            })
        }

        return list
    }, [supplierOrdersRaw, currentFilters])

    // Base selecionada conforme escopo
    const baseOrders = filterScope === 'filtered' ? supplierOrdersFiltered : supplierOrdersRaw

    // 3. Filtro por busca de texto (ID, título, status)
    const displayedOrders = useMemo(() => {
        if (!search.trim()) return baseOrders

        const query = search.toLowerCase().trim()
        return baseOrders.filter(order => {
            const idReq = String(order.id_requisicao || order.id || '')
            const idPed = String(order.id_pedido || '')
            const titulo = String(order.titulo || '').toLowerCase()
            const status = String(order.status_pedido || '').toLowerCase()
            return idReq.includes(query) || idPed.includes(query) || titulo.includes(query) || status.includes(query)
        })
    }, [baseOrders, search])

    // Total de valor acumulado dos pedidos exibidos
    const totalDisplayedValue = useMemo(() => {
        return displayedOrders.reduce((acc, order) => acc + extractValueFromPedido(order), 0)
    }, [displayedOrders])

    // Quando o fornecedor muda ou o modal abre, selecionar o primeiro pedido por padrão
    useEffect(() => {
        if (isOpen) {
            setSearch("")
            setActiveTab("detalhes")
            if (displayedOrders.length > 0) {
                setSelectedOrder(displayedOrders[0])
            } else {
                setSelectedOrder(null)
            }
        }
    }, [isOpen, supplier])

    // Se o pedido selecionado não estiver na lista filtrada, atualizar para o primeiro disponível
    useEffect(() => {
        if (displayedOrders.length > 0) {
            const exists = displayedOrders.some(o => (o.id_requisicao && o.id_requisicao === selectedOrder?.id_requisicao) || o.id === selectedOrder?.id)
            if (!exists) {
                setSelectedOrder(displayedOrders[0])
            }
        } else {
            setSelectedOrder(null)
        }
    }, [displayedOrders])

    if (!supplier) return null

    const hasActiveFilters = Boolean(
        currentFilters?.startDate ||
        currentFilters?.endDate ||
        (currentFilters?.costCenter && currentFilters.costCenter !== 'todos')
    )

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-6xl w-[96vw] h-[90vh] p-0 flex flex-col gap-0 overflow-hidden bg-background">
                {/* Cabeçalho Superior */}
                <div className="p-4 sm:p-5 border-b border-border bg-card/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 pr-12">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <DialogTitle className="text-lg font-bold text-foreground">
                                    {supplier.name}
                                </DialogTitle>
                                {supplier.document && supplier.document !== '---' && (
                                    <Badge variant="outline" className="font-mono text-xs">
                                        {formatDocument(supplier.document)}
                                    </Badge>
                                )}
                            </div>
                            <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                                <span>{displayedOrders.length} pedido{displayedOrders.length !== 1 ? 's' : ''}</span>
                                {!isSepod && (
                                    <>
                                        <span>•</span>
                                        <span className="font-semibold text-primary">{formatCurrency(totalDisplayedValue)}</span>
                                    </>
                                )}
                                {hasActiveFilters && (
                                    <>
                                        <span>•</span>
                                        <span className="text-[11px] text-muted-foreground/80">
                                            {filterScope === 'filtered' ? 'Filtro do Dashboard aplicado' : 'Histórico completo'}
                                        </span>
                                    </>
                                )}
                            </DialogDescription>
                        </div>
                    </div>

                    {/* Botões de alternância de escopo se houver filtros ativos */}
                    {hasActiveFilters && (
                        <div className="flex items-center gap-1.5 self-start sm:self-center bg-muted/40 p-1 rounded-lg border border-border">
                            <button
                                type="button"
                                onClick={() => setFilterScope('filtered')}
                                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${filterScope === 'filtered'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                Período Filtrado ({supplierOrdersFiltered.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterScope('all')}
                                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${filterScope === 'all'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                Histórico Todo ({supplierOrdersRaw.length})
                            </button>
                        </div>
                    )}
                </div>

                {/* Estrutura Master-Detail */}
                <div className="flex-1 flex overflow-hidden">
                    {/* COLUNA ESQUERDA (Master - Lista de Pedidos) */}
                    <div className={`w-full md:w-[360px] lg:w-[410px] shrink-0 border-r border-border flex flex-col h-full bg-muted/10 ${selectedOrder ? 'hidden md:flex' : 'flex'
                        }`}>
                        {/* Campo de Busca Rápida */}
                        <div className="p-3 border-b border-border bg-card/40">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por ID, título ou status..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9 h-9 text-xs"
                                />
                            </div>
                        </div>

                        {/* Lista com Scroll dos Pedidos */}
                        <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                            {displayedOrders.length > 0 ? (
                                displayedOrders.map((order) => {
                                    const isSelected = selectedOrder?.id_requisicao === order.id_requisicao || selectedOrder?.id === order.id
                                    const etapaAtual = identificarEtapaAtual(order)
                                    const orderValue = extractValueFromPedido(order)

                                    return (
                                        <div
                                            key={order.id ? String(order.id) : (order.id_requisicao ? `req_${order.id_requisicao}` : `order_${Math.random()}`)}
                                            onClick={() => setSelectedOrder(order)}
                                            className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${isSelected
                                                ? 'bg-primary/10 border-primary shadow-sm text-foreground ring-1 ring-primary/40'
                                                : 'bg-card border-border hover:border-primary/40 hover:bg-muted/30 text-card-foreground'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-mono text-xs font-bold text-foreground">
                                                        Req #{order.id_requisicao || '---'}
                                                    </span>
                                                    {order.id_pedido && (
                                                        <span className="text-[11px] text-muted-foreground font-normal">
                                                            (Ped #{order.id_pedido})
                                                        </span>
                                                    )}
                                                </div>
                                                {!isSepod && (
                                                    <span className="text-xs font-bold text-primary shrink-0">
                                                        {formatCurrency(orderValue)}
                                                    </span>
                                                )}
                                            </div>

                                            <p className="text-xs font-medium text-foreground line-clamp-2 mb-2 leading-relaxed">
                                                {order.titulo || 'Pedido sem título'}
                                            </p>

                                            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1.5 border-t border-border/50">
                                                <span>
                                                    {order.data_pedido ? new Date(order.data_pedido).toLocaleDateString("pt-BR") : '---'}
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    {etapaAtual && (
                                                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getEtapaColor(etapaAtual)}`}>
                                                            {etapaAtual}
                                                        </Badge>
                                                    )}
                                                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getStatusColor(order.status_pedido || '')}`}>
                                                        {order.status_pedido || '---'}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            ) : (
                                <div className="text-center py-12 px-4 text-muted-foreground">
                                    <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                    <p className="text-sm font-medium">Nenhum pedido encontrado</p>
                                    <p className="text-xs mt-1">Tente ajustar o termo da busca ou alterar o filtro de período.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* COLUNA DIREITA (Detail - Detalhes do Pedido Selecionado) */}
                    <div className={`flex-1 flex flex-col h-full overflow-hidden bg-background ${!selectedOrder ? 'hidden md:flex' : 'flex'
                        }`}>
                        {selectedOrder ? (
                            <>
                                {/* Barra Superior de Detalhes (com botão voltar para mobile) */}
                                <div className="p-4 border-b border-border bg-card/40 flex flex-col gap-2 shrink-0">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="md:hidden h-8 px-2 text-xs flex items-center gap-1"
                                                onClick={() => setSelectedOrder(null)}
                                            >
                                                <ArrowLeft className="w-3.5 h-3.5" />
                                                Voltar
                                            </Button>
                                            <div>
                                                <h3 className="text-base font-semibold text-foreground flex items-center gap-2 flex-wrap">
                                                    <span>Req #{selectedOrder.id_requisicao || '---'}</span>
                                                    {selectedOrder.id_pedido && (
                                                        <span className="text-xs text-muted-foreground font-normal">
                                                            (Pedido #{selectedOrder.id_pedido})
                                                        </span>
                                                    )}
                                                </h3>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {!isSepod && (
                                                <span className="text-base font-bold text-primary">
                                                    {formatCurrency(extractValueFromPedido(selectedOrder))}
                                                </span>
                                            )}
                                            <Badge variant="outline" className={getStatusColor(selectedOrder.status_pedido || '')}>
                                                {selectedOrder.status_pedido || '---'}
                                            </Badge>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-1">
                                        {selectedOrder.titulo || 'Pedido sem título'}
                                    </p>
                                </div>

                                {/* Conteúdo com Abas */}
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                                    <div className="px-4 pt-3 border-b border-border bg-card/20 shrink-0">
                                        <TabsList className={`grid w-full ${isSepod ? 'grid-cols-4' : 'grid-cols-5'}`}>
                                            <TabsTrigger value="detalhes" className="text-xs">Detalhes</TabsTrigger>
                                            <TabsTrigger value="itens" className="text-xs">Itens</TabsTrigger>
                                            <TabsTrigger value="aprovacoes" className="text-xs">Aprovações</TabsTrigger>
                                            <TabsTrigger value="entrega" className="text-xs">Entrega</TabsTrigger>
                                            {!isSepod && (
                                                <TabsTrigger value="timeline" className="text-xs">Linha do Tempo</TabsTrigger>
                                            )}
                                        </TabsList>
                                    </div>

                                    {/* Scroll do Conteúdo das Abas */}
                                    <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                                        {/* ABA DETALHES */}
                                        <TabsContent value="detalhes" className="space-y-4 m-0">
                                            {/* Alerta de Cancelamento se houver */}
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

                                            {/* Alerta de Atraso de Cotação */}
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

                                            {/* Grade de Informações Gerais */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/20 p-4 rounded-xl border border-border">
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Título do Pedido</p>
                                                    <p className="text-sm font-medium mt-0.5">{selectedOrder.titulo || '---'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Status Atual</p>
                                                    <div className="mt-0.5">
                                                        <Badge variant="outline" className={getStatusColor(selectedOrder.status_pedido || '')}>
                                                            {selectedOrder.status_pedido || '---'}
                                                        </Badge>
                                                    </div>
                                                </div>

                                                <div>
                                                    <p className="text-xs text-muted-foreground">Requisitante</p>
                                                    <p className="text-sm font-medium mt-0.5">{selectedOrder.requisitante || selectedOrder.solicitante || '---'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">
                                                        {isSepod ? 'Comprador' : 'Fornecedor'}
                                                    </p>
                                                    <p className="text-sm font-medium mt-0.5">
                                                        {isSepod ? (selectedOrder.comprador || '---') : (selectedOrder.fornecedor_nome || '---')}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs text-muted-foreground">Data do Pedido</p>
                                                    <p className="text-sm font-medium mt-0.5">
                                                        {selectedOrder.data_pedido ? new Date(selectedOrder.data_pedido).toLocaleDateString("pt-BR") : '---'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Tipo</p>
                                                    <p className="text-sm font-medium mt-0.5 capitalize">
                                                        {selectedOrder.tipo_pedido || selectedOrder.tipo_requisicao || '---'}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs text-muted-foreground">Centro de Custo</p>
                                                    <p className="text-sm font-medium mt-0.5">
                                                        {(() => {
                                                            const primeiroItem = selectedOrder.itens_pedido?.[0]
                                                            const cc = primeiroItem?.centroCusto || selectedOrder.subprojeto || '---'
                                                            return `${cc} ${cc !== '---' ? `(${getCostCenterName(cc)})` : ''}`
                                                        })()}
                                                    </p>
                                                </div>
                                                <div>
                                                    {!isSepod && (
                                                        <>
                                                            <p className="text-xs text-muted-foreground">Fonte Pagadora</p>
                                                            <p className="text-sm font-medium mt-0.5">{selectedOrder.fonte_pagadora || '---'}</p>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {selectedOrder.descricao_pedido && (
                                                <div>
                                                    <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                                                        Descrição do Pedido
                                                    </p>
                                                    <div className="text-xs text-foreground bg-muted/30 p-3.5 rounded-lg border border-border whitespace-pre-wrap leading-relaxed">
                                                        {selectedOrder.descricao_pedido}
                                                    </div>
                                                </div>
                                            )}

                                            {selectedOrder.justificativa_compra && (
                                                <div>
                                                    <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                                                        Justificativa da Compra
                                                    </p>
                                                    <div className="text-xs text-foreground bg-muted/30 p-3.5 rounded-lg border border-border whitespace-pre-wrap leading-relaxed">
                                                        {selectedOrder.justificativa_compra}
                                                    </div>
                                                </div>
                                            )}
                                        </TabsContent>

                                        {/* ABA ITENS */}
                                        <TabsContent value="itens" className="space-y-3 m-0">
                                            {selectedOrder.itens_pedido && selectedOrder.itens_pedido.length > 0 ? (
                                                <div className="space-y-3">
                                                    {selectedOrder.itens_pedido.map((item, idx) => {
                                                        const itemNome = item.nomeServico || item.nomeProduto || item.descricao || `Item #${idx + 1}`
                                                        const qtd = item.quantidade || 1
                                                        const valorUnit = item.valorUnitario || item.valorTotal || 0

                                                        return (
                                                            <div key={idx} className="bg-card p-3.5 rounded-xl border border-border flex flex-col gap-2">
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div>
                                                                        <p className="text-sm font-semibold text-foreground">{itemNome}</p>
                                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                                                                            <span>Grupo: <strong>{item.grupo || 'Sem grupo'}</strong></span>
                                                                            <span>•</span>
                                                                            <span>Quantidade: <strong>{qtd}</strong></span>
                                                                            {item.centroCusto && (
                                                                                <>
                                                                                    <span>•</span>
                                                                                    <span>Centro de Custo: <strong>{item.centroCusto}</strong></span>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    {!isSepod && valorUnit > 0 && (
                                                                        <div className="text-right shrink-0">
                                                                            <span className="text-xs text-muted-foreground block">Valor Total</span>
                                                                            <span className="text-sm font-bold text-primary">
                                                                                {formatCurrency(item.valorTotal || (Number(qtd) * Number(valorUnit)))}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {item.descricao && item.descricao !== itemNome && (
                                                                    <p className="text-xs text-muted-foreground bg-muted/20 p-2 rounded border border-border/50">
                                                                        {item.descricao}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="text-center py-8 text-muted-foreground">
                                                    <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                                    <p className="text-sm">Nenhum item discriminado neste pedido</p>
                                                </div>
                                            )}
                                        </TabsContent>

                                        {/* ABA APROVAÇÕES */}
                                        <TabsContent value="aprovacoes" className="space-y-4 m-0">
                                            {((selectedOrder.aprovacoes && selectedOrder.aprovacoes.length > 0) || (selectedOrder.aprovacoesCotacao && selectedOrder.aprovacoesCotacao.length > 0)) ? (
                                                <div className="space-y-4">
                                                    {selectedOrder.aprovacoes && selectedOrder.aprovacoes.length > 0 && (
                                                        <div className="space-y-2">
                                                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                                Aprovações da Requisição
                                                            </h4>
                                                            <div className="space-y-2">
                                                                {selectedOrder.aprovacoes.map((ap: any, idx: number) => {
                                                                    const aprovadorNome = ap.aprovador || ap.usuario || ap.nome || 'Aprovador não informado'
                                                                    const dataAprov = ap.data || ap.dataAprovacao
                                                                    const obs = ap.justificativaRecusa || ap.justificativa || ap.comentario
                                                                    const isApproved = ap.status === 'Aprovado' || ap.status === 'Requisição aprovada'

                                                                    return (
                                                                        <div key={idx} className="p-3 rounded-lg border border-border bg-card flex flex-col gap-1 text-xs">
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="font-semibold text-foreground">
                                                                                    Nível {ap.nivel ?? idx + 1}: {aprovadorNome}
                                                                                </span>
                                                                                <Badge variant="outline" className={isApproved ? 'border-green-500 text-green-600' : 'border-yellow-500 text-yellow-600'}>
                                                                                    {ap.status || 'Pendente'}
                                                                                </Badge>
                                                                            </div>
                                                                            {dataAprov && (
                                                                                <span className="text-muted-foreground">
                                                                                    Data: {new Date(dataAprov.includes(' ') ? dataAprov.replace(' ', 'T') : dataAprov).toLocaleDateString('pt-BR')}
                                                                                </span>
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
                                                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                                Aprovações da Cotação
                                                            </h4>
                                                            <div className="space-y-2">
                                                                {selectedOrder.aprovacoesCotacao.map((ap: any, idx: number) => {
                                                                    const aprovadorNome = ap.aprovador || ap.usuario || ap.nome || 'Aprovador de Cotação'
                                                                    const dataAprov = ap.data || ap.dataAprovacao
                                                                    const obs = ap.justificativaRecusa || ap.justificativa || ap.comentario
                                                                    const isApproved = ap.status === 'Aprovado' || ap.status === 'Cotação aprovada'

                                                                    return (
                                                                        <div key={idx} className="p-3 rounded-lg border border-border bg-card flex flex-col gap-1 text-xs">
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="font-semibold text-foreground">
                                                                                    {ap.nivel ? `Nível ${ap.nivel}: ` : ''}{aprovadorNome}
                                                                                </span>
                                                                                <Badge variant="outline" className={isApproved ? 'border-green-500 text-green-600' : 'border-yellow-500 text-yellow-600'}>
                                                                                    {ap.status || 'Pendente'}
                                                                                </Badge>
                                                                            </div>
                                                                            {dataAprov && (
                                                                                <span className="text-muted-foreground">
                                                                                    Data: {new Date(dataAprov.includes(' ') ? dataAprov.replace(' ', 'T') : dataAprov).toLocaleDateString('pt-BR')}
                                                                                </span>
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
                                                <div className="text-center py-8 text-muted-foreground">
                                                    <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                                    <p className="text-sm">Nenhum registro de aprovação para esta requisição</p>
                                                </div>
                                            )}
                                        </TabsContent>

                                        {/* ABA ENTREGA */}
                                        <TabsContent value="entrega" className="space-y-4 m-0">
                                            {selectedOrder.local_entrega ? (
                                                <div className="bg-card p-4 rounded-xl border border-border space-y-3 text-xs">
                                                    <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                                                        <MapPin className="w-4 h-4 text-primary" />
                                                        <span>Endereço de Entrega</span>
                                                    </div>
                                                    <div className="space-y-1.5 text-muted-foreground">
                                                        <p><strong className="text-foreground">Responsável:</strong> {selectedOrder.local_entrega.responsavel || 'Não informado'}</p>
                                                        <p><strong className="text-foreground">Endereço:</strong> {selectedOrder.local_entrega.endereco}, {selectedOrder.local_entrega.numero} {selectedOrder.local_entrega.complemento ? `(${selectedOrder.local_entrega.complemento})` : ''}</p>
                                                        {selectedOrder.local_entrega.bairro && (
                                                            <p><strong className="text-foreground">Bairro:</strong> {selectedOrder.local_entrega.bairro}</p>
                                                        )}
                                                        <p><strong className="text-foreground">Cidade/UF:</strong> {selectedOrder.local_entrega.cidade}/{selectedOrder.local_entrega.estado} - CEP: {selectedOrder.local_entrega.cep}</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center py-8 text-muted-foreground">
                                                    <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                                    <p className="text-sm">Sem informações de entrega cadastradas</p>
                                                </div>
                                            )}
                                        </TabsContent>

                                        {/* ABA LINHA DO TEMPO (LOGS) */}
                                        {!isSepod && (
                                            <TabsContent value="timeline" className="space-y-4 m-0">
                                                <div className="flex items-center justify-between mb-3">
                                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                        Histórico de Ações
                                                    </h4>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant={timelineFilter === 'todos' ? 'default' : 'outline'}
                                                            size="sm"
                                                            onClick={() => setTimelineFilter('todos')}
                                                            className="h-7 text-xs"
                                                        >
                                                            <Layers className="w-3 h-3 mr-1" />
                                                            Todos
                                                        </Button>
                                                        <Button
                                                            variant={timelineFilter === 'etapas' ? 'default' : 'outline'}
                                                            size="sm"
                                                            onClick={() => setTimelineFilter('etapas')}
                                                            className="h-7 text-xs"
                                                        >
                                                            <Flag className="w-3 h-3 mr-1" />
                                                            Por Etapas
                                                        </Button>
                                                    </div>
                                                </div>

                                                {selectedOrder.logs && selectedOrder.logs.length > 0 ? (
                                                    <div className="space-y-3">
                                                        {selectedOrder.logs.map((log, idx) => (
                                                            <div key={idx} className="border-l-2 border-primary/40 pl-3.5 py-1.5 space-y-0.5">
                                                                <p className="text-xs font-medium text-foreground">{log.acao}</p>
                                                                <p className="text-[11px] text-muted-foreground">
                                                                    {log.autor || 'Sistema'} • {log.data ? new Date(log.data.includes(' ') ? log.data.replace(' ', 'T') : log.data).toLocaleString("pt-BR") : 'Data não informada'}
                                                                </p>
                                                                {log.comentarios && (
                                                                    <p className="text-[11px] text-muted-foreground/80 italic mt-0.5">
                                                                        "{log.comentarios}"
                                                                    </p>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-8 text-muted-foreground">
                                                        <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                                        <p className="text-sm">Nenhum log registrado para este pedido</p>
                                                    </div>
                                                )}
                                            </TabsContent>
                                        )}
                                    </div>
                                </Tabs>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                                <Package className="w-12 h-12 mb-3 opacity-30 text-primary" />
                                <h4 className="text-base font-semibold text-foreground">Nenhum pedido selecionado</h4>
                                <p className="text-xs text-muted-foreground max-w-sm mt-1">
                                    Clique em qualquer pedido da lista ao lado para visualizar todos os detalhes, itens, aprovações e linha do tempo.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
