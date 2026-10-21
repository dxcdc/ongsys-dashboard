import { Order } from '@/src/lib/order-types'

/**
 * Normaliza um objeto de pedido bruto retornado pela API OngSys (/api/v2/pedidos)
 * para o formato unificado utilizado nas telas de Dashboard e Pedidos.
 */
export function adaptPedido(p: any): Order {
    if (!p) return {} as Order

    const idPedido = p.idPedido ? String(p.idPedido) : (p.id_pedido ? String(p.id_pedido) : '')
    const idRequisicao = p.idRequisicao ? String(p.idRequisicao) : (p.id_requisicao ? String(p.id_requisicao) : '')
    const id = idPedido 
        ? `${idRequisicao}_${idPedido}` 
        : (idRequisicao ? `r_${idRequisicao}` : (p.id ? String(p.id) : `gen_${Math.random()}`))

    // Itens do pedido normalizados
    const rawItens = p.itensPedido || p.itens_pedido || p.itens || []
    const itensPedido = Array.isArray(rawItens)
        ? rawItens.map((item: any) => ({
            ...item,
            centroCusto: item.centroCusto || item.centro_custo || item.codigoCentroCusto || '',
            grupo: item.grupo || 'Sem grupo',
            quantidade: parseFloat(item.quantidade) || 0,
            valorUnitario: item.valorUnitario !== null && item.valorUnitario !== undefined 
                ? parseFloat(item.valorUnitario) 
                : (item.valor_unitario ? parseFloat(item.valor_unitario) : null),
            valorTotal: item.valorTotal !== null && item.valorTotal !== undefined 
                ? parseFloat(item.valorTotal) 
                : (item.valor_total ? parseFloat(item.valor_total) : null)
        }))
        : []

    // Fornecedor
    const fornecedorNome = p.fornecedor?.nome || p.fornecedor_nome || ''
    const fornecedorDoc = p.fornecedor?.documento || p.fornecedor_documento || ''

    // Datas
    const dataPedido = p.dataPedido || p.data_pedido || ''
    const dataEntregaEstimada = p.dataEntregaEstimada || ''

    // Valor Total
    let valorTotal = 0
    if (typeof p.valorTotal === 'number') {
        valorTotal = p.valorTotal
    } else if (typeof p.valor_total === 'number') {
        valorTotal = p.valor_total
    } else if (typeof p.valorGlobal === 'number') {
        valorTotal = p.valorGlobal
    } else if (p.valorTotal) {
        valorTotal = parseFloat(p.valorTotal) || 0
    } else if (p.valor_total) {
        valorTotal = parseFloat(p.valor_total) || 0
    } else if (itensPedido.length > 0) {
        valorTotal = itensPedido.reduce((acc: number, it: any) => {
            const qtd = it.quantidade || 0
            const unit = it.valorUnitario || 0
            return acc + (qtd * unit)
        }, 0)
    }

    return {
        id,
        id_requisicao: idRequisicao,
        id_pedido: idPedido,
        titulo: p.titulo || '',
        status_pedido: p.statusPedido || p.status_pedido || '',
        etapa: p.etapa || '',
        fornecedor_nome: fornecedorNome,
        fornecedor_documento: fornecedorDoc,
        requisitante: p.requisitante || p.solicitante || '',
        solicitante: p.solicitante || p.requisitante || '',
        comprador: p.comprador || p.nomeComprador || p.responsavelCotacao || p.responsavel_cotacao || '',
        responsavel_cotacao: p.responsavelCotacao || p.responsavel_cotacao || p.comprador || '',
        data_pedido: dataPedido,
        dataEntregaEstimada,
        tipo_pedido: p.tipoPedido || p.tipo_pedido || p.tipoRequisicao || 'produto',
        tipo_requisicao: p.tipoRequisicao || p.tipo_requisicao || p.tipoPedido || 'produto',
        subprojeto: p.subprojeto || p.centroCustoProjeto || '',
        local_entrega: p.localEntrega || p.local_entrega,
        itens_pedido: itensPedido,
        logs: Array.isArray(p.logs) ? p.logs : [],
        descricao_pedido: p.descricaoPedido || p.descricao_pedido || '',
        justificativa_compra: p.justificativaCompra || p.justificativa_compra || '',
        fonte_pagadora: p.fontePagadora || p.fonte_pagadora || '',
        conta_plano_financeiro: p.contaPlanoFinanceiro || p.conta_plano_financeiro || '',
        valor_total: valorTotal,
        cancelamento: p.cancelamento || null,
        aprovacoes: Array.isArray(p.aprovacoes) ? p.aprovacoes : [],
        aprovacoesCotacao: Array.isArray(p.aprovacoesCotacao) ? p.aprovacoesCotacao : []
    }
}

/**
 * Adapta uma requisição bruta (/api/v2/requisicoes) sem pedido correspondente
 * criando a ordem sintética para cobrir Etapas 1 a 4 e requisições canceladas/órfãs.
 */
export function adaptRequisicao(req: any): Order {
    if (!req) return {} as Order

    const hasCancelamento = req.cancelamento !== null && req.cancelamento !== undefined
    const reqStatusUpper = String(req.status || '').toUpperCase()
    const isStatusCancelado = reqStatusUpper.includes('CANCEL') || reqStatusUpper.includes('NEGAD') || reqStatusUpper.includes('REJEIT')
    const isCancelado = hasCancelamento || isStatusCancelado || req.etapa === null

    const etapaStr = isCancelado ? 'CANCELADO' : `ETAPA 0${req.etapa || 1}`
    const statusStr = isCancelado ? (req.status || 'Cancelado') : (req.status || `Etapa 0${req.etapa || 1}`)

    const rawItens = req.itens || []
    const itensPedido = Array.isArray(rawItens)
        ? rawItens.map((it: any) => ({
            idProduto: it.idProduto,
            idServico: it.idServico,
            nomeProduto: it.nome,
            nomeServico: it.nome,
            quantidade: parseFloat(it.quantidade) || 0,
            valorUnitario: it.valorUnitario !== null && it.valorUnitario !== undefined ? parseFloat(it.valorUnitario) : null,
            valorTotal: it.valorTotal !== null && it.valorTotal !== undefined ? parseFloat(it.valorTotal) : null,
            centroCusto: req.centroCustoProjeto || req.subprojeto || '',
            grupo: it.grupo || 'Geral',
            controleEntregas: []
        }))
        : []

    let valorTotal = 0
    if (typeof req.valorGlobal === 'number') {
        valorTotal = req.valorGlobal
    } else if (req.valorGlobal) {
        valorTotal = parseFloat(req.valorGlobal) || 0
    } else if (itensPedido.length > 0) {
        valorTotal = itensPedido.reduce((acc: number, it: any) => {
            const qtd = it.quantidade || 0
            const unit = it.valorUnitario || 0
            return acc + (qtd * unit)
        }, 0)
    }

    return {
        id: `r_${req.idRequisicao}`,
        id_requisicao: String(req.idRequisicao || ''),
        id_pedido: '',
        titulo: req.titulo || '',
        status_pedido: statusStr,
        etapa: etapaStr,
        fornecedor_nome: isCancelado ? 'Cancelado antes do pedido' : 'Em cotação / aprovação',
        fornecedor_documento: '',
        requisitante: req.solicitante || '',
        solicitante: req.solicitante || '',
        comprador: req.responsavelCotacao || '',
        responsavel_cotacao: req.responsavelCotacao || '',
        data_pedido: req.dataRequisicao || '',
        dataEntregaEstimada: req.dataPrevistaEntrega || '',
        tipo_pedido: req.tipoRequisicao || 'produto',
        tipo_requisicao: req.tipoRequisicao || 'produto',
        subprojeto: req.subprojeto || req.centroCustoProjeto || '',
        local_entrega: req.localEntrega,
        itens_pedido: itensPedido,
        logs: Array.isArray(req.logs) ? req.logs : [],
        descricao_pedido: req.descricaoRequisicao || '',
        justificativa_compra: req.justificativaCompra || '',
        fonte_pagadora: req.fontePagadora || '',
        conta_plano_financeiro: req.contaPlanoFinanceiro || '',
        valor_total: valorTotal,
        cancelamento: req.cancelamento || (isCancelado ? { usuario: 'Sistema', justificativa: req.status || 'Ordem Negada' } : null),
        aprovacoes: Array.isArray(req.aprovacoes) ? req.aprovacoes : [],
        aprovacoesCotacao: Array.isArray(req.aprovacoesCotacao) ? req.aprovacoesCotacao : []
    }
}

/**
 * Enriquece um pedido existente com dados da requisição correspondente (logs, aprovações, etc.)
 */
export function enrichPedidoWithRequisicao(pedido: Order, req: any): Order {
    const cloned = { ...pedido }

    const hasCancelamento = req.cancelamento !== null && req.cancelamento !== undefined
    const reqStatusUpper = String(req.status || '').toUpperCase()
    const reqStatusCancelado = reqStatusUpper.includes('CANCEL') || reqStatusUpper.includes('NEGAD') || reqStatusUpper.includes('REJEIT')
    const isReqCancelado = hasCancelamento || reqStatusCancelado || req.etapa === null

    if (isReqCancelado) {
        cloned.cancelamento = req.cancelamento || { usuario: 'Sistema', justificativa: req.status || 'Ordem Negada' }
        cloned.etapa = 'CANCELADO'
        cloned.status_pedido = 'Cancelado'
    } else {
        cloned.cancelamento = null
        if (req.etapa) {
            cloned.etapa = `ETAPA 0${req.etapa}`
        }
    }

    cloned.solicitante = req.solicitante || cloned.requisitante
    cloned.requisitante = cloned.requisitante || req.solicitante
    cloned.responsavel_cotacao = req.responsavelCotacao || cloned.comprador
    cloned.comprador = cloned.comprador || req.responsavelCotacao
    cloned.aprovacoes = req.aprovacoes || cloned.aprovacoes || []
    cloned.aprovacoesCotacao = req.aprovacoesCotacao || cloned.aprovacoesCotacao || []
    cloned.subprojeto = cloned.subprojeto || req.subprojeto || req.centroCustoProjeto
    cloned.tipo_requisicao = req.tipoRequisicao || cloned.tipo_pedido

    if ((!cloned.logs || cloned.logs.length === 0) && req.logs && req.logs.length > 0) {
        cloned.logs = req.logs
    }

    return cloned
}

/**
 * Retorna uma chave determinística para deduplicação em memória.
 */
export function getOrderKey(order: any): string {
    const pedId = order.id_pedido || order.idPedido
    if (pedId && String(pedId).trim() !== '') return `p_${pedId}`

    const reqId = order.id_requisicao || order.idRequisicao
    if (reqId && String(reqId).trim() !== '') return `r_${reqId}`

    const id = order.id
    if (id && String(id).trim() !== '') return `id_${id}`

    return `temp_${Math.random()}`
}
