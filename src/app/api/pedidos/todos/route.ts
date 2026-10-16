import { NextResponse } from 'next/server'
import { pedidosService } from '@/src/lib/api/services'

export async function GET() {
    try {
        const pedidos = await pedidosService.listarTodos({})
        const seen = new Set<string>()
        const deduplicated: any[] = []
        pedidos.forEach((p: any) => {
            const key = p.idPedido ? `p_${p.idPedido}` : (p.idRequisicao ? `r_${p.idRequisicao}` : null)
            if (key) {
                if (!seen.has(key)) {
                    seen.add(key)
                    deduplicated.push(p)
                }
            } else {
                deduplicated.push(p)
            }
        })

        const data = deduplicated.map((p: any) => ({
            id: p.idPedido ? `${p.idRequisicao}_${p.idPedido}` : (p.idRequisicao ? `r_${p.idRequisicao}` : (p.id || '')),
            id_requisicao: String(p.idRequisicao || p.id_requisicao || ''),
            id_pedido: p.idPedido ? String(p.idPedido) : (p.id_pedido ? String(p.id_pedido) : ''),
            titulo: p.titulo || '',
            status_pedido: p.statusPedido || p.status_pedido || '',
            etapa: p.etapa || '',
            fornecedor_nome: p.fornecedor?.nome || p.fornecedor_nome || '',
            fornecedor_documento: p.fornecedor?.documento || p.fornecedor_documento || '',
            requisitante: p.requisitante || p.solicitante || '',
            solicitante: p.solicitante || p.requisitante || '',
            comprador: p.comprador || p.nomeComprador || p.responsavelCotacao || p.responsavel_cotacao || '',
            responsavel_cotacao: p.responsavelCotacao || p.responsavel_cotacao || p.comprador || '',
            data_pedido: p.dataPedido || p.data_pedido || '',
            dataEntregaEstimada: p.dataEntregaEstimada || '',
            tipo_pedido: p.tipoPedido || p.tipo_pedido || p.tipoRequisicao || '',
            tipo_requisicao: p.tipoRequisicao || p.tipo_requisicao || p.tipoPedido || '',
            subprojeto: p.subprojeto || p.centroCustoProjeto || '',
            local_entrega: p.localEntrega || p.local_entrega,
            itens_pedido: p.itensPedido || p.itens_pedido || p.itens || [],
            logs: p.logs || [],
            descricao_pedido: p.descricaoPedido || p.descricao_pedido || '',
            justificativa_compra: p.justificativaCompra || p.justificativa_compra || '',
            fonte_pagadora: p.fontePagadora || p.fonte_pagadora || '',
            conta_plano_financeiro: p.contaPlanoFinanceiro || p.conta_plano_financeiro || '',
            valor_total: p.valorTotal ?? (p.valor_total ?? (p.valorGlobal ?? 0)),
            cancelamento: p.cancelamento || null,
            aprovacoes: p.aprovacoes || [],
            aprovacoesCotacao: p.aprovacoesCotacao || []
        }))
        return NextResponse.json({ data, total: data.length })
    } catch (error: any) {
        console.error('Erro ao buscar todos os pedidos:', error)
        return NextResponse.json(
            { data: [], total: 0, error: error?.message || 'Servidor OngSys demorou a responder (Timeout)' },
            { status: 200 }
        )
    }
}