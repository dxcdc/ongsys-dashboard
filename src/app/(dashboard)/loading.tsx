import { LoadingScreen } from '@/src/components/ui/LoadingScreen'

export default function DashboardRouteLoading() {
    return (
        <LoadingScreen
            variant="full"
            title="Carregando painel..."
            description="Carregando as informações e preferências do sistema."
        />
    )
}
