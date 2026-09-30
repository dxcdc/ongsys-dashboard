import { ApiParams, ApiResponse } from './types'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL!
const API_USERNAME = process.env.API_USERNAME!
const API_PASSWORD = process.env.API_PASSWORD!

if (!API_BASE_URL) throw new Error('❌ NEXT_PUBLIC_API_URL não configurada no .env.local')
if (!API_USERNAME) throw new Error('❌ API_USERNAME não configurada no .env.local')
if (!API_PASSWORD) throw new Error('❌ API_PASSWORD não configurada no .env.local')

console.log('🔧 Configuração da API:', {
    baseUrl: API_BASE_URL,
    username: API_USERNAME.substring(0, 5) + '...',
    hasPassword: !!API_PASSWORD
})

const TIMEOUT_MS = 120_000
const MAX_RETRIES = 3

function getAuthHeaders(): HeadersInit {
    const token = Buffer.from(`${API_USERNAME}:${API_PASSWORD}`).toString('base64')
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Basic ${token}`
    }
}

function buildUrl(endpoint: string, params: ApiParams): string {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            searchParams.append(key, String(value))
        }
    })
    const baseUrl = API_BASE_URL.replace(/\/$/, '')
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    const queryString = searchParams.toString()
    return `${baseUrl}${path}${queryString ? '?' + queryString : ''}`
}

async function fetchWithTimeout(url: string, headers: HeadersInit): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
        const response = await fetch(url, { headers, cache: 'no-store', signal: controller.signal })
        clearTimeout(timeoutId)
        return response
    } catch (error) {
        clearTimeout(timeoutId)
        throw error
    }
}

export async function apiGet<T>(
    endpoint: string,
    params: ApiParams = {},
    attempt = 1
): Promise<ApiResponse<T>> {
    const url = buildUrl(endpoint, params)
    const headers = getAuthHeaders()

    console.log(`🌐 GET ${url}${attempt > 1 ? ` (tentativa ${attempt})` : ''}`)

    try {
        const response = await fetchWithTimeout(url, headers)
        console.log(`📥 Status: ${response.status}`)

        if (!response.ok) {
            if (response.status === 524 || response.status === 504 || response.status === 502 || response.status === 503) {
                console.warn(`⚠️ Gateway timeout/error (${response.status}) em ${endpoint} página ${params.pageNumber}`)
                if (attempt < MAX_RETRIES) {
                    await new Promise(r => setTimeout(r, 1500 * attempt))
                    return apiGet<T>(endpoint, params, attempt + 1)
                }
                console.warn(`⚠️ Retornando resultado parcial para página ${params.pageNumber} devido a erro gateway ${response.status}`)
                return { data: [], totalPages: 1, currentPage: params.pageNumber || 1, totalItems: 0 }
            }
            const errorText = await response.text()
            throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`)
        }

        const data = await response.json()
        return {
            data: data.data || [],
            totalPages: Math.ceil((data.totalRecords || 0) / 100),
            currentPage: params.pageNumber || 1,
            totalItems: data.totalRecords || 0
        }
    } catch (error: any) {
        if (error.name === 'AbortError') {
            console.warn(`⚠️ Timeout (${TIMEOUT_MS / 1000}s): ${endpoint} página ${params.pageNumber}`)
            if (attempt < MAX_RETRIES) {
                console.log(`🔁 Retry ${attempt}/${MAX_RETRIES - 1}...`)
                await new Promise(r => setTimeout(r, 1500 * attempt))
                return apiGet<T>(endpoint, params, attempt + 1)
            }
            console.error(`❌ Página ${params.pageNumber} falhou após ${MAX_RETRIES} tentativas`)
            return { data: [], totalPages: 1, currentPage: params.pageNumber || 1, totalItems: 0 }
        }
        throw error
    }
}