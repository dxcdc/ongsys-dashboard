// ongsys-dashboard/src/lib/cost-centers-map.ts
export const costCentersMap: Record<string, string> = {
    '1.01.01.001': 'INSTITUCIONAL',
    '3.01.02.001': 'CAB ATITUDE II.I - CUSTO INDIRETOS',
    '3.02.02.001': 'CAR ATITUDE II.I - CUSTO INDIRETOS',
    '3.03.02.001': 'JAB ATITUDE II.I - CUSTO INDIRETOS',
    '3.04.02.001': 'REC ATITUDE II.I - CUSTO INDIRETOS',
    '3.01.01.001': 'CAB ATITUDE II.I - DESPESAS DIRETAS - ANT',
    '3.01.01.002': 'CAB ATITUDE II.I - DESPESAS DIRETAS - BREVE',
    '3.01.01.003': 'CAB ATITUDE II.I - DESPESAS DIRETAS - INT',
    '3.01.01.004': 'CAB ATITUDE II.I - DESPESAS DIRETAS',
    '3.02.01.001': 'CAR ATITUDE II.I - DESPESAS DIRETAS - ANT',
    '3.02.01.002': 'CAR ATITUDE II.I - DESPESAS DIRETAS - BREVE',
    '3.02.01.003': 'CAR ATITUDE II.I - DESPESAS DIRETAS - INT',
    '3.02.01.004': 'CAR ATITUDE II.I - DESPESAS DIRETAS',
    '3.03.01.001': 'JAB ATITUDE II.I - DESPESAS DIRETAS - ANT',
    '3.03.01.002': 'JAB ATITUDE II.I - DESPESAS DIRETAS - BREVE',
    '3.03.01.003': 'JAB ATITUDE II.I - DESPESAS DIRETAS - INT',
    '3.03.01.004': 'JAB ATITUDE II.I - DESPESAS DIRETAS',
    '3.04.01.001': 'REC ATITUDE II.I - DESPESAS DIRETAS - ANT',
    '3.04.01.002': 'REC ATITUDE II.I - DESPESAS DIRETAS - BREVE',
    '3.04.01.003': 'REC ATITUDE II.I - DESPESAS DIRETAS - INT',
    '3.04.01.004': 'REC ATITUDE II.I - DESPESAS DIRETAS',
    '1.02.01.001': 'INSTITUCIONAL - DESPESAS DIRETAS',
    '2.06.01.001': 'PROVITA II - RH',
    '2.06.01.003': 'PROVITA II - ESTRUT. OPER.',
    '2.07.01.001': 'PPCAAM II - RH',
    '2.07.01.004': 'PPCAAM II - ESTRUT. OPER.',
    '2.08.01.003': 'BEM VIVER OLINDA - DESPESA DIRETA',
    '2.09.01.001': 'ATM II - DESPESAS DIRETAS',
    '2.11.01.001': 'PPVIDA - DESPESAS DIRETAS',
    '2.11.01.002': 'PPVIDA - CUSTOS INDIRETOS',
    '2.17.01.001': 'CAIS OLINDA - DESPESA DIRETA',
    '2.18.01.001': 'TRANSFORMACAO DIGITAL - DESPESA DIRETA',
    '2.13.01.001': 'CAB ATITUDE II.I - DESPESAS DIRETAS - ANT',
    '2.13.01.002': 'CAB ATITUDE II.I - DESPESAS DIRETAS - BREVE',
    '2.13.01.003': 'CAB ATITUDE II.I - DESPESAS DIRETAS - INT',
    '2.13.01.004': 'CAB ATITUDE II.I - CUSTO INDIRETOS',
    '2.13.01.006': 'CAB ATITUDE II.I - DESPESAS DIRETAS',
    '2.13.02.001': 'CAR ATITUDE II.I - DESPESAS DIRETAS - ANT',
    '2.13.02.002': 'CAR ATITUDE II.I - DESPESAS DIRETAS - BREVE',
    '2.13.02.003': 'CAR ATITUDE II.I - DESPESAS DIRETAS - INT',
    '2.13.02.004': 'CAR ATITUDE II.I - CUSTO INDIRETOS',
    '2.13.02.006': 'CAR ATITUDE II.I - DESPESAS DIRETAS',
    '2.13.03.001': 'JAB ATITUDE II.I - DESPESAS DIRETAS - ANT',
    '2.13.03.002': 'JAB ATITUDE II.I - DESPESAS DIRETAS - BREVE',
    '2.13.03.003': 'JAB ATITUDE II.I - DESPESAS DIRETAS - INT',
    '2.13.03.004': 'JAB ATITUDE II.I - CUSTO INDIRETOS',
    '2.13.03.006': 'JAB ATITUDE II.I - DESPESAS DIRETAS',
    '2.13.04.001': 'REC ATITUDE II.I - DESPESAS DIRETAS - ANT',
    '2.13.04.002': 'REC ATITUDE II.I - DESPESAS DIRETAS - BREVE',
    '2.13.04.003': 'REC ATITUDE II.I - DESPESAS DIRETAS - INT',
    '2.13.04.004': 'REC ATITUDE II.I - CUSTO INDIRETOS',
    '2.13.04.006': 'REC ATITUDE II.I - DESPESAS DIRETAS',
}

// Mapeamento dos códigos antigos (2.13) para os códigos oficiais atuais (3.0x)
export const costCenterAliases: Record<string, string> = {
    '2.13.01.001': '3.01.01.001',
    '2.13.01.002': '3.01.01.002',
    '2.13.01.003': '3.01.01.003',
    '2.13.01.004': '3.01.02.001',
    '2.13.01.006': '3.01.01.004',
    '2.13.02.001': '3.02.01.001',
    '2.13.02.002': '3.02.01.002',
    '2.13.02.003': '3.02.01.003',
    '2.13.02.004': '3.02.02.001',
    '2.13.02.006': '3.02.01.004',
    '2.13.03.001': '3.03.01.001',
    '2.13.03.002': '3.03.01.002',
    '2.13.03.003': '3.03.01.003',
    '2.13.03.004': '3.03.02.001',
    '2.13.03.006': '3.03.01.004',
    '2.13.04.001': '3.04.01.001',
    '2.13.04.002': '3.04.01.002',
    '2.13.04.003': '3.04.01.003',
    '2.13.04.004': '3.04.02.001',
    '2.13.04.006': '3.04.01.004',
}

// Retorna o código canônico oficial do centro de custo
export function getCanonicalCostCenterCode(code: string): string {
    return costCenterAliases[code] || code
}

// Retorna todos os códigos equivalentes (canônico + aliases legados)
export function getAllEquivalentCostCenterCodes(code: string): string[] {
    const canonical = getCanonicalCostCenterCode(code)
    const aliases = Object.entries(costCenterAliases)
        .filter(([_, can]) => can === canonical)
        .map(([oldCode]) => oldCode)
    return Array.from(new Set([canonical, code, ...aliases]))
}

// Função auxiliar para obter o nome formatado
export function getCostCenterName(code: string): string {
    const canonical = getCanonicalCostCenterCode(code)
    return costCentersMap[canonical] || costCentersMap[code] || code
}

// Lista de centros de custo para o select (unificada, sem códigos legados duplicados)
export const costCentersList = Object.entries(costCentersMap)
    .filter(([code]) => !costCenterAliases[code])
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name))

// Função para verificar se um centro é do tipo ATITUDE
export function isAtitudeCenter(code: string): boolean {
    const name = getCostCenterName(code)
    return name.toUpperCase().includes('ATITUDE')
}

// Função para filtrar apenas centros ATITUDE
export function getAtitudeOnlyCostCenters(): { code: string; name: string }[] {
    return costCentersList.filter(center => center.name.toUpperCase().includes('ATITUDE'))
}