// src/app/api/pedidos/por-etapa/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { pedidosService } from '@/src/lib/api/services';
import { ETAPAS, identificarEtapaAtual } from '@/src/lib/order-types';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const etapaFiltro = searchParams.get('etapa');

        const pedidos = await pedidosService.listarTodos({});

        // Calcular estatísticas (filtrando etapas visíveis)
        const etapasValidas = ETAPAS.filter(e => !e.oculta);
        const estatisticas = etapasValidas.map(etapa => ({
            nome: etapa.nome,
            ordem: etapa.ordem,
            descricao: etapa.descricao,
            quantidade: 0,
            tempoMedio: 0
        }));

        pedidos.forEach((pedido: any) => {
            const etapa = identificarEtapaAtual(pedido);
            const etapaInfo = estatisticas.find(e => e.nome === etapa);
            if (etapaInfo) etapaInfo.quantidade++;
        });

        // Se tiver filtro de etapa, buscar a página específica
        if (etapaFiltro && etapaFiltro !== 'Todas') {
            const pedidosFiltrados = pedidos.filter((pedido: any) => {
                const etapa = identificarEtapaAtual(pedido);
                return etapa === etapaFiltro;
            });

            const pedidosAdaptados = pedidosFiltrados.slice(0, 50).map((p: any) => ({
                id: p.idPedido || p.id_pedido || p.idRequisicao || p.id,
                id_pedido: p.idPedido || p.id_pedido || '',
                id_requisicao: p.idRequisicao || p.id_requisicao || '',
                titulo: p.titulo,
                status_pedido: p.statusPedido || p.status_pedido,
                etapa: p.etapa,
                fornecedor_nome: p.fornecedor?.nome || p.fornecedor_nome,
                data_pedido: p.dataPedido || p.data_pedido,
                tipo_pedido: p.tipoPedido || p.tipo_pedido
            }));

            return NextResponse.json({
                pedidos: pedidosAdaptados,
                total: pedidosFiltrados.length,
                estatisticas: estatisticas
            });
        }

        return NextResponse.json({
            estatisticas: estatisticas,
            total: pedidos.length
        });
    } catch (error) {
        console.error('Erro ao buscar pedidos por etapa:', error);
        return NextResponse.json(
            { estatisticas: [], total: 0 },
            { status: 200 }
        );
    }
}