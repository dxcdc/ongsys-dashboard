// src/types/produto.ts
export interface Produto {
    id: number | string
    codigo: string
    nome: string
    categoria?: string
    unidadeMedida?: string
    status?: string
    descricao?: string
    origem?: string
    contaPadrao?: string
    fabricante?: string
    valorCustoBase?: number
    grupo?: string
    unidade_medida?: string
    preco_unitario?: number
    quantidade_estoque?: number
    estoque_minimo?: number
    ativo?: boolean
    created_at?: string
    updated_at?: string
}

export interface ItemPedido {
    id?: number
    pedido_id?: number
    produto_id?: number
    nomeProduto?: string
    nomeServico?: string
    quantidade: number
    valorUnitario: number
    valorTotal?: number
    grupo?: string
    centroCusto?: string
    observacao?: string
}

export type UnidadeMedida = 'UN' | 'KG' | 'L' | 'M' | 'M2' | 'M3' | 'CX' | 'PC' | 'PAR'