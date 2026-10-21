import { NextRequest, NextResponse } from 'next/server'
import { pedidosService } from '@/src/lib/api/services'
import { adaptPedido } from '@/src/lib/api/pedidos-adapter'

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const page = parseInt(searchParams.get('page') || searchParams.get('pageNumber') || '1', 10)
        const startDate = searchParams.get('startDate') || undefined
        const endDate = searchParams.get('endDate') || undefined

        const result = await pedidosService.listar({ startDate, endDate }, page)

        const rawData = result.data || []
        const data = rawData.map(adaptPedido)

        return NextResponse.json({
            data,
            totalPages: result.totalPages || 1,
            currentPage: result.currentPage || page,
            totalItems: result.totalItems || data.length
        })
    } catch (error: any) {
        console.error('❌ [API /pedidos] Erro ao buscar página:', error)
        return NextResponse.json(
            {
                data: [],
                totalPages: 1,
                currentPage: 1,
                totalItems: 0,
                error: error?.message || 'Erro ao consultar página na API OngSys'
            },
            { status: 500 }
        )
    }
}