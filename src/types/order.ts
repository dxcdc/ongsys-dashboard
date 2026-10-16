export interface Order {
    id: number | string
    id_requisicao: string
    id_pedido?: string
    titulo: string
    status_pedido: string
    etapa?: string
    fornecedor_nome: string
    fornecedor_documento?: string
    requisitante?: string
    solicitante?: string
    comprador?: string
    responsavel_cotacao?: string
    data_pedido: string
    dataEntregaEstimada?: string
    tipo_pedido: string
    tipo_requisicao?: string
    subprojeto?: string
    valor_total: number
    local_entrega?: any
    itens_pedido?: any[]
    logs?: any[]
    descricao_pedido?: string
    justificativa_compra?: string
    fonte_pagadora?: string
    conta_plano_financeiro?: string
    cancelamento?: {
        data?: string
        usuario?: string
        justificativa?: string
    } | null
    aprovacoes?: any[]
    aprovacoesCotacao?: any[]
}

export type OrderStatus = 'Ordem finalizada' | 'Aguardando aprovação' | 'Em andamento' | 'Cancelado' | 'Rascunho'
export type OrderType = 'produto' | 'serviço'