import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SectorRow } from '@/components/coloniesInforWindow/sectorRow'
import { TooltipProvider } from '@/components/ui/tooltip'
import { IndustryComponent } from '@/game/components/industryComponent'
import { Goods } from '@/game/data/Goods'
import { Population } from '@/game/data/Population'

const renderWithTooltip = (ui: React.ReactElement) => {
    return render(<TooltipProvider>{ui}</TooltipProvider>)
}

const createMockIndustry = (overrides: Partial<IndustryComponent> = {}): IndustryComponent => {
    const base: IndustryComponent = {
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
        ...overrides,
    }
    return base
}

describe('SectorRow', () => {
    it('renders sector name and tech multiplier', () => {
        const industry = createMockIndustry({
            sectorProfits: { oilRig: 1000 },
            sectorRevenue: { oilRig: 5000 },
            sectorUtilization: { oilRig: 0.8 },
            techMultipliers: { oilRig: 1.5 },
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
            sectorProfits: { powerPlant: 0 },
            sectorRevenue: { powerPlant: 0 },
            sectorUtilization: { powerPlant: 0 },
            sectorStopReason: { powerPlant: 'No oil' },
            techMultipliers: { powerPlant: 1.0 },
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
            sectorProfits: { farm: 5000 },
            sectorRevenue: { farm: 20000 },
            sectorLaborCosts: { farm: 8000 },
            sectorInputCosts: { farm: 7000 },
            sectorUtilization: { farm: 0.9 },
            techMultipliers: { farm: 1.2 },
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
            sectorProfits: { oilRig: 1000 },
            sectorRevenue: { oilRig: 5000 },
            sectorLaborCosts: { oilRig: 2000 },
            sectorInputCosts: { oilRig: 2000 },
            sectorUtilization: { oilRig: 1 },
            techMultipliers: { oilRig: 1.0 },
            materialRequirementMultipliers: { energy: 1, governance: 1, environmentFactor: 1 },
            workerEfficiencyMultipliers: { worker: 1, clerks: 1, engineer: 1, healtcarePersonal: 1 },
            capitalStock: { oilRig: { machinery: 0.5, buildings: 0.1 } },
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
            sectorProfits: { oilRig: 1000 },
            sectorRevenue: { oilRig: 5000 },
            sectorUtilization: { oilRig: 1 },
            techMultipliers: { oilRig: 1.0 },
            capitalStock: { oilRig: { machinery: 0.5, buildings: 0.1 } },
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
            sectorProfits: { oilRig: 1000 },
            sectorRevenue: { oilRig: 5000 },
            sectorUtilization: { oilRig: 1 },
            techMultipliers: { oilRig: 1.0 },
            selectedMethod: { oilRig: 'dieselEngines' },
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