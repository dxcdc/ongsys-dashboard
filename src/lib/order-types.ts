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
    id_pedido?: string | number
    titulo?: string
    status_pedido?: string
    statusPedido?: string
    etapa?: string
    fornecedor_id?: string
    fornecedor_nome?: string
    fornecedor_documento?: string
    requisitante?: string
    solicitante?: string
    comprador?: string
    responsavel_cotacao?: string
    demandante?: string
    data_pedido?: string
    dataEntregaEstimada?: string
    numero_referencia?: string
    tipo_pedido?: string
    tipo_requisicao?: string
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
    cancelamento?: {
        data?: string
        usuario?: string
        justificativa?: string
    } | null
    aprovacoes?: any[]
    aprovacoesCotacao?: any[]
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
    oculta?: boolean
}

export const ETAPAS: EtapaInfo[] = [
    {
        nome: 'ETAPA 01',
        descricao: 'Criação da Requisição',
        ordem: 1,
        oculta: false
    },
    {
        nome: 'ETAPA 02',
        descricao: 'Aprovação da Requisição',
        ordem: 2,
        oculta: false
    },
    {
        nome: 'ETAPA 03',
        descricao: 'Cotação',
        ordem: 3,
        oculta: false
    },
    {
        nome: 'ETAPA 04',
        descricao: 'Aprovação da Cotação',
        ordem: 4,
        oculta: false
    },
    {
        nome: 'ETAPA 05',
        descricao: 'Lançamento / Processamento',
        ordem: 5,
        oculta: false
    },
    {
        nome: 'ETAPA 06',
        descricao: 'Finalização',
        ordem: 6,
        oculta: false
    },
    {
        nome: 'CANCELADO',
        descricao: 'Cancelados',
        ordem: 7,
        oculta: false
    }
]

// Função para normalizar o nome da ETAPA vinda da API (aceita números como 1, 2, 3, 4, 5, 6 ou strings como "Etapa 1", "ETAPA 01", etc.)
export function normalizarNomeEtapa(etapaRaw?: number | string, acaoText?: string): string | null {
    if (etapaRaw === undefined || etapaRaw === null) return null
    const raw = String(etapaRaw).trim().toUpperCase()
    if (raw === 'CANCELADO' || raw.includes('CANCEL')) {
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

// Função para identificar a ETAPA ATUAL de um pedido comparando cancelamento, etapa pré-definida, logs cronologicamente e status
export function identificarEtapaAtual(
    logsOrOrder: LogPedido[] | Order | any = [],
    statusPedido?: string,
    cancelamento?: any,
    etapaPredefinida?: string
): string | null {
    let logs: LogPedido[] = []
    let status = statusPedido
    let cancel = cancelamento
    let etapaFixa = etapaPredefinida

    if (logsOrOrder && !Array.isArray(logsOrOrder)) {
        const o = logsOrOrder as any
        logs = o.logs || []
        status = status || o.status_pedido || o.statusPedido || o.status
        cancel = cancel ?? o.cancelamento
        etapaFixa = etapaFixa || o.etapa
    } else {
        logs = logsOrOrder || []
    }

    // 1. Verificação de CANCELADO por objeto de cancelamento
    if (cancel !== null && cancel !== undefined) {
        return 'CANCELADO'
    }

    const statusNormalized = status ? String(status).trim() : ''
    const statusUpper = statusNormalized.toUpperCase()

    // 2. Verificação direta de CANCELADO pelo status do pedido (Cancelado, Ordem Negada, Rejeitado, etc.)
    if (
        statusUpper.includes('CANCEL') ||
        statusUpper.includes('NEGAD') ||
        statusUpper.includes('REJEIT')
    ) {
        return 'CANCELADO'
    }

    // 3. Se tiver etapa fixa pré-definida de requisição
    if (etapaFixa) {
        const norm = normalizarNomeEtapa(etapaFixa)
        if (norm === 'CANCELADO') return 'CANCELADO'
        if (norm === 'ETAPA 01' || norm === 'ETAPA 02' || norm === 'ETAPA 03' || norm === 'ETAPA 04' || norm === 'ETAPA 05' || norm === 'ETAPA 06') {
            return norm
        }
    }

    const agora = Date.now()

    // 4. Mapear logs com timestamp e etapa validada
    const logsValidos = (logs || [])
        .map(log => ({
            log,
            timestamp: parseLogDate(log.data),
            etapa: identificarEtapa(log)
        }))
        .filter(item => item.timestamp > 0 && item.timestamp <= agora && item.etapa !== null)
        .sort((a, b) => a.timestamp - b.timestamp) // Ordem cronológica: antigo -> recente

    // 5. Se houver qualquer registro de cancelamento no histórico, o status é CANCELADO
    const cancelado = logsValidos.find(item => item.etapa === 'CANCELADO') ||
        (logs || []).find(l => {
            const e = identificarEtapa(l)
            return e === 'CANCELADO'
        })
    if (cancelado) return 'CANCELADO'

    // 6. VERIFICAÇÃO DE FINALIZAÇÃO (ETAPA 06) PRIORITÁRIA
    // Se o status do pedido indica finalização OU se houver qualquer log da ETAPA 06
    const statusIndicaFinalizado = (
        statusUpper === 'ORDEM FINALIZADA' ||
        statusUpper.includes('FINALIZAD') ||
        statusUpper.includes('CONCLUID') ||
        statusUpper.includes('CONCLUÍD') ||
        statusUpper.includes('ENTREGUE') ||
        statusUpper.includes('ENCERRAD')
    )
    const temLogFinalizado = logsValidos.some(item => item.etapa === 'ETAPA 06') ||
        (logs || []).some(log => identificarEtapa(log) === 'ETAPA 06')

    if (statusIndicaFinalizado || temLogFinalizado) {
        return 'ETAPA 06'
    }

    // 7. Verificação de status para ETAPA 05 (somente se NÃO houver log da ETAPA 06)
    if (
        statusUpper === 'ORDEM GERADA' ||
        statusUpper.includes('ENVIADO') ||
        statusUpper.includes('LANÇAMENTO') ||
        statusUpper.includes('LANCAMENTO') ||
        statusUpper.includes('PROCESSAMENTO')
    ) {
        return 'ETAPA 05'
    }

    if (logsValidos.length === 0) {
        // Fallback caso as datas venham sem formato padrão
        for (const log of logs) {
            const etapa = identificarEtapa(log)
            if (etapa) {
                if (etapa === 'ETAPA 04') return 'ETAPA 05'
                return etapa
            }
        }
        if (etapaFixa) {
            const norm = normalizarNomeEtapa(etapaFixa)
            if (norm) return norm
        }
        return null
    }

    // 8. Se o último log for da ETAPA 04 (Aprovação da cotação), transicionou para a ETAPA 05
    const ultimoLog = logsValidos[logsValidos.length - 1]
    if (ultimoLog.etapa === 'ETAPA 04') {
        return 'ETAPA 05'
    }

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

// Extratores de datas específicas de cada etapa
export function getDataEntradaCotacao(order: any): string | null {
    if (!order) return null
    const logs = order.logs || []
    // Último log de aprovação da requisição (etapa 2) que libera para cotação
    const logsEtapa2 = logs.filter((l: any) => l.etapa === 2 || (l.acao && l.acao.includes('Aprovou a requisição')))
    if (logsEtapa2.length > 0) {
        return logsEtapa2[logsEtapa2.length - 1].data
    }
    // Fallback: array aprovacoes
    if (order.aprovacoes && order.aprovacoes.length > 0) {
        const lastAprov = order.aprovacoes[order.aprovacoes.length - 1]
        if (lastAprov.data || lastAprov.dataAprovacao) return lastAprov.data || lastAprov.dataAprovacao
    }
    return null
}

export function getDataEntradaAprovacaoCotacao(order: any): string | null {
    if (!order) return null
    const logs = order.logs || []
    const logEnvio = logs.find((l: any) => l.acao && l.acao.includes('Enviou a cotação'))
    if (logEnvio) return logEnvio.data
    const logPreencheu = logs.find((l: any) => l.acao && l.acao.includes('Preencheu a cotação'))
    if (logPreencheu) return logPreencheu.data
    return null
}

export function getDataAprovacaoCotacao(order: any): string | null {
    if (!order) return null
    const logs = order.logs || []
    const logsAprov = logs.filter((l: any) => l.etapa === 4 || (l.acao && l.acao.includes('Aprovou a cotação')))
    if (logsAprov.length > 0) {
        return logsAprov[logsAprov.length - 1].data
    }
    if (order.aprovacoesCotacao && order.aprovacoesCotacao.length > 0) {
        const last = order.aprovacoesCotacao[order.aprovacoesCotacao.length - 1]
        if (last.data || last.dataAprovacao) return last.data || last.dataAprovacao
    }
    return null
}

export function getDataFinalizacao(order: any): string | null {
    if (!order) return null
    const logs = order.logs || []
    const logsFinalizacao = logs.filter((l: any) => l.acao && (l.acao.includes('Encerrou o pedido') || l.acao.includes('finaliz')))
    if (logsFinalizacao.length > 0) {
        return logsFinalizacao[logsFinalizacao.length - 1].data
    }
    return null
}

// Função para calcular atraso em dias sem cotação (a partir de quando o pedido entrou em cotação)
export function calcularAtrasoCotacao(order?: any | null): CotacaoAlertInfo | null {
    if (!order) return null

    const etapaAtual = identificarEtapaAtual(order)

    // Se o pedido não está na etapa de cotação, não aplica alerta
    if (etapaAtual !== 'ETAPA 03') {
        return null
    }

    let timestampInicio = 0

    // Data de entrada em cotação (aprovação da etapa 2)
    const dataEntradaCotacao = getDataEntradaCotacao(order)
    if (dataEntradaCotacao) {
        timestampInicio = parseLogDate(dataEntradaCotacao)
    }

    if (!timestampInicio && order.logs && order.logs.length > 0) {
        const logEtapa3 = order.logs.find((log: any) => identificarEtapa(log) === 'ETAPA 03')
        if (logEtapa3) {
            timestampInicio = parseLogDate(logEtapa3.data)
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
            label: `${dias}d em cotação (Crítico)`
        }
    }

    if (dias >= 7) {
        return {
            dias,
            nivel: 'alerta',
            cor: 'text-orange-600 border-orange-500 bg-orange-50 dark:bg-orange-950/40',
            badgeBg: 'bg-orange-500 text-white',
            label: `${dias}d em cotação (Alerta)`
        }
    }

    if (dias >= 3) {
        return {
            dias,
            nivel: 'atencao',
            cor: 'text-amber-600 border-amber-500 bg-amber-50 dark:bg-amber-950/40',
            badgeBg: 'bg-amber-500 text-white',
            label: `${dias}d em cotação (Atenção)`
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