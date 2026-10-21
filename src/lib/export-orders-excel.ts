import * as XLSX from 'xlsx'
import {
    Order,
    identificarEtapaAtual,
    getEtapaDateInfo,
    getDataEntradaCotacao,
    getDataEntradaAprovacaoCotacao,
    getDataAprovacaoCotacao,
    getDataFinalizacao
} from '@/src/lib/order-types'
import { getCostCenterName, getCanonicalCostCenterCode } from '@/src/lib/cost-centers-map'

export function exportOrdersToExcel(
    orders: Order[],
    exportTipo: 'pagina' | 'filtro' | 'tudo' = 'filtro',
    getPedidoCentrosCusto?: (pedido: Order) => string[]
) {
    if (!orders || orders.length === 0) {
        alert('Nenhum pedido para exportar.')
        return
    }

    // 1. Preparar dados da aba "Pedidos"
    const pedidosRows = orders.map((order) => {
        const etapaAtual = identificarEtapaAtual(order)
        const etapaDateInfo = getEtapaDateInfo(order, etapaAtual)

        let centrosCodes: string[] = []
        if (getPedidoCentrosCusto) {
            centrosCodes = getPedidoCentrosCusto(order)
        } else {
            const set = new Set<string>()
            order.itens_pedido?.forEach((item: any) => {
                const cc = item.centroCusto || item.centro_custo || item.codigoCentroCusto
                if (cc) set.add(getCanonicalCostCenterCode(String(cc).trim()))
            })
            if (order.subprojeto) set.add(getCanonicalCostCenterCode(String(order.subprojeto).trim()))
            centrosCodes = Array.from(set)
        }

        const centrosNomes = centrosCodes.map(c => getCostCenterName(c)).filter(Boolean)

        const formatDate = (d?: string | null) => {
            if (!d) return '-'
            try {
                const normalized = d.includes(' ') ? d.replace(' ', 'T') : d
                const dt = new Date(normalized)
                return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('pt-BR')
            } catch {
                return d
            }
        }

        const formatDateTime = (d?: string | null) => {
            if (!d) return '-'
            try {
                const normalized = d.includes(' ') ? d.replace(' ', 'T') : d
                const dt = new Date(normalized)
                return isNaN(dt.getTime()) ? d : dt.toLocaleString('pt-BR')
            } catch {
                return d
            }
        }

        return {
            'ID Requisição': order.id_requisicao || '-',
            'ID Pedido': order.id_pedido || '-',
            'Título / Objeto': order.titulo || '-',
            'Etapa Atual': etapaAtual || '-',
            'Status': order.status_pedido || '-',
            'Tipo': order.tipo_pedido || '-',
            'Solicitante': order.solicitante || order.requisitante || '-',
            'Comprador': order.comprador || order.responsavel_cotacao || '-',
            'Fornecedor': order.fornecedor_nome || '-',
            'CNPJ / CPF': order.fornecedor_documento || '-',
            'Data Requisição / Pedido': formatDate(order.data_pedido),
            'Data Entrada Cotação': formatDate(getDataEntradaCotacao(order)),
            'Data Entrada Aprov. Cotação': formatDate(getDataEntradaAprovacaoCotacao(order)),
            'Data Aprovação Cotação': formatDate(getDataAprovacaoCotacao(order)),
            'Data Finalização': formatDate(getDataFinalizacao(order)),
            'Data Marco da Etapa': formatDate(etapaDateInfo?.date),
            'Marco da Etapa': etapaDateInfo?.label || '-',
            'Previsão de Entrega': formatDate(order.dataEntregaEstimada),
            'Centro de Custo (Código)': centrosCodes.join(', ') || '-',
            'Centro de Custo (Nome)': centrosNomes.join(', ') || '-',
            'Subprojeto': order.subprojeto || '-',
            'Qtd Itens': order.itens_pedido?.length || 0,
            'Valor Total (R$)': Number(order.valor_total || 0),
            'Cancelado': order.cancelamento ? 'SIM' : 'NÃO',
            'Motivo Cancelamento': order.cancelamento?.justificativa || '-',
            'Cancelado Por': order.cancelamento?.usuario || '-',
            'Data Cancelamento': formatDateTime(order.cancelamento?.data)
        }
    })

    // 2. Preparar dados da aba "Itens dos Pedidos"
    const itensRows: any[] = []

    orders.forEach((order) => {
        const etapaAtual = identificarEtapaAtual(order)
        const itens = order.itens_pedido || []

        const formatDate = (d?: string | null) => {
            if (!d) return '-'
            try {
                const normalized = d.includes(' ') ? d.replace(' ', 'T') : d
                const dt = new Date(normalized)
                return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('pt-BR')
            } catch {
                return d
            }
        }

        if (itens.length > 0) {
            itens.forEach((item: any, idx: number) => {
                const rawCc = item.centroCusto || item.centro_custo || item.codigoCentroCusto || order.subprojeto || ''
                const ccCode = rawCc ? getCanonicalCostCenterCode(String(rawCc).trim()) : '-'
                const ccNome = ccCode !== '-' ? getCostCenterName(ccCode) : '-'

                const qtd = Number(item.quantidade ?? 1)
                const valorUnit = Number(item.valorUnitario ?? 0)
                const valorTot = Number(item.valorTotal ?? (qtd * valorUnit))

                itensRows.push({
                    'ID Requisição': order.id_requisicao || '-',
                    'ID Pedido': order.id_pedido || '-',
                    'Item #': idx + 1,
                    'Título do Pedido': order.titulo || '-',
                    'Etapa Atual': etapaAtual || '-',
                    'Status Pedido': order.status_pedido || '-',
                    'Grupo / Categoria': item.grupo || '-',
                    'ID Produto': item.idProduto || '-',
                    'Produto / Descrição': item.nomeProduto || item.descricao || '-',
                    'Especificação': item.descricao || '-',
                    'Quantidade': qtd,
                    'Valor Unitário (R$)': valorUnit,
                    'Valor Total Item (R$)': valorTot,
                    'Centro de Custo (Código)': ccCode,
                    'Centro de Custo (Nome)': ccNome,
                    'Fornecedor': order.fornecedor_nome || '-',
                    'Solicitante': order.solicitante || order.requisitante || '-',
                    'Data do Pedido': formatDate(order.data_pedido)
                })
            })
        } else {
            const rawCc = order.subprojeto || (order as any).centro_custo || ''
            const ccCode = rawCc ? getCanonicalCostCenterCode(String(rawCc).trim()) : '-'
            const ccNome = ccCode !== '-' ? getCostCenterName(ccCode) : '-'

            itensRows.push({
                'ID Requisição': order.id_requisicao || '-',
                'ID Pedido': order.id_pedido || '-',
                'Item #': 1,
                'Título do Pedido': order.titulo || '-',
                'Etapa Atual': etapaAtual || '-',
                'Status Pedido': order.status_pedido || '-',
                'Grupo / Categoria': order.tipo_pedido || '-',
                'ID Produto': '-',
                'Produto / Descrição': order.descricao_pedido || order.titulo || 'Item da requisição',
                'Especificação': order.justificativa_compra || '-',
                'Quantidade': 1,
                'Valor Unitário (R$)': Number(order.valor_total || 0),
                'Valor Total Item (R$)': Number(order.valor_total || 0),
                'Centro de Custo (Código)': ccCode,
                'Centro de Custo (Nome)': ccNome,
                'Fornecedor': order.fornecedor_nome || '-',
                'Solicitante': order.solicitante || order.requisitante || '-',
                'Data do Pedido': formatDate(order.data_pedido)
            })
        }
    })

    // 3. Criar a pasta de trabalho (Workbook) e as planilhas (Worksheets)
    const wb = XLSX.utils.book_new()

    const wsPedidos = XLSX.utils.json_to_sheet(pedidosRows)
    const wsItens = XLSX.utils.json_to_sheet(itensRows)

    // Ajustar larguras das colunas
    const autoFitColumns = (rows: any[]) => {
        if (rows.length === 0) return []
        const keys = Object.keys(rows[0])
        return keys.map((key) => {
            const maxValLen = rows.reduce((max, r) => {
                const val = r[key] !== undefined && r[key] !== null ? String(r[key]) : ''
                return Math.max(max, val.length)
            }, key.length)
            return { wch: Math.min(Math.max(maxValLen + 2, 10), 45) }
        })
    }

    wsPedidos['!cols'] = autoFitColumns(pedidosRows)
    wsItens['!cols'] = autoFitColumns(itensRows)

    XLSX.utils.book_append_sheet(wb, wsPedidos, 'Pedidos')
    XLSX.utils.book_append_sheet(wb, wsItens, 'Itens dos Pedidos')

    // 4. Disparar download do arquivo
    const dataHoraStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const nomeArquivo = `ongsys_pedidos_${exportTipo}_${dataHoraStr}.xlsx`

    XLSX.writeFile(wb, nomeArquivo)
}
