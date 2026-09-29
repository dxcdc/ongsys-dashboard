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

export const pedidosService = {
    async listar(filters: DateFilter = {}, page = 1) {
        const params: ApiParams = { pageNumber: page }
        if (filters.startDate) params.data_inicio = filters.startDate
        if (filters.endDate) params.data_fim = filters.endDate
        return apiGet('pedidos', params)
    },

    async listarTodos(filters: DateFilter = {}): Promise<any[]> {
        const cacheKey = `pedidos_${filters.startDate || ''}_${filters.endDate || ''}`

        const cached = getCached<any[]>(cacheKey)
        if (cached) return cached

        // Evitar requisições duplicadas simultâneas (race condition)
        if (pendingRequests.has(cacheKey)) {
            console.log('⏳ Aguardando requisição já em andamento...')
            return pendingRequests.get(cacheKey)!
        }

        const promise = (async () => {
            console.log('🔄 Buscando todos os pedidos...')
            const startTime = Date.now()

            try {
                const primeiraPagina = await this.listar(filters, 1)
                const totalPages = primeiraPagina.totalPages
                const totalItems = primeiraPagina.totalItems
                console.log(`📊 Total de páginas: ${totalPages} (${totalItems} pedidos)`)

                const data: any[] = [...(primeiraPagina.data || [])]

                if (totalPages > 1) {
                    const BATCH_SIZE = 6

                    for (let batchStart = 2; batchStart <= totalPages; batchStart += BATCH_SIZE) {
                        const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, totalPages)
                        console.log(`📄 Buscando páginas ${batchStart}-${batchEnd}...`)

                        const promises = Array.from(
                            { length: batchEnd - batchStart + 1 },
                            (_, i) => this.listar(filters, batchStart + i)
                        )

                        // allSettled: não descarta o lote inteiro se uma página falhar
                        const resultados = await Promise.allSettled(promises)
                        resultados.forEach((resultado, i) => {
                            if (resultado.status === 'fulfilled') {
                                data.push(...(resultado.value.data || []))
                            } else {
                                console.warn(`⚠️ Página ${batchStart + i} falhou definitivamente`)
                            }
                        })
                    }
                }

                const duration = Date.now() - startTime
                console.log(`✅ ${data.length} pedidos carregados em ${duration}ms`)

                setCached(cacheKey, data)
                return data
            } catch (error) {
                console.error('❌ Erro ao buscar pedidos:', error)
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
    async listar(filters: DateFilter = {}, page = 1) {
        const params: ApiParams = { pageNumber: page }

        // Fornecedores também precisa de datas!
        let dataInicio = filters.startDate
        let dataFim = filters.endDate

        if (!dataInicio || !dataFim) {
            const datas = getDefaultDates()
            dataInicio = datas.data_inicio
            dataFim = datas.data_fim
        }

        params.data_inicio = dataInicio
        params.data_fim = dataFim

        return apiGet('fornecedores', params)
    },

    async listarTodos(filters: DateFilter = {}) {
        const cacheKey = `fornecedores_${filters.startDate || ''}_${filters.endDate || ''}`
        const cached = getCached<any[]>(cacheKey)
        if (cached) return cached

        const data: any[] = []
        let page = 1
        let totalPages = 0

        console.log('🔄 Buscando fornecedores...')
        const startTime = Date.now()

        try {
            const primeiraPagina = await this.listar(filters, page)
            data.push(...(primeiraPagina.data || []))

            totalPages = Math.ceil((primeiraPagina.totalItems || 0) / 100)
            console.log(`📊 Total de páginas de fornecedores: ${totalPages} (${primeiraPagina.totalItems} registros)`)

            for (let p = 2; p <= totalPages; p++) {
                try {
                    console.log(`📄 Buscando página ${p}/${totalPages} de fornecedores...`)
                    const resultado = await this.listar(filters, p)
                    data.push(...(resultado.data || []))
                } catch (error) {
                    console.log(`⚠️ Erro na página ${p} de fornecedores`)
                }
            }
        } catch (error) {
            console.error('❌ Erro ao buscar fornecedores:', error)
            return []
        }

        const duration = Date.now() - startTime
        console.log(`✅ ${data.length} fornecedores carregados em ${duration}ms`)

        setCached(cacheKey, data)
        return data
    }
}

export const produtosService = {
    async listar(filters: DateFilter = {}, page = 1) {
        const params: ApiParams = { pageNumber: page }
        if (filters.startDate) params.data_inicio = filters.startDate
        if (filters.endDate) params.data_fim = filters.endDate
        return apiGet('produtos', params)
    },

    async listarTodos(filters: DateFilter = {}) {
        const cacheKey = `produtos_${filters.startDate || ''}_${filters.endDate || ''}`
        const cached = getCached<any[]>(cacheKey)
        if (cached) return cached

        console.log('🔄 Buscando todos os produtos...')
        const startTime = Date.now()

        try {
            const primeiraPagina = await this.listar(filters, 1)
            const totalPages = Math.ceil((primeiraPagina.totalItems || 0) / 100)
            console.log(`📊 Total de páginas de produtos: ${totalPages} (${primeiraPagina.totalItems} produtos)`)

            if (totalPages <= 1) {
                const data = primeiraPagina.data || []
                setCached(cacheKey, data)
                return data
            }

            const BATCH_SIZE = 3
            const data = [...(primeiraPagina.data || [])]

            for (let batchStart = 2; batchStart <= totalPages; batchStart += BATCH_SIZE) {
                const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, totalPages)
                console.log(`📄 Buscando páginas ${batchStart}-${batchEnd} de produtos em paralelo...`)

                const promises = []
                for (let p = batchStart; p <= batchEnd; p++) {
                    promises.push(this.listar(filters, p))
                }

                const resultados = await Promise.all(promises)
                resultados.forEach(resultado => {
                    data.push(...(resultado.data || []))
                })
            }

            const duration = Date.now() - startTime
            console.log(`✅ ${data.length} produtos carregados em ${duration}ms`)

            setCached(cacheKey, data)
            return data
        } catch (error) {
            console.error('❌ Erro ao buscar produtos:', error)
            return []
        }
    }
}