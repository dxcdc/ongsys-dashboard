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

                // Deduplicar requisições por idRequisicao
                const seen = new Set<string>()
                const deduplicatedData: any[] = []
                data.forEach((r: any) => {
                    const key = r.idRequisicao ? String(r.idRequisicao) : null
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
                const key = p.idPedido ? `p_${p.idPedido}` : (p.idRequisicao ? `r_${p.idRequisicao}` : null)
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

                // Mapear requisições por idRequisicao
                const reqMap = new Map<string, any>()
                requisicoesRaw.forEach((req: any) => {
                    if (req.idRequisicao !== undefined && req.idRequisicao !== null) {
                        reqMap.set(String(req.idRequisicao), req)
                    }
                })

                const matchedReqIds = new Set<string>()
                const mergedList: any[] = []

                // 1. Processar pedidos existentes (Etapas 5 e 6, ou pedidos vinculados)
                pedidosRaw.forEach((p: any) => {
                    const cloned = { ...p }
                    const reqId = cloned.idRequisicao ? String(cloned.idRequisicao) : null

                    if (reqId && reqMap.has(reqId)) {
                        matchedReqIds.add(reqId)
                        const req = reqMap.get(reqId)!

                        // Regra de cancelamento
                        const hasCancelamento = req.cancelamento !== null && req.cancelamento !== undefined
                        if (hasCancelamento) {
                            cloned.cancelamento = req.cancelamento
                            cloned.etapa = 'CANCELADO'
                            cloned.statusPedido = 'Cancelado'
                            cloned.status_pedido = 'Cancelado'
                        } else {
                            cloned.cancelamento = null
                            if (req.etapa && !cloned.etapa) {
                                cloned.etapa = `ETAPA 0${req.etapa}`
                            }
                        }

                        // Enriquecer com dados de requisição
                        cloned.solicitante = req.solicitante || cloned.requisitante
                        cloned.requisitante = cloned.requisitante || req.solicitante
                        cloned.responsavelCotacao = req.responsavelCotacao || cloned.comprador
                        cloned.comprador = cloned.comprador || req.responsavelCotacao
                        cloned.aprovacoes = req.aprovacoes || []
                        cloned.aprovacoesCotacao = req.aprovacoesCotacao || []
                        cloned.subprojeto = cloned.subprojeto || req.subprojeto || req.centroCustoProjeto
                        cloned.tipoRequisicao = req.tipoRequisicao || cloned.tipoPedido

                        // Se pedido não possui logs mas requisição possui, enriquecer
                        if ((!cloned.logs || cloned.logs.length === 0) && req.logs && req.logs.length > 0) {
                            cloned.logs = req.logs
                        }
                    } else {
                        // Sem correspondência na rota requisições
                        const isCancelado = String(cloned.statusPedido || cloned.status_pedido || '').toUpperCase().includes('CANCEL')
                        if (isCancelado) {
                            cloned.etapa = 'CANCELADO'
                        }
                    }

                    mergedList.push(cloned)
                })

                // 2. Incluir requisições sem pedido associado (completando Etapas 1 até 4 e requisições canceladas/órfãs)
                requisicoesRaw.forEach((req: any) => {
                    const reqId = String(req.idRequisicao)
                    if (matchedReqIds.has(reqId)) return

                    const hasCancelamento = req.cancelamento !== null && req.cancelamento !== undefined
                    const isStatusCancelado = String(req.status || '').toUpperCase().includes('CANCEL')
                    const isCancelado = hasCancelamento || isStatusCancelado

                    const etapaStr = isCancelado ? 'CANCELADO' : `ETAPA 0${req.etapa || 1}`
                    const statusStr = isCancelado ? 'Cancelado' : (req.status || `Etapa 0${req.etapa || 1}`)

                    const syntheticOrder = {
                        id: `r_${req.idRequisicao}`,
                        idRequisicao: String(req.idRequisicao),
                        id_requisicao: String(req.idRequisicao),
                        idPedido: '',
                        id_pedido: '',
                        titulo: req.titulo || '',
                        statusPedido: statusStr,
                        status_pedido: statusStr,
                        etapa: etapaStr,
                        fornecedor: {
                            id: '',
                            nome: isCancelado ? 'Cancelado antes do pedido' : 'Em cotação / aprovação',
                            documento: ''
                        },
                        fornecedor_nome: isCancelado ? 'Cancelado antes do pedido' : 'Em cotação / aprovação',
                        fornecedor_documento: '',
                        requisitante: req.solicitante || '',
                        solicitante: req.solicitante || '',
                        comprador: req.responsavelCotacao || '',
                        responsavelCotacao: req.responsavelCotacao || '',
                        dataPedido: req.dataRequisicao || '',
                        data_pedido: req.dataRequisicao || '',
                        dataEntregaEstimada: req.dataPrevistaEntrega || '',
                        tipoPedido: req.tipoRequisicao || 'produto',
                        tipo_pedido: req.tipoRequisicao || 'produto',
                        tipoRequisicao: req.tipoRequisicao || 'produto',
                        subprojeto: req.subprojeto || req.centroCustoProjeto || '',
                        valorTotal: req.valorGlobal || 0,
                        valor_total: req.valorGlobal || 0,
                        cancelamento: req.cancelamento || null,
                        aprovacoes: req.aprovacoes || [],
                        aprovacoesCotacao: req.aprovacoesCotacao || [],
                        itensPedido: (req.itens || []).map((it: any) => ({
                            idProduto: it.idProduto,
                            idServico: it.idServico,
                            nomeProduto: it.nome,
                            nomeServico: it.nome,
                            quantidade: it.quantidade,
                            valorUnitario: it.valorUnitario,
                            valorTotal: it.valorTotal,
                            centroCusto: req.centroCustoProjeto || req.subprojeto || '',
                            grupo: it.grupo || 'Geral',
                            controleEntregas: []
                        })),
                        itens_pedido: (req.itens || []).map((it: any) => ({
                            idProduto: it.idProduto,
                            idServico: it.idServico,
                            nomeProduto: it.nome,
                            nomeServico: it.nome,
                            quantidade: it.quantidade,
                            valorUnitario: it.valorUnitario,
                            valorTotal: it.valorTotal,
                            centroCusto: req.centroCustoProjeto || req.subprojeto || '',
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

            totalPages = Math.ceil((primeiraPagina.totalItems || 0) / 100)
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

            totalPages = Math.ceil((primeiraPagina.totalItems || 0) / 100)
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

                // Deduplicar fornecedores por ID / código / documento
                const seen = new Set<string>()
                const deduplicatedData: any[] = []
                data.forEach((f: any) => {
                    const key = f.id ? `id_${f.id}` : (f.codigo ? `cod_${f.codigo}` : (f.documento ? `doc_${f.documento}` : null))
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

                // Deduplicar produtos por ID
                const seen = new Set<string>()
                const deduplicatedData: any[] = []
                data.forEach((p: any) => {
                    const key = p.id ? `id_${p.id}` : (p.codigo ? `cod_${p.codigo}` : null)
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