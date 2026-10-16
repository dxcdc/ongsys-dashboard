// src/types/fornecedor.ts
export interface Fornecedor {
    id: number | string
    code?: string
    nome?: string
    name?: string
    documento?: string
    document?: string
    tipo_pessoa?: 'FISICA' | 'JURIDICA' | 'PJ' | 'PF'
    personType?: 'PJ' | 'PF'
    email?: string
    telefone?: string
    phone?: string
    celular?: string
    endereco?: any
    numero?: string
    complemento?: string
    bairro?: string
    cidade?: string
    city?: string
    estado?: string
    state?: string
    cep?: string
    contato_nome?: string
    contato_email?: string
    contato_telefone?: string
    ativo?: boolean
    observacao?: string
    created_at?: string
    updated_at?: string
}

export interface FornecedorResumo {
    id: number
    nome: string
    documento: string
    total_compras?: number
    ultima_compra?: string
}