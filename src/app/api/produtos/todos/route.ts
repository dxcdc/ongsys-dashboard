import { NextResponse } from 'next/server'
import { produtosService } from '@/src/lib/api/services'

export async function GET() {
    try {
        const rawList = await produtosService.listarTodos()
        const data = rawList.map((item: any) => ({
            id: String(item.id),
            codigo: String(item.id),
            nome: item.nomeProduto || 'Produto sem nome',
            categoria: item.grupo || 'Sem categoria',
            unidadeMedida: item.unidadeMedida || 'Unidade',
            status: item.status === 'inativo' ? 'inativo' : 'ativo',
            descricao: item.descricaoProduto || '',
            origem: item.origem || 'Não informada',
            contaPadrao: item.contaPadraoPlanoFinanceiro || '',
            fabricante: item.fabricante || '',
            valorCustoBase: parseFloat(item.valorCustoBase) || 0
        }))
        return NextResponse.json({ data, total: data.length })
    } catch (error: any) {
        console.error('Erro ao buscar todos os produtos:', error)
        return NextResponse.json(
            { data: [], total: 0, error: error?.message || 'Erro ao carregar produtos' },
            { status: 200 }
        )
    }
}