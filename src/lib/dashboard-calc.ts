import {
    DashboardSummary,
    TopSupplier,
    TopItem,
    CostCenter,
    AverageTimeMetric
} from './dashboard-types'
import { Order } from './order-types'
import {
    getCostCenterName,
    getCanonicalCostCenterCode,
    getAllEquivalentCostCenterCodes,
    getAtitudeOnlyCostCenters
} from './cost-centers-map'
import { identificarEtapa } from './order-types'

export interface DashboardCalcFilters {
    startDate?: string
    endDate?: string
    costCenter?: string
}

export interface UserAuthInfo {
    role?: string
    centrosCusto?: string[]
}

// Extrai valor do pedido
export function extractValueFromPedido(pedido: any): number {
    if (typeof pedido.valor_total === 'number' && pedido.valor_total > 0) {
        return pedido.valor_total
    }
    if (typeof pedido.valorTotal === 'number' && pedido.valorTotal > 0) {
        return pedido.valorTotal
    }
    if (typeof pedido.valorGlobal === 'number' && pedido.valorGlobal > 0) {
        return pedido.valorGlobal
    }

    const itens = pedido.itens_pedido || pedido.itensPedido || pedido.itens || []
    if (Array.isArray(itens) && itens.length > 0) {
        const total = itens.reduce((acc: number, item: any) => {
            const quantidade = parseFloat(item.quantidade) || 0
            let valorUnitario = 0
            if (item.valorUnitario !== null && item.valorUnitario !== undefined) {
                valorUnitario = parseFloat(item.valorUnitario)
            } else if (item.valor_unitario !== null && item.valor_unitario !== undefined) {
                valorUnitario = parseFloat(item.valor_unitario)
            } else if (item.precoUnitario) {
                valorUnitario = parseFloat(item.precoUnitario)
            } else if (item.valor) {
                valorUnitario = parseFloat(item.valor)
            } else if (item.valorTotal || item.valor_total) {
                return acc + (parseFloat(item.valorTotal || item.valor_total) || 0)
            }
            return acc + (quantidade * valorUnitario)
        }, 0)
        if (total > 0) return total
    }

    return 0
}

// Formata intervalo de tempo legível
export function formatTimeInterval(hours: number): string {
    if (hours === 0) return '0 horas'

    const days = Math.floor(hours / 24)
    const remainingHours = Math.floor(hours % 24)
    const minutes = Math.floor((hours % 1) * 60)

    const parts = []
    if (days > 0) parts.push(`${days} ${days === 1 ? 'dia' : 'dias'}`)
    if (remainingHours > 0) parts.push(`${remainingHours} ${remainingHours === 1 ? 'hora' : 'horas'}`)
    if (minutes > 0 && days === 0) parts.push(`${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`)

    return parts.length > 0 ? parts.join(' e ') : '0 horas'
}

// Calcula o tempo entre aprovação (Etapa 02) e cotação (Etapa 03)
export function calculateTimeBetweenStages(logs: any[]): number | null {
    if (!logs || !Array.isArray(logs)) return null

    const approvals = logs.filter(log => {
        const etapa = identificarEtapa(log)
        return etapa === 'ETAPA 02' || log.acao === 'Aprovou a requisição.'
    })

    const secondApproval = approvals.length >= 2 ? approvals[1] : (approvals[0] || null)

    const quotationFilled = logs.find(log => {
        const etapa = identificarEtapa(log)
        return etapa === 'ETAPA 03' || log.acao === 'Preencheu a cotação da requisição'
    })

    if (secondApproval && quotationFilled) {
        try {
            const approvalDate = new Date(String(secondApproval.data).replace(' ', 'T'))
            const quotationDate = new Date(String(quotationFilled.data).replace(' ', 'T'))

            if (isNaN(approvalDate.getTime()) || isNaN(quotationDate.getTime())) {
                return null
            }

            const diffHours = (quotationDate.getTime() - approvalDate.getTime()) / (1000 * 60 * 60)
            return diffHours > 0 ? diffHours : null
        } catch {
            return null
        }
    }

    return null
}

/**
 * Função pura e síncrona para calcular o resumo do Dashboard
 * a partir de uma lista em memória de pedidos.
 */
export function calculateDashboardSummary(
    pedidos: Order[],
    filters: DashboardCalcFilters = {},
    user: UserAuthInfo = {}
): DashboardSummary {
    const userRole = user.role
    const atitudeDefaultCodes = getAtitudeOnlyCostCenters().map(c => c.code)
    const userCentrosCusto: string[] = user.centrosCusto && user.centrosCusto.length > 0
        ? user.centrosCusto
        : (userRole === 'SEPOD' ? atitudeDefaultCodes : [])

    const { startDate, endDate, costCenter } = filters

    // 1. Determinar filtros de centros de custo autorizados
    let centrosCustoParaFiltrar: string[] = []

    if (userRole === 'CONSULTOR' || userRole === 'SEPOD') {
        if (costCenter && costCenter !== 'todos' && userCentrosCusto.includes(costCenter)) {
            centrosCustoParaFiltrar = [costCenter]
        } else {
            centrosCustoParaFiltrar = userCentrosCusto
        }
    } else if (costCenter && costCenter !== 'todos') {
        centrosCustoParaFiltrar = [costCenter]
    }

    // 2. Filtrar pedidos em memória
    let pedidosFiltrados = pedidos

    // Filtro por centro de custo
    if (centrosCustoParaFiltrar.length > 0) {
        const centrosExpandidos = Array.from(new Set(
            centrosCustoParaFiltrar.flatMap(c => getAllEquivalentCostCenterCodes(c))
        ))

        pedidosFiltrados = pedidosFiltrados.filter(pedido => {
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

    // Filtro por data inicial
    if (startDate) {
        pedidosFiltrados = pedidosFiltrados.filter(pedido => {
            const rawDate = pedido.data_pedido || pedido.dataEntregaEstimada
            if (!rawDate) return false
            const d = String(rawDate).split('T')[0].split(' ')[0]
            return d >= startDate
        })
    }

    // Filtro por data final
    if (endDate) {
        pedidosFiltrados = pedidosFiltrados.filter(pedido => {
            const rawDate = pedido.data_pedido || pedido.dataEntregaEstimada
            if (!rawDate) return false
            const d = String(rawDate).split('T')[0].split(' ')[0]
            return d <= endDate
        })
    }

    // 3. Separar por tipo de pedido
    const pedidosProduto = pedidosFiltrados.filter(p => {
        const tipo = String(p.tipo_pedido || p.tipo_requisicao || '').toLowerCase()
        return tipo === 'produto'
    })

    const pedidosServico = pedidosFiltrados.filter(p => {
        const tipo = String(p.tipo_pedido || p.tipo_requisicao || '').toLowerCase()
        return tipo === 'serviço' || tipo === 'servico'
    })

    const totalProductOrders = pedidosProduto.length
    const totalProductOrdersValue = pedidosProduto.reduce((acc, p) => acc + extractValueFromPedido(p), 0)
    const totalServiceOrders = pedidosServico.length
    const totalServiceOrdersValue = pedidosServico.reduce((acc, p) => acc + extractValueFromPedido(p), 0)

    // 4. Top 10 Fornecedores
    const supplierMap = new Map<string, TopSupplier>()
    pedidosFiltrados.forEach(pedido => {
        const nomeFornecedor = pedido.fornecedor_nome || (pedido as any).fornecedor?.nome
        const docFornecedor = pedido.fornecedor_documento || (pedido as any).fornecedor?.documento || '---'

        if (nomeFornecedor) {
            const key = docFornecedor !== '---' ? docFornecedor : nomeFornecedor
            if (!supplierMap.has(key)) {
                supplierMap.set(key, {
                    name: nomeFornecedor,
                    document: docFornecedor,
                    totalValue: 0,
                    orderCount: 0
                })
            }
            const supplier = supplierMap.get(key)!
            supplier.totalValue += extractValueFromPedido(pedido)
            supplier.orderCount += 1
        }
    })

    const topSuppliers = Array.from(supplierMap.values())
        .sort((a, b) => b.totalValue - a.totalValue || b.orderCount - a.orderCount)
        .slice(0, 10)

    // 5. Top 10 Itens Mais Pedidos
    const itemMap = new Map<string, TopItem>()
    pedidosFiltrados.forEach(pedido => {
        const itens = pedido.itens_pedido || (pedido as any).itensPedido || []
        itens.forEach((item: any) => {
            const key = item.nomeServico || item.nomeProduto || item.nome || item.descricao || 'Item sem nome'
            if (!itemMap.has(key)) {
                itemMap.set(key, {
                    name: key,
                    group: item.grupo || 'Sem grupo',
                    totalQuantity: 0,
                    totalValue: 0,
                    orderCount: 0
                })
            }
            const mapped = itemMap.get(key)!
            const quantity = parseFloat(item.quantidade) || 1
            const unitValue = parseFloat(item.valorUnitario || item.valor_unitario || item.precoUnitario || item.valor) || 0
            let itemValue = quantity * unitValue
            if (itemValue === 0 && (item.valorTotal || item.valor_total)) {
                itemValue = parseFloat(item.valorTotal || item.valor_total) || 0
            }

            mapped.totalQuantity += quantity
            mapped.totalValue += itemValue
            mapped.orderCount += 1
        })
    })

    const topItems = Array.from(itemMap.values())
        .sort((a, b) => b.orderCount - a.orderCount || b.totalQuantity - a.totalQuantity || b.totalValue - a.totalValue)
        .slice(0, 10)

    // 6. Tempo Médio Aprovação -> Cotação
    let totalTimeBetweenStages = 0
    let validOrdersCount = 0

    pedidosFiltrados.forEach(pedido => {
        const logs = pedido.logs || []
        const timeBetweenStages = calculateTimeBetweenStages(logs)
        if (timeBetweenStages !== null && timeBetweenStages > 0) {
            totalTimeBetweenStages += timeBetweenStages
            validOrdersCount++
        }
    })

    const averageTimeHours = validOrdersCount > 0 ? totalTimeBetweenStages / validOrdersCount : 0
    const averageTimeMetric: AverageTimeMetric = {
        hours: averageTimeHours,
        formatted: formatTimeInterval(averageTimeHours),
        totalOrders: validOrdersCount
    }

    // 7. Centros de Custo Disponíveis para seleção
    let availableCostCenters: CostCenter[] = []
    if (userRole === 'CONSULTOR' || userRole === 'SEPOD') {
        const uniqueCodes = Array.from(new Set(userCentrosCusto.map(getCanonicalCostCenterCode)))
        availableCostCenters = uniqueCodes.map(code => ({
            code,
            name: getCostCenterName(code),
            totalValue: 0,
            orderCount: 0
        })).sort((a, b) => a.name.localeCompare(b.name))
    } else {
        const costCenterSet = new Set<string>()
        pedidos.forEach(pedido => {
            const itens = pedido.itens_pedido || (pedido as any).itensPedido || []
            itens.forEach((item: any) => {
                const cc = item.centroCusto || item.centro_custo || item.codigoCentroCusto
                if (cc) costCenterSet.add(getCanonicalCostCenterCode(String(cc).trim()))
            })
            if (pedido.subprojeto) costCenterSet.add(getCanonicalCostCenterCode(String(pedido.subprojeto).trim()))
        })

        availableCostCenters = Array.from(costCenterSet)
            .map(code => ({ code, name: getCostCenterName(code), totalValue: 0, orderCount: 0 }))
            .sort((a, b) => a.name.localeCompare(b.name))
    }

    return {
        totalProductOrders,
        totalProductOrdersValue,
        totalServiceOrders,
        totalServiceOrdersValue,
        totalSuppliers: 0,
        totalPayable: 0,
        totalReceivable: 0,
        lowStockProducts: 0,
        topSuppliers,
        topItems,
        availableCostCenters,
        unitMeasureData: [],
        recentAccounts: [],
        averageTimeApprovalToQuotation: averageTimeMetric
    }
}
