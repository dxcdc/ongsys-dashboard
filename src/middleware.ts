import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token
        const path = req.nextUrl.pathname
        const role = token?.role as string

        // SUPER_ADMIN tem acesso a tudo
        if (role === 'SUPER_ADMIN') {
            return NextResponse.next()
        }

        // ROTAS QUE CONSULTOR NÃO PODE ACESSAR
        const rotasBloqueadasParaConsultor = [
            '/fornecedores',
            '/produtos',
            '/admin',
            '/configuracoes'
        ]

        if (role === 'CONSULTOR') {
            if (rotasBloqueadasParaConsultor.some(rota => path.startsWith(rota))) {
                return NextResponse.redirect(new URL('/dashboard', req.url))
            }
        }

        // ROTAS QUE SEPOD NÃO PODE ACESSAR (redireciona para /pedidos)
        const rotasBloqueadasParaSEPOD = [
            '/fornecedores',
            '/admin',
            '/configuracoes',
            '/dashboard'
        ]

        if (role === 'SEPOD') {
            if (rotasBloqueadasParaSEPOD.some(rota => path.startsWith(rota))) {
                return NextResponse.redirect(new URL('/pedidos', req.url))
            }
        }

        // OPERADOR_SEDE não pode acessar /admin
        if (role === 'OPERADOR_SEDE' && path.startsWith('/admin')) {
            return NextResponse.redirect(new URL('/dashboard', req.url))
        }

        return NextResponse.next()
    },
    {
        callbacks: {
            authorized: ({ token }) => !!token
        },
        pages: {
            signIn: '/login'
        }
    }
)

export const config = {
    matcher: [
        '/dashboard/:path*',
        '/pedidos/:path*',
        '/fornecedores/:path*',
        '/produtos/:path*',
        '/admin/:path*',
        '/configuracoes/:path*'
    ]
}