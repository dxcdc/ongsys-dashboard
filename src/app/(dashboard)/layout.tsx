// src/app/(dashboard)/layout.tsx
'use client'

import { AppSidebar } from '@/src/components/AppSidebar'
import { TopBar } from '@/src/components/ui/TopBar'
import { SidebarProvider } from '@/src/components/ui/sidebar'
import { useAuth } from '@/src/hooks/useAuth'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { PedidosProvider } from '@/src/contexts/PedidosContext'
import { ProdutosProvider } from '@/src/contexts/ProdutosContext'
import { FornecedoresProvider } from '@/src/contexts/FornecedoresContext'
import { LoadingScreen } from '@/src/components/ui/LoadingScreen'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { isLoading, isAuthenticated } = useAuth()
    const router = useRouter()

    console.log('📦 DashboardLayout:', { isLoading, isAuthenticated })

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            console.log('🔴 Redirecionando para login...')
            router.push('/login')
        }
    }, [isLoading, isAuthenticated, router])

    if (isLoading) {
        return (
            <LoadingScreen
                variant="full"
                title="Autenticando..."
                description="Verificando as permissões de acesso ao OngSys Dashboard."
            />
        )
    }

    if (!isAuthenticated) {
        return null
    }

    return (
        <SidebarProvider>
            <PedidosProvider>
                <ProdutosProvider>
                    <FornecedoresProvider>
                        <div className="flex h-screen overflow-hidden">
                            <div className="h-full overflow-y-auto">
                                <AppSidebar />
                            </div>
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <TopBar title="Dashboard" />
                                <main className="flex-1 overflow-y-auto p-6 bg-background">
                                    {children}
                                </main>
                            </div>
                        </div>
                    </FornecedoresProvider>
                </ProdutosProvider>
            </PedidosProvider>
        </SidebarProvider>
    )
}