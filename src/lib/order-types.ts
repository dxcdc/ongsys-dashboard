export interface Fornecedor {
    id: number | string
    nome: string
    documento: string
}

export interface ItemPedido {
    grupo: string
    idServico?: number | string
    idProduto?: number | string
    nomeServico?: string
    nomeProduto?: string
    quantidade: number | string
    valorUnitario?: number | null
    valorTotal?: number | null
    centroCusto: string
    linkReferencia?: string
    descricao?: string
    controleEntregas: any[]
}

export interface LocalEntrega {
    responsavel: string
    cep: string
    endereco: string
    numero: string
    complemento?: string
    bairro: string
    cidade: string
    estado: string
}

export interface LogPedido {
    acao: string
    data: string
    autor: string
    comentarios?: string
    etapa?: number | string
}

export interface Order {
    id?: number | string
    id_Requisicao?: string | number
    id_requisicao?: string | number
    titulo?: string
    status_pedido?: string
    fornecedor_id?: string
    fornecedor_nome?: string
    fornecedor_documento?: string
    requisitante?: string
    comprador?: string
    demandante?: string
    data_pedido?: string
    dataEntregaEstimada?: string
    numero_referencia?: string
    tipo_pedido?: string
    fonte_pagadora?: string
    conta_plano_financeiro?: string
    subprojeto?: string
    portal_transparencia?: string
    ttd?: string
    descricao_pedido?: string
    justificativa_compra?: string
    valor_total?: number
    local_entrega?: LocalEntrega
    itens_pedido?: ItemPedido[]
    logs?: LogPedido[]
}

export interface OrdersResponse {
    data: Order[]
    total: number
    page: number
    totalPages: number
}

export interface EtapaInfo {
    nome: string
    descricao: string
    ordem: number  // Para ordenar as etapas
}

export const ETAPAS: EtapaInfo[] = [
    {
        nome: 'ETAPA 01',
        descricao: 'Criação da Requisição',
        ordem: 1
    },
    {
        nome: 'ETAPA 02',
        descricao: 'Aprovação da Requisição',
        ordem: 2
    },
    {
        nome: 'ETAPA 03',
        descricao: 'Cotação',
        ordem: 3
    },
    {
        nome: 'ETAPA 04',
        descricao: 'Aprovação da Cotação',
        ordem: 4
    },
    {
        nome: 'ETAPA 05',
        descricao: 'Lançamento / Processamento',
        ordem: 5
    },
    {
        nome: 'ETAPA 06',
        descricao: 'Finalização',
        ordem: 6
    },
    {
        nome: 'CANCELADO',
        descricao: 'Pedidos Cancelados',
        ordem: 7
    }
]

// Função para normalizar o nome da ETAPA vinda da API (aceita números como 1, 2, 3, 4, 5, 6 ou strings como "Etapa 1", "ETAPA 01", etc.)
export function normalizarNomeEtapa(etapaRaw?: number | string, acaoText?: string): string | null {
    if (etapaRaw === undefined || etapaRaw === null) return null
    const raw = String(etapaRaw).trim().toUpperCase()
    const acaoLower = acaoText ? String(acaoText).toLowerCase() : ''

    if (acaoLower.includes('cancel') || acaoLower.includes('negado') || acaoLower.includes('recusado') || raw.includes('CANCEL')) {
        return 'CANCELADO'
    }

    if (raw === '1' || raw === 'ETAPA 01' || raw === 'ETAPA 1') return 'ETAPA 01'
    if (raw === '2' || raw === 'ETAPA 02' || raw === 'ETAPA 2') return 'ETAPA 02'
    if (raw === '3' || raw === 'ETAPA 03' || raw === 'ETAPA 3') return 'ETAPA 03'
    if (raw === '4' || raw === 'ETAPA 04' || raw === 'ETAPA 4') return 'ETAPA 04'
    if (raw === '5' || raw === 'ETAPA 05' || raw === 'ETAPA 5') return 'ETAPA 05'
    if (raw === '6' || raw === 'ETAPA 06' || raw === 'ETAPA 6') return 'ETAPA 06'

    const etapaEncontrada = ETAPAS.find(e => e.nome.toUpperCase() === raw)
    if (etapaEncontrada) return etapaEncontrada.nome

    return null
}

// Função auxiliar para converter string de data de log ("YYYY-MM-DD HH:mm:ss") em timestamp numérico seguro
export function parseLogDate(dateStr?: string): number {
    if (!dateStr) return 0
    const formattedStr = dateStr.includes(' ') && !dateStr.includes('T')
        ? dateStr.replace(' ', 'T')
        : dateStr
    const timestamp = new Date(formattedStr).getTime()
    return isNaN(timestamp) ? 0 : timestamp
}

// Função para identificar qual ETAPA um log pertence a partir de log.etapa
export function identificarEtapa(log: LogPedido): string | null {
    if (log.etapa !== undefined && log.etapa !== null) {
        return normalizarNomeEtapa(log.etapa, log.acao)
    }
    return null
}

// Função para identificar a ETAPA ATUAL de um pedido comparando logs cronologicamente até a data/hora atual
export function identificarEtapaAtual(logs: LogPedido[]): string | null {
    if (!logs || logs.length === 0) return null

    const agora = Date.now()

    // 1. Mapear logs com timestamp e etapa validada
    const logsValidos = logs
        .map(log => ({
            log,
            timestamp: parseLogDate(log.data),
            etapa: identificarEtapa(log)
        }))
        .filter(item => item.timestamp > 0 && item.timestamp <= agora && item.etapa !== null)
        .sort((a, b) => a.timestamp - b.timestamp) // Ordem cronológica: antigo -> recente

    if (logsValidos.length === 0) {
        // Fallback caso as datas venham sem formato padrão
        for (const log of logs) {
            const etapa = identificarEtapa(log)
            if (etapa) return etapa
        }
        return null
    }

    // 2. Se houver qualquer registro de cancelamento no histórico, o status é CANCELADO
    const cancelado = logsValidos.find(item => item.etapa === 'CANCELADO')
    if (cancelado) return 'CANCELADO'

    // 3. Se o pedido já atingiu a ETAPA 06 (Finalização/Encerramento), permanece na ETAPA 06
    // (impede que ações administrativas secundárias após o encerramento regridam a etapa)
    const finalizado = logsValidos.find(item => item.etapa === 'ETAPA 06')
    if (finalizado) return 'ETAPA 06'

    // 4. Caso contrário, retorna a última etapa concluída na ordem cronológica até o momento atual
    const ultimoLog = logsValidos[logsValidos.length - 1]
    return ultimoLog.etapa
}

// Função para agrupar logs por ETAPA
export function agruparLogsPorEtapa(logs: LogPedido[]): Record<string, LogPedido[]> {
    const grupos: Record<string, LogPedido[]> = {}

    logs.forEach(log => {
        const etapa = identificarEtapa(log)
        if (etapa) {
            if (!grupos[etapa]) {
                grupos[etapa] = []
            }
            grupos[etapa].push(log)
        }
    })

    return grupos
}

// Interface para estatísticas de etapas
export interface EtapaEstatistica {
    nome: string
    descricao: string
    quantidade: number
    ordem: number
}

// Interface para alerta de atraso de cotação
export interface CotacaoAlertInfo {
    dias: number
    nivel: 'atencao' | 'alerta' | 'critico'
    cor: string
    badgeBg: string
    label: string
}

// Função para calcular atraso em dias sem cotação (3, 7 e 10+ dias)
export function calcularAtrasoCotacao(order?: { logs?: LogPedido[]; data_pedido?: string } | null): CotacaoAlertInfo | null {
    if (!order) return null

    const etapaAtual = identificarEtapaAtual(order.logs || [])

    // Se o pedido já avançou além da cotação ou foi finalizado/cancelado, não aplica alerta
    if (etapaAtual === 'ETAPA 04' || etapaAtual === 'ETAPA 05' || etapaAtual === 'ETAPA 06' || etapaAtual === 'CANCELADO') {
        return null
    }

    let timestampInicio = 0

    if (order.logs && order.logs.length > 0) {
        const logEtapa3 = order.logs.find(log => identificarEtapa(log) === 'ETAPA 03')
        if (logEtapa3) {
            timestampInicio = parseLogDate(logEtapa3.data)
        } else {
            const firstLog = order.logs[0]
            if (firstLog) {
                timestampInicio = parseLogDate(firstLog.data)
            }
        }
    }

    if (!timestampInicio && order.data_pedido) {
        timestampInicio = parseLogDate(order.data_pedido)
    }

    if (!timestampInicio) return null

    const agora = Date.now()
    const diffMs = agora - timestampInicio
    if (diffMs < 0) return null

    const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (dias >= 10) {
        return {
            dias,
            nivel: 'critico',
            cor: 'text-red-600 border-red-500 bg-red-50 dark:bg-red-950/40',
            badgeBg: 'bg-red-500 text-white',
            label: `${dias}d sem cotação (Crítico)`
        }
    }

    if (dias >= 7) {
        return {
            dias,
            nivel: 'alerta',
            cor: 'text-orange-600 border-orange-500 bg-orange-50 dark:bg-orange-950/40',
            badgeBg: 'bg-orange-500 text-white',
            label: `${dias}d sem cotação (Alerta)`
        }
    }

    if (dias >= 3) {
        return {
            dias,
            nivel: 'atencao',
            cor: 'text-amber-600 border-amber-500 bg-amber-50 dark:bg-amber-950/40',
            badgeBg: 'bg-amber-500 text-white',
            label: `${dias}d sem cotação (Atenção)`
        }
    }

    return null
}

// Função para calcular a diferença entre duas datas em horas/dias
export function formatarTempo(ms: number): string {
    const horas = ms / (1000 * 60 * 60)

    if (horas < 1) {
        const minutos = Math.round(horas * 60)
        return `${minutos}m`
    }

    if (horas < 24) {
        return `${Math.round(horas)}h`
    } else {
        const dias = horas / 24
        return `${dias.toFixed(1)}d`
    }
}

// Função para calcular o tempo gasto em uma etapa para um pedido
export function calcularTempoEtapa(logs: LogPedido[], etapaNome: string, pedidoId?: string): number | null {
    // ETAPAS 06 e CANCELADO não têm tempo médio (são etapas finais)
    if (etapaNome === 'ETAPA 06' || etapaNome === 'CANCELADO') {
        return null
    }

    // Encontrar a etapa correspondente
    const etapa = ETAPAS.find(e => e.nome === etapaNome)
    if (!etapa) return null

    // Filtrar logs que pertencem a esta etapa usando a identificação por log.etapa
    const logsEtapa = logs
        .filter(log => identificarEtapa(log) === etapaNome)
        .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())

    // Se não tem logs na etapa, não entrou nela ainda
    if (logsEtapa.length === 0) {
        if (pedidoId) {
            console.log(`❌ Pedido ${pedidoId} - Sem logs para ETAPA ${etapaNome}`)
        }
        return null
    }

    // Pega o primeiro log da etapa (início)
    const dataInicio = new Date(logsEtapa[0].data).getTime()
    const dataInicioStr = new Date(dataInicio).toLocaleString('pt-BR')

    // Encontrar o índice do ÚLTIMO log desta etapa no array completo de logs
    const ultimoLogDaEtapa = logsEtapa[logsEtapa.length - 1]
    const indexUltimoLog = logs.findIndex(log => log === ultimoLogDaEtapa)

    // Verificar se existe um próximo log (qualquer etapa) após o último log desta etapa
    const existeProximoLog = indexUltimoLog !== -1 && indexUltimoLog < logs.length - 1

    // Calcular a data de fim
    let dataFim: number
    let tipo: string

    if (existeProximoLog) {
        // Já passou para outra etapa - usa o próximo log como fim
        const proximoLog = logs[indexUltimoLog + 1]
        dataFim = new Date(proximoLog.data).getTime()
        tipo = 'CONCLUÍDO'
    } else {
        // Ainda está nesta etapa - usa a data atual
        dataFim = Date.now()
        tipo = 'EM ANDAMENTO'
    }

    const dataFimStr = new Date(dataFim).toLocaleString('pt-BR')
    const diferenca = dataFim - dataInicio

    // Log para debug
    if (pedidoId) {
        console.log(`📊 Pedido ${pedidoId} - ${etapaNome}:`, {
            tipo,
            logsNaEtapa: logsEtapa.length,
            inicio: dataInicioStr,
            fim: dataFimStr,
            diferenca: formatarTempo(diferenca),
            ms: diferenca
        })
    }

    return diferenca
}

// Função para calcular a média de tempo de uma etapa considerando todos os pedidos
export function calcularMediaTempoEtapa(requisicao: Order[], etapaNome: string): string {
    // ETAPAS 06 e CANCELADO não têm média
    if (etapaNome === 'ETAPA 06' || etapaNome === 'CANCELADO') {
        return '-'
    }

    const tempos: number[] = []
    console.log(`\n🔍 Calculando média para ${etapaNome} com ${requisicao.length} requisição`)

    requisicao.forEach((requisicao, index) => {
        if (!requisicao.logs) return

        const logsArray = Array.isArray(requisicao.logs) ? requisicao.logs : [requisicao.logs]

        // Mostrar logs para os primeiros 5 requisições para debug
        const mostrarLog = index < 5
        const tempo = calcularTempoEtapa(logsArray, etapaNome, mostrarLog && requisicao.id_Requisicao ? String(requisicao.id_Requisicao) : undefined)

        if (tempo !== null) {
            tempos.push(tempo)
        }
    })

    if (tempos.length === 0) {
        console.log(`❌ ${etapaNome}: nenhum tempo válido encontrado`)
        return '-'
    }

    const soma = tempos.reduce((a, b) => a + b, 0)
    const media = soma / tempos.length
    const resultado = formatarTempo(media)

    console.log(`✅ ${etapaNome}:`, {
        totalTempos: tempos.length,
        soma: formatarTempo(soma),
        media: resultado,
        mediaMs: media
    })

    return resultado
}