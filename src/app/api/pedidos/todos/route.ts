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
            id: p.idPedido ? `${p.idRequisicao}_${p.idPedido}` : (p.idRequisicao || p.id || ''),
            id_requisicao: p.idRequisicao || '',
            id_pedido: p.idPedido || '',
            titulo: p.titulo || '',
            status_pedido: p.statusPedido || '',
            fornecedor_nome: p.fornecedor?.nome || '',
            fornecedor_documento: p.fornecedor?.documento || '',
            requisitante: p.requisitante || '',
            comprador: p.comprador || p.nomeComprador || '',
            data_pedido: p.dataPedido || '',
            dataEntregaEstimada: p.dataEntregaEstimada || '',
            tipo_pedido: p.tipoPedido || '',
            local_entrega: p.localEntrega,
            itens_pedido: p.itensPedido || p.itens_pedido || [],
            logs: p.logs || [],
            descricao_pedido: p.descricaoPedido || '',
            justificativa_compra: p.justificativaCompra || '',
            fonte_pagadora: p.fontePagadora || '',
            conta_plano_financeiro: p.contaPlanoFinanceiro || '',
            valor_total: p.valorTotal || 0
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