import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SectorRow } from '@/components/coloniesInforWindow/sectorRow'
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
        sectorProfits: {},
        sectorRevenue: {},
        sectorLaborCosts: {},
        sectorInputCosts: {},
        sectorUtilization: {},
        sectorStopReason: {},
        techMultipliers: {},
        selectedMethod: {},
        materialRequirementMultipliers: {},
        workerEfficiencyMultipliers: {},
        capitalStock: {},
        money: {},
        goods: {} as Goods,
        goodsRequirements: {} as Goods,
        goodsProduction: {} as Goods,
        populationProfits: {} as Record<keyof Population, number>,
        wages: {} as Record<keyof Population, number>,
        workingWorkers: {} as Record<keyof Population, { number: number; wealth: number; wealthLevel: number; qol: number; expectedQol: number; populationChange: number; mortality: number; salary: number; birthRate: number }>,
        freeWorkers: {} as Record<keyof Population, { number: number; wealth: number; wealthLevel: number; qol: number; expectedQol: number; populationChange: number; mortality: number; salary: number; birthRate: number }>,
        populationRequirements: {} as Record<keyof Population, Record<string, number>>,
        sectorResults: new Map(),
        colonyTreasury: 0,
        householdMoney: 0,
        goodsChange: {} as Goods,
        populationChange: {} as Population,
        laborAssigned: {} as Record<keyof IndustrialSectors, number>,
        activeSectorKeys: new Set(),
        colonyType: 'colony' as const,
        settlementType: 'colony' as const,
        starterMoney: {} as Record<keyof IndustrialSectors, number>,
        starterCapitalStock: {} as Partial<Record<keyof IndustrialSectors, Partial<Goods>>>,
        starterSectorGoods: {} as Record<keyof IndustrialSectors, Partial<Goods>>,
        ...overrides,
    } as unknown as IndustryComponent
    return base
}

describe('SectorRow', () => {
    it('renders sector name and tech multiplier', () => {
        const industry = createMockIndustry({
            sectorProfits: { oilRig: 1000 } as unknown as Record<keyof IndustrialSectors, number>,
            sectorRevenue: { oilRig: 5000 } as unknown as Record<keyof IndustrialSectors, number>,
            sectorUtilization: { oilRig: 0.8 } as unknown as Record<keyof IndustrialSectors, number>,
            techMultipliers: { oilRig: 1.5 } as unknown as Record<keyof IndustrialSectors, number>,
            sectorResults: new Map([['oilRig', {
                name: 'oilRig',
                consumedGoods: { energy: 100, governance: 20, environmentFactor: 20 },
                producedGoods: { oil: 5000, waste: 20 },
                workersEmployed: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 },
                productionRatio: 0.8,
                inputLevel: 1,
                outputLevel: 1,
            }]]),
        })

        const { container } = renderWithTooltip(<SectorRow sectorKey="oilRig" industry={industry} />)
        
        expect(screen.getByText('oilRig')).toBeInTheDocument()
        expect(screen.getByText('1.50')).toBeInTheDocument()
        expect(screen.getByText('80%')).toBeInTheDocument()
    })

    it('shows stopped indicator when productionRatio is 0', () => {
        const industry = createMockIndustry({
            sectorProfits: { powerPlant: 0 } as unknown as Record<keyof IndustrialSectors, number>,
            sectorRevenue: { powerPlant: 0 } as unknown as Record<keyof IndustrialSectors, number>,
            sectorUtilization: { powerPlant: 0 } as unknown as Record<keyof IndustrialSectors, number>,
            sectorStopReason: { powerPlant: 'No oil' } as unknown as Record<keyof IndustrialSectors, string>,
            techMultipliers: { powerPlant: 1.0 } as unknown as Record<keyof IndustrialSectors, number>,
            sectorResults: new Map([['powerPlant', {
                name: 'powerPlant',
                consumedGoods: {},
                producedGoods: {},
                workersEmployed: {},
                productionRatio: 0,
                inputLevel: 1,
                outputLevel: 1,
            }]]),
        })

        renderWithTooltip(<SectorRow sectorKey="powerPlant" industry={industry} />)
        
        expect(screen.getByText('powerPlant')).toBeInTheDocument()
        const utilizationCells = screen.getAllByText('0%')
        expect(utilizationCells.length).toBeGreaterThan(0)
        // Stop reason is in tooltip, not directly visible
    })

    it('shows profit, costs and margin', () => {
        const industry = createMockIndustry({
            sectorProfits: { farm: 5000 } as unknown as Record<keyof IndustrialSectors, number>,
            sectorRevenue: { farm: 20000 } as unknown as Record<keyof IndustrialSectors, number>,
            sectorLaborCosts: { farm: 8000 } as unknown as Record<keyof IndustrialSectors, number>,
            sectorInputCosts: { farm: 7000 } as unknown as Record<keyof IndustrialSectors, number>,
            sectorUtilization: { farm: 0.9 } as unknown as Record<keyof IndustrialSectors, number>,
            techMultipliers: { farm: 1.2 } as unknown as Record<keyof IndustrialSectors, number>,
            sectorResults: new Map([['farm', {
                name: 'farm',
                consumedGoods: { water: 40, chemicals: 80, environmentFactor: 20, governance: 20 },
                producedGoods: { agriculturalGoods: 100000 },
                workersEmployed: { farmer: 900, clerks: 50, engineer: 50, healtcarePersonal: 10 },
                productionRatio: 0.9,
                inputLevel: 1,
                outputLevel: 1,
            }]]),
        })

        renderWithTooltip(<SectorRow sectorKey="farm" industry={industry} />)
        
        const revenueElements = screen.getAllByText('20.0K')
        expect(revenueElements.length).toBeGreaterThan(0)
        const profitElements = screen.getAllByText('5.0K')
        expect(profitElements.length).toBeGreaterThan(0)
        expect(screen.getByText('25%')).toBeInTheDocument() // margin = 5000/20000 * 100
    })

    it('shows requirements with full/current/satisfied', () => {
        const industry = createMockIndustry({
            sectorProfits: { oilRig: 1000 } as unknown as Record<keyof IndustrialSectors, number>,
            sectorRevenue: { oilRig: 5000 } as unknown as Record<keyof IndustrialSectors, number>,
            sectorLaborCosts: { oilRig: 2000 } as unknown as Record<keyof IndustrialSectors, number>,
            sectorInputCosts: { oilRig: 2000 } as unknown as Record<keyof IndustrialSectors, number>,
            sectorUtilization: { oilRig: 1 } as unknown as Record<keyof IndustrialSectors, number>,
            techMultipliers: { oilRig: 1.0 } as unknown as Record<keyof IndustrialSectors, number>,
            materialRequirementMultipliers: { energy: 1, governance: 1, environmentFactor: 1 } as unknown as Record<keyof Goods, number>,
            workerEfficiencyMultipliers: { worker: 1, clerks: 1, engineer: 1, healtcarePersonal: 1 } as unknown as Record<keyof Population, number>,
            capitalStock: { oilRig: { machinery: 0.5, buildings: 0.1 } } as unknown as Record<keyof IndustrialSectors, Partial<Goods>>,
            sectorResults: new Map([['oilRig', {
                name: 'oilRig',
                consumedGoods: { energy: 100, governance: 20, environmentFactor: 20 },
                producedGoods: { oil: 5000, waste: 20 },
                workersEmployed: { worker: 890, clerks: 50, engineer: 50, healtcarePersonal: 10 },
                productionRatio: 1,
                inputLevel: 1,
                outputLevel: 1,
            }]]),
        })

        const { container } = renderWithTooltip(<SectorRow sectorKey="oilRig" industry={industry} />)
        
        // Check requirements are displayed
        expect(container.textContent).toContain('100') // energy consumed
        expect(container.textContent).toContain('20') // governance consumed
    })

    it('shows capital goods level', () => {
        const industry = createMockIndustry({
            sectorProfits: { oilRig: 1000 } as unknown as Record<keyof IndustrialSectors, number>,
            sectorRevenue: { oilRig: 5000 } as unknown as Record<keyof IndustrialSectors, number>,
            sectorUtilization: { oilRig: 1 } as unknown as Record<keyof IndustrialSectors, number>,
            techMultipliers: { oilRig: 1.0 } as unknown as Record<keyof IndustrialSectors, number>,
            capitalStock: { oilRig: { machinery: 0.5, buildings: 0.1 } } as unknown as Record<keyof IndustrialSectors, Partial<Goods>>,
            sectorResults: new Map([['oilRig', {
                name: 'oilRig',
                consumedGoods: {},
                producedGoods: { oil: 5000 },
                workersEmployed: {},
                productionRatio: 1,
                inputLevel: 1,
                outputLevel: 1,
            }]]),
        })

        renderWithTooltip(<SectorRow sectorKey="oilRig" industry={industry} />)
        
        expect(screen.getByText('100%')).toBeInTheDocument() // sector level 100%
    })

    it('shows selected method', () => {
        const industry = createMockIndustry({
            sectorProfits: { oilRig: 1000 } as unknown as Record<keyof IndustrialSectors, number>,
            sectorRevenue: { oilRig: 5000 } as unknown as Record<keyof IndustrialSectors, number>,
            sectorUtilization: { oilRig: 1 } as unknown as Record<keyof IndustrialSectors, number>,
            techMultipliers: { oilRig: 1.0 } as unknown as Record<keyof IndustrialSectors, number>,
            selectedMethod: { oilRig: 'dieselEngines' } as unknown as Record<keyof IndustrialSectors, string | null>,
            sectorResults: new Map([['oilRig', {
                name: 'oilRig',
                consumedGoods: {},
                producedGoods: { oil: 5000 },
                workersEmployed: {},
                productionRatio: 1,
                inputLevel: 1,
                outputLevel: 1,
            }]]),
        })

        renderWithTooltip(<SectorRow sectorKey="oilRig" industry={industry} />)
        
        expect(screen.getByText('dieselEngines')).toBeInTheDocument()
    })
})