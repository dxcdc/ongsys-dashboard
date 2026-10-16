'use client'

import {
    BarChart3,
    Users,
    Package,
    Package2,
    LayoutDashboard,
    Shield
} from "lucide-react"
import { NavLink } from "./NavLink"
import { useRouter } from "next/navigation"
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarFooter,
    useSidebar,
} from "./ui/sidebar"
import { useAuth } from '@/src/hooks/useAuth'

export function AppSidebar() {
    const { state } = useSidebar()
    const collapsed = state === "collapsed"
    const router = useRouter()
    const { role } = useAuth()

    // Menu base
    const menuItems = []

    // Dashboard - visível para todos exceto SEPOD por enquanto
    if (role !== 'SEPOD') {
        menuItems.push({
            title: "Dashboard",
            url: "/dashboard",
            icon: LayoutDashboard,
        })
    }

    const podeVerFornecedores = role === 'SUPER_ADMIN' || role === 'OPERADOR_SEDE'
    const podeVerProdutos = role === 'SUPER_ADMIN' || role === 'OPERADOR_SEDE' || role === 'SEPOD'
    const podeVerAdmin = role === 'SUPER_ADMIN'

    // Adicionar Fornecedores
    if (podeVerFornecedores) {
        menuItems.push({
            title: "Fornecedores",
            url: "/fornecedores",
            icon: Users,
        })
    }

    // Adicionar Produtos (apenas para quem pode)
    if (podeVerProdutos) {
        menuItems.push({
            title: "Produtos",
            url: "/produtos",
            icon: Package2,
        })
    }

    // Pedidos - todos veem
    menuItems.push({
        title: "Pedidos",
        url: "/pedidos",
        icon: Package,
    })

    // Admin - apenas SUPER_ADMIN
    if (podeVerAdmin) {
        menuItems.push({
            title: "Admin",
            url: "/admin",
            icon: Shield,
        })
    }

    return (
        <Sidebar collapsible="icon">
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-[hsl(221,83%,53%)]" />
                            {!collapsed && (
                                <span className="font-bold text-sm text-white">
                                    ERP CDC
                                </span>
                            )}
                        </div>
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {menuItems.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild>
                                        <NavLink
                                            href={item.url}
                                            exact={item.url === "/dashboard"}
                                            className="hover:bg-[hsl(222,47%,16%)]"
                                            activeClassName="bg-[hsl(222,47%,16%)] text-white font-medium"
                                        >
                                            <item.icon className="mr-2 h-4 w-4" />
                                            {!collapsed && <span>{item.title}</span>}
                                        </NavLink>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    )
}