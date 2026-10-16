import { createDataContext } from '@/src/lib/api/createDataContext'
import { Order } from '@/src/types/order'

export const { Provider: PedidosProvider, useData: usePedidos } =
    createDataContext<Order>({ cacheKey: 'pedidos_v2_cache', endpoint: 'pedidos' })