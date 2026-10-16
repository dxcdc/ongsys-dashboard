// src/app/api/fornecedores/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { fornecedoresService } from '@/src/lib/api/services';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const filtro = searchParams.get('filtro') || undefined;

        const result = await fornecedoresService.listar(page, filtro);

        return NextResponse.json(result);
    } catch (error) {
        console.error('Erro ao buscar fornecedores:', error);
        return NextResponse.json(
            { error: 'Erro ao buscar fornecedores' },
            { status: 500 }
        );
    }
}