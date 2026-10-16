// src/app/fornecedores/page.tsx
'use client'

import { useState, useEffect, useMemo } from "react"
import { motion } from "framer-motion"
import { Search, Eye, ChevronLeft, ChevronRight, Building2, RotateCcw } from "lucide-react"
import { Input } from "@/src/components/ui/input"
import { Button } from "@/src/components/ui/button"
import { Badge } from "@/src/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/src/components/ui/dialog"
import { Skeleton } from "@/src/components/ui/skeleton"
import { formatDocument, getDocumentType } from "@/src/lib/utils"
import { LoadingScreen } from "@/src/components/ui/LoadingScreen"
import { useFornecedores } from "@/src/contexts/FornecedoresContext"

const PAGE_SIZE = 20

interface Supplier {
    id: string
    code: string
    name: string
    document: string
    personType: 'PJ' | 'PF'
    email: string
    phone: string
    city: string
    state: string
    ativo: boolean
}

export default function FornecedoresPage() {
    const { data: allSuppliersRaw, loading, reload, loadError } = useFornecedores()
    const [search, setSearch] = useState("")
    const [typeFilter, setTypeFilter] = useState<string>("all")
    const [page, setPage] = useState(1)
    const [selected, setSelected] = useState<Supplier | null>(null)

    // Filtrar por busca e tipo em memória
    const filteredSuppliers: Supplier[] = useMemo(() => {
        let list: Supplier[] = (allSuppliersRaw as any[] || [])

        if (typeFilter !== 'all') {
            list = list.filter((supplier) => supplier.personType === typeFilter)
        }

        if (search.trim()) {
            const searchLower = search.toLowerCase().trim()
            list = list.filter((supplier) =>
                (supplier.name || '').toLowerCase().includes(searchLower) ||
                (supplier.document || '').includes(searchLower) ||
                (supplier.code || '').toLowerCase().includes(searchLower)
            )
        }

        return list
    }, [allSuppliersRaw, search, typeFilter])

    const totalItems = filteredSuppliers.length
    const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1

    // Resetar página quando filtros mudam
    useEffect(() => {
        setPage(1)
    }, [search, typeFilter])

    // Paginação dos dados exibidos em memória (instantânea)
    const paginatedSuppliers = useMemo(() => {
        return filteredSuppliers.slice(
            (page - 1) * PAGE_SIZE,
            page * PAGE_SIZE
        )
    }, [filteredSuppliers, page])

    if (loading && (!allSuppliersRaw || allSuppliersRaw.length === 0)) {
        return (
            <LoadingScreen
                variant="skeleton"
                title="Carregando fornecedores..."
                description="Buscando a lista completa de empresas e prestadores de serviço cadastrados."
            />
        )
    }

    return (
        <div className="space-y-5 animate-fade-in p-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Fornecedores</h1>
                <p className="text-muted-foreground">
                    {totalItems.toLocaleString("pt-BR")} fornecedores encontrados
                    {totalItems > PAGE_SIZE && (
                        <span className="text-xs ml-2">
                            (mostrando {paginatedSuppliers.length} na página {page})
                        </span>
                    )}
                </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nome, código ou documento..."
                        className="pl-10"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                        <SelectItem value="PF">Pessoa Física</SelectItem>
                    </SelectContent>
                </Select>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => reload()}
                    disabled={loading}
                    title="Recarregar fornecedores da OngSys"
                >
                    <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            {/* Indicadores de filtros ativos */}
            {(search || typeFilter !== 'all') && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                    <span>Filtros ativos:</span>
                    {search && (
                        <Badge variant="secondary" className="gap-1">
                            Busca: "{search}"
                            <button onClick={() => setSearch('')} className="ml-1 hover:text-foreground">×</button>
                        </Badge>
                    )}
                    {typeFilter !== 'all' && (
                        <Badge variant="secondary" className="gap-1">
                            Tipo: {typeFilter === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                            <button onClick={() => setTypeFilter('all')} className="ml-1 hover:text-foreground">×</button>
                        </Badge>
                    )}
                </div>
            )}

            <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/50">
                                <th className="text-left p-3 text-muted-foreground font-medium">Código</th>
                                <th className="text-left p-3 text-muted-foreground font-medium">Nome</th>
                                <th className="text-left p-3 text-muted-foreground font-medium hidden md:table-cell">Documento</th>
                                <th className="text-left p-3 text-muted-foreground font-medium hidden sm:table-cell">Tipo</th>
                                <th className="text-left p-3 text-muted-foreground font-medium hidden lg:table-cell">Email</th>
                                <th className="text-left p-3 text-muted-foreground font-medium hidden lg:table-cell">Telefone</th>
                                <th className="text-center p-3 text-muted-foreground font-medium">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedSuppliers.map((supplier: Supplier) => {
                                const docType = getDocumentType(supplier.document)
                                return (
                                    <tr
                                        key={supplier.id}
                                        className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                                    >
                                        <td className="p-3 font-mono text-xs text-card-foreground">{supplier.code}</td>
                                        <td className="p-3 text-card-foreground font-medium">
                                            <div className="flex items-center gap-2">
                                                <Building2 className="w-4 h-4 text-muted-foreground" />
                                                <span>{supplier.name}</span>
                                                {!supplier.ativo && (
                                                    <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                                        Inativo
                                                    </Badge>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3 text-muted-foreground hidden md:table-cell font-mono text-xs">
                                            <div className="flex items-center gap-2">
                                                <span>{formatDocument(supplier.document)}</span>
                                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                                    {docType}
                                                </Badge>
                                            </div>
                                        </td>
                                        <td className="p-3 hidden sm:table-cell">
                                            <Badge
                                                variant="outline"
                                                className={
                                                    supplier.personType === "PJ"
                                                        ? "border-primary/30 text-primary"
                                                        : "border-chart-5/30 text-chart-5"
                                                }
                                            >
                                                {supplier.personType === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"}
                                            </Badge>
                                        </td>
                                        <td className="p-3 text-muted-foreground hidden lg:table-cell">{supplier.email || '—'}</td>
                                        <td className="p-3 text-muted-foreground hidden lg:table-cell">{supplier.phone || '—'}</td>
                                        <td className="p-3 text-center">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setSelected(supplier)}
                                            >
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                )
                            })}
                            {paginatedSuppliers.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                                        Nenhum fornecedor encontrado
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginação */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30">
                        <p className="text-sm text-muted-foreground">
                            {totalItems > 0 ? (
                                <>Mostrando {((page - 1) * PAGE_SIZE) + 1} - {Math.min(page * PAGE_SIZE, totalItems)} de {totalItems} fornecedores</>
                            ) : (
                                'Nenhum fornecedor encontrado'
                            )}
                        </p>
                        <div className="flex gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage(page - 1)}
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= totalPages}
                                onClick={() => setPage(page + 1)}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de detalhes */}
            <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Detalhes do Fornecedor</DialogTitle>
                    </DialogHeader>
                    {selected && (
                        <div className="space-y-3">
                            <div className="flex justify-between py-2 border-b border-border">
                                <span className="text-muted-foreground text-sm">Código</span>
                                <span className="text-card-foreground text-sm font-medium">{selected.code}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border">
                                <span className="text-muted-foreground text-sm">Nome</span>
                                <span className="text-card-foreground text-sm font-medium">{selected.name}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border">
                                <span className="text-muted-foreground text-sm">Documento</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-card-foreground text-sm font-medium">
                                        {formatDocument(selected.document)}
                                    </span>
                                    <Badge variant="outline" className="text-[10px]">
                                        {getDocumentType(selected.document)}
                                    </Badge>
                                </div>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border">
                                <span className="text-muted-foreground text-sm">Tipo</span>
                                <span className="text-card-foreground text-sm font-medium">
                                    {selected.personType === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"}
                                </span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border">
                                <span className="text-muted-foreground text-sm">Status</span>
                                <Badge variant={selected.ativo ? "default" : "destructive"}>
                                    {selected.ativo ? "Ativo" : "Inativo"}
                                </Badge>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border">
                                <span className="text-muted-foreground text-sm">Email</span>
                                <span className="text-card-foreground text-sm font-medium">{selected.email || '—'}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border">
                                <span className="text-muted-foreground text-sm">Telefone</span>
                                <span className="text-card-foreground text-sm font-medium">{selected.phone || '—'}</span>
                            </div>
                            {selected.city && (
                                <div className="flex justify-between py-2 border-b border-border">
                                    <span className="text-muted-foreground text-sm">Cidade</span>
                                    <span className="text-card-foreground text-sm font-medium">
                                        {selected.city} - {selected.state}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}