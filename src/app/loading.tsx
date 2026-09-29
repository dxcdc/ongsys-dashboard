import { LoadingScreen } from '@/src/components/ui/LoadingScreen'

export default function GlobalLoading() {
    return (
        <LoadingScreen
            variant="full"
            title="Carregando OngSys Dashboard..."
            description="Inicializando a aplicação e autenticação do sistema."
        />
    )
}
