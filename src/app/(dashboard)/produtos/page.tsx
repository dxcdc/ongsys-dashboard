'use client'

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
    Search,
    Package,
    ChevronLeft,
    ChevronRight,
    Eye,
    Download,
    Filter,
    CheckCircle,
    XCircle,
    Ruler,
    Package2,
    Building2,
    CreditCard,
    FileText
} from "lucide-react"
import { Input } from "@/src/components/ui/input"
import { Badge } from "@/src/components/ui/badge"
import { Button } from "@/src/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select"
import { Skeleton } from "@/src/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/src/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu"
import { clearCache } from '@/src/lib/api/cache';
import { LoadingScreen } from "@/src/components/ui/LoadingScreen"

const PAGE_SIZE = 20

interface Product {
    id: string
    codigo: string
    nome: string
    categoria: string
    unidadeMedida: string
    status: string
    descricao?: string
    origem?: string
    contaPadrao?: string
    fabricante?: string
    valorCustoBase?: number
}

const STATUS_OPTIONS = [
    { value: 'Todos', label: 'Todos os status', icon: null, color: '' },
    { value: 'ativo', label: 'Ativo', icon: CheckCircle, color: 'text-success' },
    { value: 'inativo', label: 'Inativo', icon: XCircle, color: 'text-destructive' },
]

export default function ProdutosPage() {
    const [allProducts, setAllProducts] = useState<Product[]>([])
    const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [categoria, setCategoria] = useState("Todos")
    const [status, setStatus] = useState("Todos")
    const [page, setPage] = useState(1)
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
    const [exporting, setExporting] = useState(false)
    const [categorias, setCategorias] = useState<string[]>(['Todos'])

    const fetchAllProducts = async () => {
        setLoading(true)
        try {
            let allData: Product[] = []
            let currentPage = 1
            let hasMore = true
            let totalRecords = 0

            while (hasMore) {
                const params = new URLSearchParams()
                params.append('page', currentPage.toString())

                console.log(`📄 Buscando página ${currentPage}...`)
                const response = await fetch(`/api/produtos?${params.toString()}`)

                if (!response.ok) {
                    throw new Error(`Erro ao buscar página ${currentPage}`)
                }

                const data = await response.json()

                if (currentPage === 1) {
                    totalRecords = data.totalItems || data.totalRecords || 0
                    console.log(`📊 Total de registros na API: ${totalRecords}`)
                }

                const produtosFormatados: Product[] = (data.data || []).map((item: any) => ({
                    id: String(item.id),
                    codigo: String(item.id),
                    nome: item.nomeProduto || 'Produto sem nome',
                    categoria: item.grupo || 'Sem categoria',
                    unidadeMedida: item.unidadeMedida || 'Unidade',
                    status: item.status === 'inativo' ? 'inativo' : 'ativo',
                    descricao: item.descricaoProduto || '',
                    origem: item.origem || 'Não informada',
                    contaPadrao: item.contaPadraoPlanoFinanceiro || '',
                    fabricante: item.fabricante || '',
                    valorCustoBase: parseFloat(item.valorCustoBase) || 0
                }))

                allData = [...allData, ...produtosFormatados]

                console.log(`📄 Página ${currentPage}: +${produtosFormatados.length} produtos (total: ${allData.length})`)

                const totalPages = Math.ceil(totalRecords / 100)
                hasMore = currentPage < totalPages
                currentPage++

                if (hasMore) {
                    await new Promise(resolve => setTimeout(resolve, 100))
                }
            }

            console.log(`✅ Total de produtos carregados: ${allData.length}`)
            setAllProducts(allData)

            const uniqueCategorias = ['Todos', ...new Set(allData.map(p => p.categoria).filter(Boolean))]
            setCategorias(uniqueCategorias)

            applyFilters(allData, search, categoria, status)

        } catch (error) {
            console.error('Erro ao buscar produtos:', error)
        } finally {
            setLoading(false)
        }
    }

    const applyFilters = (products: Product[], searchTerm: string, cat: string, stat: string) => {
        let filtered = [...products]

        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase()
            filtered = filtered.filter(p =>
                p.nome.toLowerCase().includes(searchLower) ||
                p.codigo.toLowerCase().includes(searchLower) ||
                p.categoria.toLowerCase().includes(searchLower)
            )
        }

        if (cat !== 'Todos') {
            filtered = filtered.filter(p => p.categoria === cat)
        }

        if (stat !== 'Todos') {
            filtered = filtered.filter(p => p.status === stat)
        }

        setFilteredProducts(filtered)
        setPage(1)
    }

    // Carregar todos os produtos na montagem do componente
    useEffect(() => {
        // Limpar cache em desenvolvimento
        if (process.env.NODE_ENV === 'development') {
            clearCache()
        }
        fetchAllProducts()
    }, [])

    // Aplicar filtros quando os critérios mudarem
    useEffect(() => {
        if (allProducts.length > 0) {
            applyFilters(allProducts, search, categoria, status)
        }
    }, [search, categoria, status, allProducts])

    // Paginação dos dados filtrados
    const paginatedProducts = filteredProducts.slice(
        (page - 1) * PAGE_SIZE,
        page * PAGE_SIZE
    )

    const totalItems = filteredProducts.length
    const totalPages = Math.ceil(totalItems / PAGE_SIZE)

    // Função para obter o ícone do status
    const getStatusIcon = (statusValue: string) => {
        const option = STATUS_OPTIONS.find(opt => opt.value === statusValue?.toLowerCase())
        if (option?.icon) {
            const Icon = option.icon
            return <Icon className={`w-3 h-3 mr-1 ${option.color}`} />
        }
        return null
    }

    // Função para exportar (simulada por enquanto)
    const handleExport = async (tipo: 'filtro' | 'pagina' | 'tudo') => {
        setExporting(true)
        try {
            await new Promise(resolve => setTimeout(resolve, 1000))
            alert(`Exportação de ${tipo} simulada! ${tipo === 'pagina' ? paginatedProducts.length : totalItems} itens.`)
        } catch (error) {
            console.error('Erro ao exportar:', error)
            alert('Erro ao exportar produtos. Tente novamente.')
        } finally {
            setExporting(false)
        }
    }

    if (loading && allProducts.length === 0) {
        return (
            <LoadingScreen
                variant="skeleton"
                title="Carregando produtos..."
                description="Buscando o catálogo de produtos e unidades de medida cadastradas."
            />
        )
    }

    return (
        <div className="space-y-5 animate-fade-in p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
                    <p className="text-muted-foreground">
                        {totalItems.toLocaleString("pt-BR")} produtos encontrados
                        {totalItems > PAGE_SIZE && (
                            <span className="text-xs ml-2">
                                (mostrando {paginatedProducts.length} na página {page})
                            </span>
                        )}
                    </p>
                </div>

                {/* Botão de exportação */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" disabled={exporting}>
                            <Download className="w-4 h-4 mr-2" />
                            {exporting ? 'Exportando...' : 'Exportar'}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>Opções de Exportação</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleExport('pagina')}>
                            <Filter className="w-4 h-4 mr-2" />
                            Página atual ({paginatedProducts.length} itens)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport('filtro')}>
                            <Filter className="w-4 h-4 mr-2" />
                            Filtro atual ({totalItems} itens)
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleExport('tudo')}>
                            <Package className="w-4 h-4 mr-2" />
                            Todos os produtos
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar produto por nome ou código..."
                        className="pl-10"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* Filtro de categoria */}
                <Select value={categoria} onValueChange={setCategoria}>
                    <SelectTrigger className="w-44">
                        <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                        {categorias.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Filtro de status */}
                <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                <div className="flex items-center gap-2">
                                    {option.icon && <option.icon className={`w-4 h-4 ${option.color || ''}`} />}
                                    <span>{option.label}</span>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Indicadores de filtros ativos */}
            {(search || categoria !== 'Todos' || status !== 'Todos') && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                    <span>Filtros ativos:</span>
                    {search && (
                        <Badge variant="secondary" className="gap-1">
                            Busca: "{search}"
                            <button onClick={() => setSearch('')} className="ml-1 hover:text-foreground">×</button>
                        </Badge>
                    )}
                    {categoria !== 'Todos' && (
                        <Badge variant="secondary" className="gap-1">
                            Categoria: {categoria}
                            <button onClick={() => setCategoria('Todos')} className="ml-1 hover:text-foreground">×</button>
                        </Badge>
                    )}
                    {status !== 'Todos' && (
                        <Badge variant="secondary" className="gap-1">
                            Status: {status === 'ativo' ? 'Ativo' : 'Inativo'}
                            <button onClick={() => setStatus('Todos')} className="ml-1 hover:text-foreground">×</button>
                        </Badge>
                    )}
                </div>
            )}

            {/* Tabela de produtos */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/50">
                                <th className="text-left p-3 text-muted-foreground font-medium">Código</th>
                                <th className="text-left p-3 text-muted-foreground font-medium">Nome</th>
                                <th className="text-left p-3 text-muted-foreground font-medium hidden md:table-cell">Grupo</th>
                                <th className="text-left p-3 text-muted-foreground font-medium hidden sm:table-cell">Unidade</th>
                                <th className="text-left p-3 text-muted-foreground font-medium hidden lg:table-cell">Status</th>
                                <th className="text-center p-3 text-muted-foreground font-medium">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedProducts.map((product, index) => (
                                <motion.tr
                                    key={`${product.id}-${product.codigo}-${index}`}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.03 }}
                                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                                >
                                    <td className="p-3 font-mono text-xs text-card-foreground">
                                        {product.codigo}
                                    </td>
                                    <td className="p-3 text-card-foreground font-medium">
                                        {product.nome}
                                    </td>
                                    <td className="p-3 hidden md:table-cell">
                                        <Badge variant="outline" className="text-xs">
                                            {product.categoria}
                                        </Badge>
                                    </td>
                                    <td className="p-3 hidden sm:table-cell">
                                        <div className="flex items-center gap-1">
                                            <Ruler className="w-3 h-3 text-muted-foreground" />
                                            <span className="text-card-foreground">
                                                {product.unidadeMedida}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-3 hidden lg:table-cell">
                                        <div className="flex items-center">
                                            {getStatusIcon(product.status)}
                                            <Badge
                                                variant="outline"
                                                className={
                                                    product.status === 'ativo'
                                                        ? 'border-success/30 text-success'
                                                        : 'border-destructive/30 text-destructive'
                                                }
                                            >
                                                {product.status === 'ativo' ? 'Ativo' : 'Inativo'}
                                            </Badge>
                                        </div>
                                    </td>
                                    <td className="p-3 text-center">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setSelectedProduct(product)}
                                            title="Ver detalhes"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </Button>
                                    </td>
                                </motion.tr>
                            ))}
                            {paginatedProducts.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                        Nenhum produto encontrado com os filtros selecionados
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
                                <>Mostrando {((page - 1) * PAGE_SIZE) + 1} - {Math.min(page * PAGE_SIZE, totalItems)} de {totalItems} produtos</>
                            ) : (
                                'Nenhum produto encontrado'
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
            <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Detalhes do Produto</DialogTitle>
                    </DialogHeader>
                    {selectedProduct && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Package className="w-4 h-4" />
                                        <span>Código</span>
                                    </div>
                                    <p className="text-card-foreground font-mono text-sm font-medium pl-6">
                                        {selectedProduct.codigo}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Package2 className="w-4 h-4" />
                                        <span>Nome</span>
                                    </div>
                                    <p className="text-card-foreground text-sm font-medium pl-6">
                                        {selectedProduct.nome}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Filter className="w-4 h-4" />
                                        <span>Grupo</span>
                                    </div>
                                    <p className="text-card-foreground text-sm font-medium pl-6">
                                        {selectedProduct.categoria}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        {getStatusIcon(selectedProduct.status)}
                                        <span>Status</span>
                                    </div>
                                    <div className="pl-6">
                                        <Badge
                                            variant="outline"
                                            className={
                                                selectedProduct.status === 'ativo'
                                                    ? 'border-success/30 text-success'
                                                    : 'border-destructive/30 text-destructive'
                                            }
                                        >
                                            {selectedProduct.status === 'ativo' ? 'Ativo' : 'Inativo'}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Ruler className="w-4 h-4" />
                                        <span>Unidade de Medida</span>
                                    </div>
                                    <p className="text-card-foreground text-sm font-medium pl-6">
                                        {selectedProduct.unidadeMedida}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Building2 className="w-4 h-4" />
                                        <span>Fabricante</span>
                                    </div>
                                    <p className="text-card-foreground text-sm font-medium pl-6">
                                        {selectedProduct.fabricante || 'Não informado'}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Package className="w-4 h-4" />
                                        <span>Origem</span>
                                    </div>
                                    <p className="text-card-foreground text-sm font-medium pl-6">
                                        {selectedProduct.origem}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <CreditCard className="w-4 h-4" />
                                        <span>Conta Padrão</span>
                                    </div>
                                    <p className="text-card-foreground text-sm font-medium pl-6">
                                        {selectedProduct.contaPadrao || 'Não informada'}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <FileText className="w-4 h-4" />
                                    <span>Descrição</span>
                                </div>
                                <p className="text-card-foreground text-sm pl-6 bg-muted/30 p-3 rounded-md">
                                    {selectedProduct.descricao || 'Sem descrição cadastrada'}
                                </p>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}