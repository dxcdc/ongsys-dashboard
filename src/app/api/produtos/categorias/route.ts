import { NextResponse } from 'next/server';
import { produtosService } from '@/src/lib/api/services';

export async function GET() {
    try {
        const allProducts = await produtosService.listarTodos();

        const categorias = [...new Set(allProducts.map((p: any) => p.grupo || 'Sem categoria').filter(Boolean))];

        const statusList = ['ativo', 'inativo'];

        return NextResponse.json({
            categorias: categorias.sort(),
            statusList
        });
    } catch (error) {
        console.error('Erro ao buscar categorias:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}