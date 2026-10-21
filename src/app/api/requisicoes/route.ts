import { NextRequest, NextResponse } from 'next/server'
import { requisicoesService } from '@/src/lib/api/services'

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const page = parseInt(searchParams.get('page') || searchParams.get('pageNumber') || '1', 10)
        const startDate = searchParams.get('startDate') || undefined
        const endDate = searchParams.get('endDate') || undefined

        const result = await requisicoesService.listar({ startDate, endDate }, page)

        return NextResponse.json({
            data: result.data || [],
            totalPages: result.totalPages || 1,
            currentPage: result.currentPage || page,
            totalItems: result.totalItems || 0
        })
    } catch (error: any) {
        console.error('❌ [API /requisicoes] Erro ao buscar página:', error)
        return NextResponse.json(
            {
                data: [],
                totalPages: 1,
                currentPage: 1,
                totalItems: 0,
                error: error?.message || 'Erro ao consultar página de requisições na API OngSys'
            },
            { status: 500 }
        )
    }
}
