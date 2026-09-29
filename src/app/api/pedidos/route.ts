import { NextRequest, NextResponse } from 'next/server';
import { pedidosService } from '@/src/lib/api/services';
import { getCached, setCached } from '@/src/lib/api/cache';

const CACHE_KEY = 'pedidos_completo';
const LOADING_KEY = 'pedidos_loading';

// Controle para evitar múltiplas requisições simultâneas
let isLoading = false;
let loadingPromise: Promise<any> | null = null;

async function fetchAllPedidos(forceRefresh = false): Promise<any[]> {
    // Se já está carregando, aguarda
    if (isLoading && loadingPromise && !forceRefresh) {
        console.log('⏳ [API /pedidos] Aguardando carregamento em andamento...');
        return loadingPromise;
    }

    isLoading = true;
    loadingPromise = (async () => {
        try {
            console.log(`🔄 [API /pedidos] Buscando da API externa...`);

            // Buscar a primeira página para obter o total
            const primeiraPagina = await pedidosService.listar({}, 1);
            const totalPaginas = primeiraPagina.totalPages || 1;
            let allData = [...(primeiraPagina.data || [])];

            console.log(`📊 [API /pedidos] Total de páginas: ${totalPaginas}`);

            // Buscar páginas restantes com limite de concorrência
            if (totalPaginas > 1) {
                const CONCURRENCY = 3;
                const remainingPages = [];
                for (let p = 2; p <= totalPaginas; p++) {
                    remainingPages.push(p);
                }

                for (let i = 0; i < remainingPages.length; i += CONCURRENCY) {
                    const batch = remainingPages.slice(i, i + CONCURRENCY);
                    console.log(`📄 [API /pedidos] Buscando páginas ${batch.join(', ')}...`);

                    const promises = batch.map(page =>
                        pedidosService.listar({}, page).catch(err => {
                            console.error(`❌ [API /pedidos] Erro na página ${page}:`, err.message);
                            return { data: [] };
                        })
                    );

                    const results = await Promise.all(promises);
                    results.forEach(result => {
                        if (result.data && result.data.length) {
                            allData = [...allData, ...result.data];
                        }
                    });

                    if (i + CONCURRENCY < remainingPages.length) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }

            console.log(`✅ [API /pedidos] Carregados ${allData.length} pedidos`);
            return allData;
        } finally {
            isLoading = false;
            loadingPromise = null;
        }
    })();

    return loadingPromise;
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const refresh = searchParams.get('refresh') === 'true';

        // 🔥 Tenta obter do cache - apenas 1 argumento
        let allPedidos = !refresh ? getCached<any[]>(CACHE_KEY) : null;

        if (allPedidos) {
            console.log(`📦 [API /pedidos] Usando cache com ${allPedidos.length} pedidos`);
        } else {
            if (refresh) {
                console.log(`🔄 [API /pedidos] Refresh forçado, ignorando cache`);
            }
            allPedidos = await fetchAllPedidos(refresh);

            // Salvar no cache
            if (allPedidos && allPedidos.length > 0) {
                setCached(CACHE_KEY, allPedidos);
            }
        }

        if (!allPedidos || allPedidos.length === 0) {
            return NextResponse.json(
                { error: 'Nenhum pedido encontrado' },
                { status: 404 }
            );
        }

        // Paginar os resultados
        const pageSize = 100;
        const start = (page - 1) * pageSize;
        const paginated = allPedidos.slice(start, start + pageSize);

        const pedidosAdaptados = paginated.map((p: any) => ({
            id: p.idPedido ? `${p.idRequisicao}_${p.idPedido}` : (p.idRequisicao || p.id || ''),
            id_requisicao: p.idRequisicao || '',
            id_pedido: p.idPedido || '',
            titulo: p.titulo || '',
            status_pedido: p.statusPedido || '',
            fornecedor_nome: p.fornecedor?.nome || '',
            fornecedor_documento: p.fornecedor?.documento || '',
            requisitante: p.requisitante || '',
            comprador: p.comprador || '',
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
        }));

        return NextResponse.json({
            data: pedidosAdaptados,
            total: allPedidos.length,
            totalPages: Math.ceil(allPedidos.length / pageSize),
            currentPage: page,
            fromCache: !!allPedidos
        });

    } catch (error: any) {
        console.error('❌ [API /pedidos] Erro:', error);

        // 🔥 Tentar retornar do cache mesmo que expirado - apenas 1 argumento
        const cachedData = getCached<any[]>(CACHE_KEY);
        if (cachedData) {
            console.log(`⚠️ [API /pedidos] Retornando cache expirado devido a erro`);
            return NextResponse.json({
                data: cachedData.slice(0, 100),
                total: cachedData.length,
                totalPages: Math.ceil(cachedData.length / 100),
                currentPage: 1,
                fromCache: true,
                stale: true
            });
        }

        return NextResponse.json(
            { error: 'Erro ao buscar pedidos: ' + error.message },
            { status: 500 }
        );
    }
}