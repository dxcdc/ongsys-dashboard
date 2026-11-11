import { apiGet } from './client'
import { ApiParams } from './types'
import { getCached, setCached } from './cache'

export interface DateFilter {
    startDate?: string
    endDate?: string
    costCenter?: string
}

function getDefaultDates() {
    const hoje = new Date()
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    return {
        data_inicio: primeiroDia.toISOString().split('T')[0],
        data_fim: ultimoDia.toISOString().split('T')[0]
    }
}

const pendingRequests = new Map<string, Promise<any[]>>()

export const requisicoesService = {
    async listar(filters: DateFilter = {}, page = 1) {
        const params: ApiParams = {
            pageNumber: page,
            exibir_logs: true
        }
        if (filters.startDate) params.data_inicio = filters.startDate
        if (filters.endDate) params.data_fim = filters.endDate
        return apiGet('requisicoes', params)
    },

    async listarTodos(filters: DateFilter = {}): Promise<any[]> {
        const cacheKey = `requisicoes_${filters.startDate || ''}_${filters.endDate || ''}`

        const cached = getCached<any[]>(cacheKey)
        if (cached) return cached

        if (pendingRequests.has(cacheKey)) {
            return pendingRequests.get(cacheKey)!
        }

        const promise = (async () => {
            console.log('🔄 Buscando todas as requisições...')
            const startTime = Date.now()

            let data: any[] = []
            try {
                const primeiraPagina = await this.listar(filters, 1)
                const totalPages = primeiraPagina.totalPages
                const totalItems = primeiraPagina.totalItems
                console.log(`📊 Total de páginas requisições: ${totalPages} (${totalItems} requisições)`)

                data = [...(primeiraPagina.data || [])]

                if (totalPages > 1) {
                    const BATCH_SIZE = 4

                    for (let batchStart = 2; batchStart <= totalPages; batchStart += BATCH_SIZE) {
                        const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, totalPages)

                        const promises = Array.from(
                            { length: batchEnd - batchStart + 1 },
                            (_, i) => this.listar(filters, batchStart + i)
                        )

                        const resultados = await Promise.allSettled(promises)
                        resultados.forEach((resultado, i) => {
                            if (resultado.status === 'fulfilled') {
                                data.push(...(resultado.value.data || []))
                            } else {
                                console.warn(`⚠️ Página ${batchStart + i} de requisições falhou`)
                            }
                        })

                        if (batchEnd < totalPages) {
                            await new Promise(r => setTimeout(r, 150))
                        }
                    }
                }

                // Deduplicar requisições por idRequisicao ou id_requisicao
                const seen = new Set<string>()
                const deduplicatedData: any[] = []
                data.forEach((r: any) => {
                    const reqId = r.id_requisicao ?? r.idRequisicao
                    const key = reqId ? String(reqId) : null
                    if (key) {
                        if (!seen.has(key)) {
                            seen.add(key)
                            deduplicatedData.push(r)
                        }
                    } else {
                        deduplicatedData.push(r)
                    }
                })

                const duration = Date.now() - startTime
                console.log(`✅ ${deduplicatedData.length} requisições únicas carregadas em ${duration}ms`)

                setCached(cacheKey, deduplicatedData)
                return deduplicatedData
            } catch (error) {
                console.error('❌ Erro ao buscar requisições:', error)
                const fallbackCache = getCached<any[]>(cacheKey)
                if (fallbackCache && fallbackCache.length > 0) {
                    return fallbackCache
                }
                return data || []
            } finally {
                pendingRequests.delete(cacheKey)
            }
        })()

        pendingRequests.set(cacheKey, promise)
        return promise
    }
}

export const pedidosService = {
    async listar(filters: DateFilter = {}, page = 1) {
        const params: ApiParams = { pageNumber: page }
        if (filters.startDate) params.data_inicio = filters.startDate
        if (filters.endDate) params.data_fim = filters.endDate
        return apiGet('pedidos', params)
    },

    async buscarPedidosBrutos(filters: DateFilter = {}): Promise<any[]> {
        const rawCacheKey = `raw_pedidos_${filters.startDate || ''}_${filters.endDate || ''}`
        const cached = getCached<any[]>(rawCacheKey)
        if (cached) return cached

        let data: any[] = []
        try {
            const primeiraPagina = await this.listar(filters, 1)
            const totalPages = primeiraPagina.totalPages
            const totalItems = primeiraPagina.totalItems
            console.log(`📊 Total de páginas pedidos: ${totalPages} (${totalItems} pedidos)`)

            data = [...(primeiraPagina.data || [])]

            if (totalPages > 1) {
                const BATCH_SIZE = 3
                for (let batchStart = 2; batchStart <= totalPages; batchStart += BATCH_SIZE) {
                    const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, totalPages)
                    const promises = Array.from(
                        { length: batchEnd - batchStart + 1 },
                        (_, i) => this.listar(filters, batchStart + i)
                    )
                    const resultados = await Promise.allSettled(promises)
                    resultados.forEach((resultado, i) => {
                        if (resultado.status === 'fulfilled') {
                            data.push(...(resultado.value.data || []))
                        } else {
                            console.warn(`⚠️ Página ${batchStart + i} de pedidos falhou definitivamente`)
                        }
                    })
                    if (batchEnd < totalPages) {
                        await new Promise(r => setTimeout(r, 200))
                    }
                }
            }

            const seen = new Set<string>()
            const deduplicatedData: any[] = []
            data.forEach((p: any) => {
                const pedId = p.id_pedido ?? p.idPedido
                const reqId = p.id_requisicao ?? p.idRequisicao
                const key = pedId ? `p_${pedId}` : (reqId ? `r_${reqId}` : null)
                if (key) {
                    if (!seen.has(key)) {
                        seen.add(key)
                        deduplicatedData.push(p)
                    }
                } else {
                    deduplicatedData.push(p)
                }
            })

            setCached(rawCacheKey, deduplicatedData)
            return deduplicatedData
        } catch (error) {
            console.error('❌ Erro ao buscar pedidos brutos:', error)
            const fallbackCache = getCached<any[]>(rawCacheKey)
            if (fallbackCache && fallbackCache.length > 0) return fallbackCache
            return data || []
        }
    },

    async listarTodos(filters: DateFilter = {}): Promise<any[]> {
        const cacheKey = `pedidos_v2_${filters.startDate || ''}_${filters.endDate || ''}`

        const cached = getCached<any[]>(cacheKey)
        if (cached) return cached

        // Evitar requisições duplicadas simultâneas (race condition)
        if (pendingRequests.has(cacheKey)) {
            console.log('⏳ Aguardando requisição já em andamento...')
            return pendingRequests.get(cacheKey)!
        }

        const promise = (async () => {
            console.log('🔄 Buscando pedidos e integrando requisições (Etapas 1-4)...')
            const startTime = Date.now()

            try {
                const [pedidosRaw, requisicoesRaw] = await Promise.all([
                    this.buscarPedidosBrutos(filters),
                    requisicoesService.listarTodos(filters).catch(err => {
                        console.error('⚠️ Falha ao buscar requisições na integração:', err)
                        return []
                    })
                ])

                console.log(`📦 Cruzando ${pedidosRaw.length} pedidos com ${requisicoesRaw.length} requisições...`)

                // Mapear requisições por idRequisicao ou id_requisicao
                const reqMap = new Map<string, any>()
                requisicoesRaw.forEach((req: any) => {
                    const reqId = req.id_requisicao ?? req.idRequisicao
                    if (reqId !== undefined && reqId !== null && reqId !== '') {
                        reqMap.set(String(reqId), req)
                    }
                })

                const matchedReqIds = new Set<string>()
                const mergedList: any[] = []

                // 1. Processar pedidos existentes (Etapas 5 e 6, ou pedidos vinculados)
                pedidosRaw.forEach((p: any) => {
                    const cloned = { ...p }
                    const rawReqId = cloned.id_requisicao ?? cloned.idRequisicao
                    const reqId = rawReqId ? String(rawReqId) : null

                    if (reqId && reqMap.has(reqId)) {
                        matchedReqIds.add(reqId)
                        const req = reqMap.get(reqId)!

                        // Regra de cancelamento
                        const hasCancelamento = req.cancelamento !== null && req.cancelamento !== undefined
                        const reqStatusUpper = String(req.status || '').toUpperCase()
                        const reqStatusCancelado = reqStatusUpper.includes('CANCEL') || reqStatusUpper.includes('NEGAD') || reqStatusUpper.includes('REJEIT')
                        const isReqCancelado = hasCancelamento || reqStatusCancelado || req.etapa === null

                        const reqStatus = req.status || (isReqCancelado ? 'Cancelado' : (req.etapa ? `Etapa 0${req.etapa}` : ''))
                        cloned.statusRequisicao = reqStatus
                        cloned.status_requisicao = reqStatus

                        if (isReqCancelado) {
                            cloned.cancelamento = req.cancelamento || { usuario: 'Sistema', justificativa: req.status || 'Ordem Negada' }
                            cloned.etapa = 'CANCELADO'
                            cloned.statusPedido = cloned.statusPedido || cloned.status_pedido || 'Cancelado'
                            cloned.status_pedido = cloned.statusPedido
                        } else {
                            cloned.cancelamento = null
                            if (req.etapa) {
                                cloned.etapa = `ETAPA 0${req.etapa}`
                            }
                            cloned.statusPedido = cloned.statusPedido || cloned.status_pedido || ''
                            cloned.status_pedido = cloned.statusPedido
                        }

                        // Enriquecer com dados de requisição
                        cloned.solicitante = req.solicitante || req.requisitante || cloned.requisitante
                        cloned.requisitante = cloned.requisitante || req.solicitante || req.requisitante
                        cloned.responsavelCotacao = req.responsavel_cotacao || req.responsavelCotacao || cloned.comprador
                        cloned.comprador = cloned.comprador || req.responsavel_cotacao || req.responsavelCotacao
                        cloned.aprovacoes = req.aprovacoes || []
                        cloned.aprovacoesCotacao = req.aprovacoes_cotacao || req.aprovacoesCotacao || []
                        cloned.subprojeto = cloned.subprojeto || req.subprojeto || req.centro_custo_projeto || req.centroCustoProjeto
                        cloned.tipoRequisicao = req.tipo_requisicao || req.tipoRequisicao || cloned.tipoPedido

                        // Se pedido não possui logs mas requisição possui, enriquecer
                        if ((!cloned.logs || cloned.logs.length === 0) && req.logs && req.logs.length > 0) {
                            cloned.logs = req.logs
                        }
                    } else {
                        // Sem correspondência na rota requisições
                        const statusUpper = String(cloned.statusPedido || cloned.status_pedido || '').toUpperCase()
                        const isCancelado = statusUpper.includes('CANCEL') || statusUpper.includes('NEGAD') || statusUpper.includes('REJEIT')
                        if (isCancelado) {
                            cloned.etapa = 'CANCELADO'
                        }
                    }

                    mergedList.push(cloned)
                })

                // 2. Incluir requisições sem pedido associado (completando Etapas 1 até 4 e requisições canceladas/órfãs)
                requisicoesRaw.forEach((req: any) => {
                    const rawReqId = req.id_requisicao ?? req.idRequisicao
                    const reqId = String(rawReqId || '')
                    if (matchedReqIds.has(reqId)) return

                    const hasCancelamento = req.cancelamento !== null && req.cancelamento !== undefined
                    const reqStatusUpper = String(req.status || '').toUpperCase()
                    const isStatusCancelado = reqStatusUpper.includes('CANCEL') || reqStatusUpper.includes('NEGAD') || reqStatusUpper.includes('REJEIT')
                    const isCancelado = hasCancelamento || isStatusCancelado || req.etapa === null

                    const etapaStr = isCancelado ? 'CANCELADO' : `ETAPA 0${req.etapa || 1}`
                    const statusStr = isCancelado ? (req.status || 'Cancelado') : (req.status || `Etapa 0${req.etapa || 1}`)

                    const rawItens = req.itens || req.itensPedido || req.itens_pedido || []
                    const valorTotal = typeof req.valor_global === 'number'
                        ? req.valor_global
                        : (typeof req.valorGlobal === 'number'
                            ? req.valorGlobal
                            : (parseFloat(req.valor_global || req.valorGlobal) || 0))

                    const syntheticOrder = {
                        id: `r_${reqId}`,
                        idRequisicao: reqId,
                        id_requisicao: reqId,
                        idPedido: '',
                        id_pedido: '',
                        titulo: req.titulo || '',
                        statusPedido: req.statusPedido || req.status_pedido || '',
                        status_pedido: req.statusPedido || req.status_pedido || '',
                        statusRequisicao: req.status || statusStr,
                        status_requisicao: req.status || statusStr,
                        etapa: etapaStr,
                        fornecedor: {
                            id: '',
                            nome: isCancelado ? 'Cancelado antes do pedido' : 'Em cotação / aprovação',
                            documento: ''
                        },
                        fornecedor_nome: isCancelado ? 'Cancelado antes do pedido' : 'Em cotação / aprovação',
                        fornecedor_documento: '',
                        requisitante: req.solicitante || req.requisitante || '',
                        solicitante: req.solicitante || req.requisitante || '',
                        comprador: req.responsavel_cotacao || req.responsavelCotacao || '',
                        responsavelCotacao: req.responsavel_cotacao || req.responsavelCotacao || '',
                        dataPedido: req.data_requisicao || req.dataRequisicao || '',
                        data_pedido: req.data_requisicao || req.dataRequisicao || '',
                        dataEntregaEstimada: req.data_prevista_entrega || req.dataPrevistaEntrega || '',
                        tipoPedido: req.tipo_requisicao || req.tipoRequisicao || 'produto',
                        tipo_pedido: req.tipo_requisicao || req.tipoRequisicao || 'produto',
                        tipoRequisicao: req.tipo_requisicao || req.tipoRequisicao || 'produto',
                        subprojeto: req.subprojeto || req.centro_custo_projeto || req.centroCustoProjeto || '',
                        valorTotal: valorTotal,
                        valor_total: valorTotal,
                        cancelamento: req.cancelamento || null,
                        aprovacoes: req.aprovacoes || [],
                        aprovacoesCotacao: req.aprovacoes_cotacao || req.aprovacoesCotacao || [],
                        itensPedido: rawItens.map((it: any) => ({
                            idProduto: it.id_produto ?? it.idProduto,
                            idServico: it.id_servico ?? it.idServico,
                            nomeProduto: it.nome_produto || it.nome || it.descricao || '',
                            nomeServico: it.nome_servico || it.nome || it.descricao || '',
                            quantidade: parseFloat(it.quantidade) || 0,
                            valorUnitario: it.valor_unitario !== null && it.valor_unitario !== undefined
                                ? parseFloat(it.valor_unitario)
                                : (it.valorUnitario !== null && it.valorUnitario !== undefined ? parseFloat(it.valorUnitario) : null),
                            valorTotal: it.valor_total !== null && it.valor_total !== undefined
                                ? parseFloat(it.valor_total)
                                : (it.valorTotal !== null && it.valorTotal !== undefined ? parseFloat(it.valorTotal) : null),
                            centroCusto: it.centro_custo || it.centroCusto || req.centro_custo_projeto || req.centroCustoProjeto || req.subprojeto || '',
                            grupo: it.grupo || 'Geral',
                            controleEntregas: []
                        })),
                        itens_pedido: rawItens.map((it: any) => ({
                            idProduto: it.id_produto ?? it.idProduto,
                            idServico: it.id_servico ?? it.idServico,
                            nomeProduto: it.nome_produto || it.nome || it.descricao || '',
                            nomeServico: it.nome_servico || it.nome || it.descricao || '',
                            quantidade: parseFloat(it.quantidade) || 0,
                            valorUnitario: it.valor_unitario !== null && it.valor_unitario !== undefined
                                ? parseFloat(it.valor_unitario)
                                : (it.valorUnitario !== null && it.valorUnitario !== undefined ? parseFloat(it.valorUnitario) : null),
                            valorTotal: it.valor_total !== null && it.valor_total !== undefined
                                ? parseFloat(it.valor_total)
                                : (it.valorTotal !== null && it.valorTotal !== undefined ? parseFloat(it.valorTotal) : null),
                            centroCusto: it.centro_custo || it.centroCusto || req.centro_custo_projeto || req.centroCustoProjeto || req.subprojeto || '',
                            grupo: it.grupo || 'Geral',
                            controleEntregas: []
                        })),
                        logs: req.logs || []
                    }

                    mergedList.push(syntheticOrder)
                })

                const duration = Date.now() - startTime
                console.log(`✅ Mesclagem finalizada: ${mergedList.length} registros totais em ${duration}ms (${pedidosRaw.length} pedidos + ${requisicoesRaw.length - matchedReqIds.size} requisições exclusivas)`)

                setCached(cacheKey, mergedList)
                return mergedList
            } catch (error) {
                console.error('❌ Erro na integração de pedidos e requisições:', error)
                const fallbackCache = getCached<any[]>(cacheKey)
                if (fallbackCache && fallbackCache.length > 0) {
                    console.log(`⚠️ Retornando cache anterior (${fallbackCache.length} itens)`)
                    return fallbackCache
                }
                return []
            } finally {
                pendingRequests.delete(cacheKey)
            }
        })()

        pendingRequests.set(cacheKey, promise)
        return promise
    }
}

export const contasPagarService = {
    async listar(filters: DateFilter = {}, page = 1) {
        const params: ApiParams = {
            pageNumber: page,
            filtro: 1
        }

        // SEMPRE adicionar datas (obrigatório pela API)
        let dataInicio = filters.startDate
        let dataFim = filters.endDate

        if (!dataInicio || !dataFim) {
            const datas = getDefaultDates()
            dataInicio = datas.data_inicio
            dataFim = datas.data_fim
        }

        params.data_inicio = dataInicio
        params.data_fim = dataFim

        return apiGet('contas-pagar', params)
    },

    async listarTodos(filters: DateFilter = {}) {
        const cacheKey = `contasPagar_${filters.startDate || ''}_${filters.endDate || ''}`
        const cached = getCached<any[]>(cacheKey)
        if (cached) return cached

        const data: any[] = []
        let page = 1
        let totalPages = 0

        console.log('🔄 Buscando contas a pagar...')
        const startTime = Date.now()

        try {
            const primeiraPagina = await this.listar(filters, page)
            data.push(...(primeiraPagina.data || []))

            totalPages = primeiraPagina.totalPages || Math.ceil((primeiraPagina.totalItems || 0) / 20)
            console.log(`📊 Total de páginas de contas a pagar: ${totalPages} (${primeiraPagina.totalItems} registros)`)

            for (let p = 2; p <= totalPages; p++) {
                try {
                    console.log(`📄 Buscando página ${p}/${totalPages} de contas a pagar...`)
                    const resultado = await this.listar(filters, p)
                    data.push(...(resultado.data || []))
                } catch (error) {
                    console.log(`⚠️ Erro na página ${p} de contas a pagar`)
                }
            }
        } catch (error) {
            console.error('❌ Erro ao buscar contas a pagar:', error)
            return []
        }

        const duration = Date.now() - startTime
        console.log(`✅ ${data.length} contas a pagar carregadas em ${duration}ms`)

        setCached(cacheKey, data)
        return data
    }
}

export const contasReceberService = {
    async listar(filters: DateFilter = {}, page = 1) {
        const params: ApiParams = {
            pageNumber: page,
            filtro: 1
        }

        // SEMPRE adicionar datas (obrigatório pela API)
        let dataInicio = filters.startDate
        let dataFim = filters.endDate

        if (!dataInicio || !dataFim) {
            const datas = getDefaultDates()
            dataInicio = datas.data_inicio
            dataFim = datas.data_fim
        }

        params.data_inicio = dataInicio
        params.data_fim = dataFim

        return apiGet('contas-receber', params)
    },

    async listarTodos(filters: DateFilter = {}) {
        const cacheKey = `contasReceber_${filters.startDate || ''}_${filters.endDate || ''}`
        const cached = getCached<any[]>(cacheKey)
        if (cached) return cached

        const data: any[] = []
        let page = 1
        let totalPages = 0

        console.log('🔄 Buscando contas a receber...')
        const startTime = Date.now()

        try {
            const primeiraPagina = await this.listar(filters, page)
            data.push(...(primeiraPagina.data || []))

            totalPages = primeiraPagina.totalPages || Math.ceil((primeiraPagina.totalItems || 0) / 20)
            console.log(`📊 Total de páginas de contas a receber: ${totalPages} (${primeiraPagina.totalItems} registros)`)

            for (let p = 2; p <= totalPages; p++) {
                try {
                    console.log(`📄 Buscando página ${p}/${totalPages} de contas a receber...`)
                    const resultado = await this.listar(filters, p)
                    data.push(...(resultado.data || []))
                } catch (error) {
                    console.log(`⚠️ Erro na página ${p} de contas a receber`)
                }
            }
        } catch (error) {
            console.error('❌ Erro ao buscar contas a receber:', error)
            return []
        }

        const duration = Date.now() - startTime
        console.log(`✅ ${data.length} contas a receber carregadas em ${duration}ms`)

        setCached(cacheKey, data)
        return data
    }
}

export const fornecedoresService = {
    async listar(page: number = 1, filtro?: string | number) {
        const params: ApiParams = { pageNumber: page }
        if (filtro !== undefined && filtro !== null && filtro !== '') {
            params.filtro = Number(filtro)
        }
        return apiGet('fornecedores', params)
    },

    async listarTodos(filtro?: string | number): Promise<any[]> {
        const cacheKey = `fornecedores_todos_${filtro || 'all'}`

        const cached = getCached<any[]>(cacheKey)
        if (cached) return cached

        if (pendingRequests.has(cacheKey)) {
            console.log('⏳ [Fornecedores] Aguardando requisição já em andamento...')
            return pendingRequests.get(cacheKey)!
        }

        const promise = (async () => {
            console.log('🔄 Buscando todos os fornecedores...')
            const startTime = Date.now()

            let data: any[] = []
            try {
                const primeiraPagina = await this.listar(1, filtro as any)
                const totalPages = primeiraPagina.totalPages
                const totalItems = primeiraPagina.totalItems
                console.log(`📊 Total de páginas de fornecedores: ${totalPages} (${totalItems} registros)`)

                data = [...(primeiraPagina.data || [])]

                if (totalPages > 1) {
                    const BATCH_SIZE = 3

                    for (let batchStart = 2; batchStart <= totalPages; batchStart += BATCH_SIZE) {
                        const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, totalPages)
                        console.log(`📄 Buscando páginas ${batchStart}-${batchEnd} de fornecedores...`)

                        const promises = Array.from(
                            { length: batchEnd - batchStart + 1 },
                            (_, i) => this.listar(batchStart + i, filtro as any)
                        )

                        const resultados = await Promise.allSettled(promises)
                        resultados.forEach((resultado, i) => {
                            if (resultado.status === 'fulfilled') {
                                data.push(...(resultado.value.data || []))
                            } else {
                                console.warn(`⚠️ Página ${batchStart + i} de fornecedores falhou definitivamente`)
                            }
                        })

                        if (batchEnd < totalPages) {
                            await new Promise(r => setTimeout(r, 250))
                        }
                    }
                }

                // Deduplicar fornecedores por ID / id_ongsys / código / documento
                const seen = new Set<string>()
                const deduplicatedData: any[] = []
                data.forEach((f: any) => {
                    const key = f.id ? `id_${f.id}` : (f.id_ongsys ? `id_${f.id_ongsys}` : (f.codigo ? `cod_${f.codigo}` : (f.documento ? `doc_${f.documento}` : null)))
                    if (key) {
                        if (!seen.has(key)) {
                            seen.add(key)
                            deduplicatedData.push(f)
                        }
                    } else {
                        deduplicatedData.push(f)
                    }
                })

                const duration = Date.now() - startTime
                console.log(`✅ ${deduplicatedData.length} fornecedores únicos carregados em ${duration}ms (total original: ${data.length})`)

                setCached(cacheKey, deduplicatedData)
                return deduplicatedData
            } catch (error) {
                console.error('❌ Erro ao buscar fornecedores:', error)
                const fallbackCache = getCached<any[]>(cacheKey)
                if (fallbackCache && fallbackCache.length > 0) {
                    console.log(`⚠️ Retornando cache anterior (${fallbackCache.length} fornecedores) após erro`)
                    return fallbackCache
                }
                return data || []
            } finally {
                pendingRequests.delete(cacheKey)
            }
        })()

        pendingRequests.set(cacheKey, promise)
        return promise
    }
}

export const produtosService = {
    async listar(page: number = 1) {
        const params: ApiParams = { pageNumber: page }
        return apiGet('produtos', params)
    },

    async listarTodos(_options?: any): Promise<any[]> {
        const cacheKey = 'produtos_todos'

        const cached = getCached<any[]>(cacheKey)
        if (cached) return cached

        if (pendingRequests.has(cacheKey)) {
            console.log('⏳ [Produtos] Aguardando requisição já em andamento...')
            return pendingRequests.get(cacheKey)!
        }

        const promise = (async () => {
            console.log('🔄 Buscando todos os produtos...')
            const startTime = Date.now()

            let data: any[] = []
            try {
                const primeiraPagina = await this.listar(1)
                const totalPages = primeiraPagina.totalPages
                const totalItems = primeiraPagina.totalItems
                console.log(`📊 Total de páginas de produtos: ${totalPages} (${totalItems} produtos)`)

                data = [...(primeiraPagina.data || [])]

                if (totalPages > 1) {
                    const BATCH_SIZE = 3

                    for (let batchStart = 2; batchStart <= totalPages; batchStart += BATCH_SIZE) {
                        const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, totalPages)
                        console.log(`📄 Buscando páginas ${batchStart}-${batchEnd} de produtos em paralelo...`)

                        const promises = Array.from(
                            { length: batchEnd - batchStart + 1 },
                            (_, i) => this.listar(batchStart + i)
                        )

                        const resultados = await Promise.allSettled(promises)
                        resultados.forEach((resultado, i) => {
                            if (resultado.status === 'fulfilled') {
                                data.push(...(resultado.value.data || []))
                            } else {
                                console.warn(`⚠️ Página ${batchStart + i} de produtos falhou definitivamente`)
                            }
                        })

                        if (batchEnd < totalPages) {
                            await new Promise(r => setTimeout(r, 250))
                        }
                    }
                }

                // Deduplicar produtos por ID ou id_ongsys
                const seen = new Set<string>()
                const deduplicatedData: any[] = []
                data.forEach((p: any) => {
                    const key = p.id ? `id_${p.id}` : (p.id_ongsys ? `id_${p.id_ongsys}` : (p.codigo ? `cod_${p.codigo}` : null))
                    if (key) {
                        if (!seen.has(key)) {
                            seen.add(key)
                            deduplicatedData.push(p)
                        }
                    } else {
                        deduplicatedData.push(p)
                    }
                })

                const duration = Date.now() - startTime
                console.log(`✅ ${deduplicatedData.length} produtos únicos carregados em ${duration}ms (total original: ${data.length})`)

                setCached(cacheKey, deduplicatedData)
                return deduplicatedData
            } catch (error) {
                console.error('❌ Erro ao buscar produtos:', error)
                const fallbackCache = getCached<any[]>(cacheKey)
                if (fallbackCache && fallbackCache.length > 0) {
                    console.log(`⚠️ Retornando cache anterior (${fallbackCache.length} produtos) após erro`)
                    return fallbackCache
                }
                return data || []
            } finally {
                pendingRequests.delete(cacheKey)
            }
        })()

        pendingRequests.set(cacheKey, promise)
        return promise
    }
}