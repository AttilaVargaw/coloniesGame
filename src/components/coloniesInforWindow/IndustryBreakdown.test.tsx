import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IndustryBreakdown } from '@/components/coloniesInforWindow/IndustryBreakdown'
import { TooltipProvider } from '@/components/ui/tooltip'
import { IndustryComponent } from '@/game/components/industryComponent'
import { Goods } from '@/game/data/Goods'
import { Population } from '@/game/data/Population'
import type { IndustrialSectors } from '@/game/components/Factories'

const renderWithTooltip = (ui: React.ReactElement) => {
    return render(<TooltipProvider>{ui}</TooltipProvider>)
}

const createMockIndustry = (overrides: Partial<IndustryComponent> = {}): IndustryComponent => {
    const base = {
        sectorProfits: { oilRig: 1000, farm: 5000, powerPlant: 0 } as unknown as Record<keyof IndustrialSectors, number>,
        sectorRevenue: { oilRig: 5000, farm: 20000, powerPlant: 0 } as unknown as Record<keyof IndustrialSectors, number>,
        sectorLaborCosts: { oilRig: 2000, farm: 8000, powerPlant: 0 } as unknown as Record<keyof IndustrialSectors, number>,
        sectorInputCosts: { oilRig: 2000, farm: 7000, powerPlant: 0 } as unknown as Record<keyof IndustrialSectors, number>,
        sectorUtilization: { oilRig: 1, farm: 0.9, powerPlant: 0 } as unknown as Record<keyof IndustrialSectors, number>,
        sectorStopReason: { powerPlant: 'No oil' } as unknown as Record<keyof IndustrialSectors, string>,
        techMultipliers: { oilRig: 1.0, farm: 1.2, powerPlant: 1.0 } as unknown as Record<keyof IndustrialSectors, number>,
        selectedMethod: { oilRig: 'dieselEngines', farm: 'traditional' } as unknown as Record<keyof IndustrialSectors, string | null>,
        materialRequirementMultipliers: { energy: 1, governance: 1, environmentFactor: 1, water: 1, chemicals: 1 } as unknown as Record<keyof Goods, number>,
        workerEfficiencyMultipliers: { worker: 1, clerks: 1, engineer: 1, healtcarePersonal: 1, farmer: 1 } as unknown as Record<keyof Population, number>,
        capitalStock: { oilRig: { machinery: 0.5, buildings: 0.1 }, farm: { machinery: 0.5, buildings: 0.1, vehicles: 1 } } as unknown as Record<keyof IndustrialSectors, Partial<Goods>>,
        money: { oilRig: 10000, farm: 20000, powerPlant: 0 } as unknown as Record<keyof IndustrialSectors, number>,
        goods: {} as Goods,
        goodsRequirements: {} as Goods,
        goodsProduction: {} as Goods,
        populationProfits: {} as Record<keyof Population, number>,
        wages: {} as Record<keyof Population, number>,
        workingWorkers: {} as Record<keyof Population, { number: number; wealth: number; wealthLevel: number; qol: number; expectedQol: number; populationChange: number; mortality: number; salary: number; birthRate: number }>,
        freeWorkers: {} as Record<keyof Population, { number: number; wealth: number; wealthLevel: number; qol: number; expectedQol: number; populationChange: number; mortality: number; salary: number; birthRate: number }>,
        populationRequirements: {} as Record<keyof Population, Record<string, number>>,
        sectorResults: new Map([
            ['oilRig', {
                name: 'oilRig',
                consumedGoods: { energy: 100, governance: 20, environmentFactor: 20 },
                producedGoods: { oil: 5000, waste: 20 },
                workersEmployed: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 },
                productionRatio: 1,
                inputLevel: 1,
                outputLevel: 1,
            }],
            ['farm', {
                name: 'farm',
                consumedGoods: { water: 40, chemicals: 80, environmentFactor: 20, governance: 20 },
                producedGoods: { agriculturalGoods: 100000 },
                workersEmployed: { farmer: 900, clerks: 50, engineer: 50, healtcarePersonal: 10 },
                productionRatio: 0.9,
                inputLevel: 1,
                outputLevel: 1,
            }],
            ['powerPlant', {
                name: 'powerPlant',
                consumedGoods: {},
                producedGoods: {},
                workersEmployed: {},
                productionRatio: 0,
                inputLevel: 1,
                outputLevel: 1,
            }],
        ]),
        colonyTreasury: 0,
        householdMoney: 0,
        goodsChange: {} as Goods,
        populationChange: {} as Population,
        laborAssigned: {} as Record<keyof IndustrialSectors, number>,
        activeSectorKeys: new Set(['oilRig', 'farm', 'powerPlant']),
        colonyType: 'colony' as const,
        settlementType: 'colony' as const,
        starterMoney: {} as Record<keyof IndustrialSectors, number>,
        starterCapitalStock: {} as Partial<Record<keyof IndustrialSectors, Partial<Goods>>>,
        starterSectorGoods: {} as Record<keyof IndustrialSectors, Partial<Goods>>,
        ...overrides,
    } as unknown as IndustryComponent
    return base
}

describe('IndustryBreakdown', () => {
    it('renders tab list with subsector categories', () => {
        const industry = createMockIndustry()
        renderWithTooltip(<IndustryBreakdown industry={industry} />)
        
        // Check tabs exist (they're buttons)
        expect(screen.getByRole('tab', { name: 'energy' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'rawMaterials' })).toBeInTheDocument()
    })

    it('renders sector table headers for active tab', () => {
        const industry = createMockIndustry()
        renderWithTooltip(<IndustryBreakdown industry={industry} />)
        
        // Energy tab is active by default
        expect(screen.getByText('Sector')).toBeInTheDocument()
        expect(screen.getByText('Tech Mult.')).toBeInTheDocument()
        expect(screen.getByText('Efficiency')).toBeInTheDocument()
        expect(screen.getByText('Level')).toBeInTheDocument()
        expect(screen.getByText('Profit')).toBeInTheDocument()
        expect(screen.getByText('Margin')).toBeInTheDocument()
        expect(screen.getByText('Method')).toBeInTheDocument()
        expect(screen.getByText('Capital goods')).toBeInTheDocument()
        expect(screen.getByText('Production')).toBeInTheDocument()
    })

    it('switches tabs when clicked', () => {
        const industry = createMockIndustry()
        renderWithTooltip(<IndustryBreakdown industry={industry} />)
        
        // Click rawMaterials tab
        screen.getByRole('tab', { name: 'rawMaterials' }).click()
        
        // Should still show table headers
        expect(screen.getByText('Sector')).toBeInTheDocument()
    })

    it('shows 0% utilization for stopped sectors in active tab', () => {
        const industry = createMockIndustry()
        renderWithTooltip(<IndustryBreakdown industry={industry} />)
        
        // Energy tab is active - powerPlant is stopped (0% utilization)
        const utilizationCells = screen.getAllByText('0%')
        expect(utilizationCells.length).toBeGreaterThan(0)
    })
})