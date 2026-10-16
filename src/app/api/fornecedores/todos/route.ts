import { NextResponse } from 'next/server'
import { fornecedoresService } from '@/src/lib/api/services'

function getPersonType(item: any): 'PJ' | 'PF' {
    if (item.pessoa === 'Jurídica' || item.tipo === 'J' || item.tipoFornecedor === 'Jurídica') return 'PJ'
    if (item.pessoa === 'Física' || item.tipo === 'F' || item.tipoFornecedor === 'Física') return 'PF'
    const doc = (item.documento || '').replace(/\D/g, '')
    if (doc.length === 14) return 'PJ'
    if (doc.length === 11) return 'PF'
    return 'PJ'
}

export async function GET() {
    try {
        const rawList = await fornecedoresService.listarTodos()
        const data = rawList.map((item: any) => {
            const endereco = item.endereco || {}
            return {
                id: String(item.id || item.codigo || ''),
                code: String(item.id || item.codigo || ''),
                name: item.nomeEmpresa || item.nome || 'Nome não informado',
                document: item.documento || '',
                personType: getPersonType(item),
                email: item.email || '',
                phone: item.telefonePrincipal || item.telefone || '',
                city: endereco.cidade || '',
                state: endereco.estado || '',
                ativo: item.ativoInativo === 'A'
            }
        })
        return NextResponse.json({ data, total: data.length })
    } catch (error: any) {
        console.error('Erro ao buscar todos os fornecedores:', error)
        return NextResponse.json(
            { data: [], total: 0, error: error?.message || 'Erro ao carregar fornecedores' },
            { status: 200 }
        )
    }
}