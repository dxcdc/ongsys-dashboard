import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { costCentersList } from '../cost-centers-map'

const prisma = new PrismaClient()

type UserRole = 'SUPER_ADMIN' | 'OPERADOR_SEDE' | 'CONSULTOR' | 'SEPOD'

// Função para filtrar apenas centros ATITUDE para SEPOD
function filterAtitudeCenters(centrosCusto: string[]): string[] {
    const atitudeCodes = costCentersList
        .filter((center) => center.name.toUpperCase().includes('ATITUDE'))
        .map((center) => center.code)

    return centrosCusto.filter(code => atitudeCodes.includes(code))
}

declare module 'next-auth' {
    interface User {
        id: string
        role: UserRole
        nome: string
        centrosCusto: string[]
    }
    interface Session {
        user: {
            id: string
            email: string
            name: string
            role: UserRole
            centrosCusto: string[]
        }
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        id: string
        role: UserRole
        nome: string
        centrosCusto: string[]
    }
}

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                senha: { label: 'Senha', type: 'password' }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.senha) {
                    return null
                }

                try {
                    const usuario = await prisma.usuario.findUnique({
                        where: { email: credentials.email }
                    })

                    if (!usuario || !usuario.ativo) {
                        return null
                    }

                    const senhaValida = await bcrypt.compare(credentials.senha, usuario.senha)

                    if (!senhaValida) {
                        return null
                    }

                    let centrosCusto = usuario.centrosCusto || []

                    if (usuario.role === 'SEPOD') {
                        centrosCusto = filterAtitudeCenters(centrosCusto)
                        console.log('🔒 SEPOD - Centros ATITUDE filtrados:', centrosCusto)
                    }

                    return {
                        id: usuario.id,
                        email: usuario.email,
                        nome: usuario.nome,
                        role: usuario.role as UserRole,
                        centrosCusto: centrosCusto
                    }
                } catch (err) {
                    console.error('Erro na autorização do NextAuth:', err)
                    return null
                }
            }
        })
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id
                token.role = user.role as UserRole
                token.nome = user.nome
                token.centrosCusto = user.centrosCusto || []
            }
            return token
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string
                session.user.role = token.role as UserRole
                session.user.name = token.nome as string
                session.user.centrosCusto = token.centrosCusto as string[]
            }
            return session
        }
    },
    pages: {
        signIn: '/login',
        error: '/login'
    },
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60
    },
    secret: process.env.NEXTAUTH_SECRET || 'ongsys-dashboard-nextauth-secret-key'
}