// src/app/api/pedidos/por-etapa/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { pedidosService } from '@/src/lib/api/services';
import { ETAPAS, identificarEtapaAtual } from '@/src/lib/order-types';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const etapaFiltro = searchParams.get('etapa');

        // 🔥 Buscar apenas a primeira página para estatísticas (mais rápido)
        const primeiraPagina = await pedidosService.listar({}, 1);
        const pedidos = primeiraPagina.data || [];

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
            const etapa = identificarEtapaAtual(pedido.logs || [], pedido.statusPedido || pedido.status_pedido);
            const etapaInfo = estatisticas.find(e => e.nome === etapa);
            if (etapaInfo) etapaInfo.quantidade++;
        });

        // Se tiver filtro de etapa, buscar a página específica
        if (etapaFiltro && etapaFiltro !== 'Todas') {
            // Para o filtro, buscamos mais páginas
            const todosPedidos = await pedidosService.listarTodos({});
            const pedidosFiltrados = todosPedidos.filter((pedido: any) => {
                const etapa = identificarEtapaAtual(pedido.logs || [], pedido.statusPedido || pedido.status_pedido);
                return etapa === etapaFiltro;
            });

            const pedidosAdaptados = pedidosFiltrados.slice(0, 50).map((p: any) => ({
                id: p.idPedido,
                id_pedido: p.idPedido,
                titulo: p.titulo,
                status_pedido: p.statusPedido,
                fornecedor_nome: p.fornecedor?.nome,
                data_pedido: p.dataPedido,
                tipo_pedido: p.tipoPedido
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