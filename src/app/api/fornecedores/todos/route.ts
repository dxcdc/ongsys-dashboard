import { NextResponse } from 'next/server'
import { fornecedoresService } from '@/src/lib/api/services'

function getPersonType(item: any): 'PJ' | 'PF' {
    const tipo = item.tipo_pessoa || item.pessoa || item.tipo || item.tipoFornecedor || ''
    if (tipo === 'Jurídica' || tipo === 'Juridica' || tipo === 'J') return 'PJ'
    if (tipo === 'Física' || tipo === 'Fisica' || tipo === 'F') return 'PF'
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
            const id = String(item.id_ongsys || item.id || item.codigo || '')
            const name = item.nome_empresa || item.nomeEmpresa || item.nome_fantasia || item.nome || 'Nome não informado'
            const ativo = item.ativo_inativo ? item.ativo_inativo === 'A' : (item.ativoInativo === 'A')
            return {
                id,
                code: id,
                name,
                document: item.documento || '',
                personType: getPersonType(item),
                email: item.email || '',
                phone: item.telefonePrincipal || item.telefone || '',
                city: endereco.cidade || item.cidade || '',
                state: endereco.estado || item.estado || '',
                ativo
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