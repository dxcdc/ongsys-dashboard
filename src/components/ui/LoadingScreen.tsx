'use client'

import { motion } from 'framer-motion'
import { Loader2, LayoutDashboard } from 'lucide-react'
import { Skeleton } from '@/src/components/ui/skeleton'

interface LoadingScreenProps {
    variant?: 'full' | 'inline' | 'skeleton'
    title?: string
    description?: string
    currentProgress?: number
    totalProgress?: number
}

export function LoadingScreen({
    variant = 'full',
    title = 'Carregando informações...',
    description = 'Aguarde um momento enquanto os dados são processados.',
    currentProgress = 0,
    totalProgress = 0
}: LoadingScreenProps) {
    const hasProgress = totalProgress > 0
    const progressPercent = hasProgress ? Math.min(100, Math.round((currentProgress / totalProgress) * 100)) : 0

    if (variant === 'skeleton') {
        return (
            <div className="space-y-6 p-6 animate-fade-in w-full">
                <div className="flex items-center justify-between">
                    <div>
                        <Skeleton className="h-8 w-48 mb-2" />
                        <Skeleton className="h-4 w-72" />
                    </div>
                    <Skeleton className="h-10 w-32" />
                </div>

                <div className="flex gap-3 flex-wrap">
                    <Skeleton className="h-10 flex-1 min-w-[200px]" />
                    <Skeleton className="h-10 w-40" />
                    <Skeleton className="h-10 w-40" />
                    <Skeleton className="h-10 w-40" />
                </div>

                <div className="bg-card rounded-xl border border-border p-8 text-center flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 animate-pulse" />
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="relative mb-4">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            </div>
                            <span className="absolute -inset-1 rounded-full bg-primary/20 animate-ping opacity-30 pointer-events-none" />
                        </div>
                        <h3 className="text-base font-semibold text-foreground">{title}</h3>
                        <p className="text-xs text-muted-foreground mt-1 max-w-sm">{description}</p>

                        {hasProgress && (
                            <div className="mt-4 w-full max-w-xs space-y-2">
                                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                    <motion.div
                                        className="bg-primary h-2 rounded-full"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progressPercent}%` }}
                                        transition={{ duration: 0.3 }}
                                    />
                                </div>
                                <p className="text-[11px] text-muted-foreground font-mono">
                                    Página {currentProgress} de {totalProgress} ({progressPercent}%)
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-14 w-full rounded-lg" />
                    ))}
                </div>
            </div>
        )
    }

    if (variant === 'inline') {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
                <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                </div>
                <div>
                    <p className="text-sm font-medium text-foreground">{title}</p>
                    {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-[60vh] h-full w-full flex flex-col items-center justify-center p-6 bg-background/50 backdrop-blur-xs relative overflow-hidden">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center text-center max-w-sm z-10"
            >
                {/* Visual Glow Brand Badge */}
                <div className="relative mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary/20 via-primary/10 to-transparent border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/5">
                        <LayoutDashboard className="w-8 h-8 text-primary animate-pulse" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center shadow-xs">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    </div>
                </div>

                <h2 className="text-lg font-bold text-foreground tracking-tight">{title}</h2>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{description}</p>

                {hasProgress && (
                    <div className="mt-5 w-full space-y-2">
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                            <motion.div
                                className="bg-primary h-2 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercent}%` }}
                                transition={{ duration: 0.3 }}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">
                            {progressPercent}% concluído
                        </p>
                    </div>
                )}
            </motion.div>
        </div>
    )
}
