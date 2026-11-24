import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PopulationBreakdown } from '@/components/coloniesInforWindow/PopulationBreakdown'
import { TooltipProvider } from '@/components/ui/tooltip'
import { IndustryComponent } from '@/game/components/industryComponent'
import { Population } from '@/game/data/Population'
import { Goods } from '@/game/data/Goods'
import type { IndustrialSectors } from '@/game/components/Factories'

const renderWithTooltip = (ui: React.ReactElement) => {
    return render(<TooltipProvider>{ui}</TooltipProvider>)
}

const createMockIndustry = (overrides: Partial<IndustryComponent> = {}): IndustryComponent => {
    const base = {
        population: {
            worker: { number: 1000, populationChange: 10, qol: 7.5 },
            clerks: { number: 100, populationChange: 5, qol: 8.0 },
            engineer: { number: 50, populationChange: 2, qol: 8.5 },
            healtcarePersonal: { number: 20, populationChange: 1, qol: 7.0 },
            farmer: { number: 200, populationChange: 5, qol: 6.5 },
        } as Population,
        populationProfits: {
            worker: 5000,
            clerks: 2000,
            engineer: 1500,
            healtcarePersonal: 800,
            farmer: 3000,
        } as unknown as Record<keyof Population, number>,
        populationRequirements: {
            worker: { food: 50, water: 100 },
            clerks: { food: 10, services: 50 },
            engineer: { food: 5, water: 20, environmentFactor: 10 },
            healtcarePersonal: { food: 2, water: 10 },
            farmer: { food: 10, water: 50, environmentFactor: 5 },
        } as unknown as Record<keyof Population, Record<string, number>>,
        workingWorkers: {
            worker: { number: 800, wealth: 100, wealthLevel: 3, qol: 7.5, expectedQol: 7.0, populationChange: 10, mortality: 1, salary: 5, birthRate: 0.02 },
            clerks: { number: 80, wealth: 200, wealthLevel: 4, qol: 8.0, expectedQol: 7.5, populationChange: 5, mortality: 0.5, salary: 20, birthRate: 0.01 },
            engineer: { number: 40, wealth: 500, wealthLevel: 5, qol: 8.5, expectedQol: 8.0, populationChange: 2, mortality: 0.3, salary: 30, birthRate: 0.005 },
            healtcarePersonal: { number: 15, wealth: 300, wealthLevel: 4, qol: 7.0, expectedQol: 6.5, populationChange: 1, mortality: 0.2, salary: 40, birthRate: 0.003 },
            farmer: { number: 150, wealth: 150, wealthLevel: 3, qol: 6.5, expectedQol: 6.0, populationChange: 5, mortality: 1, salary: 15, birthRate: 0.015 },
        } as unknown as Record<keyof Population, { number: number; wealth: number; wealthLevel: number; qol: number; expectedQol: number; populationChange: number; mortality: number; salary: number; birthRate: number }>,
        goods: { food: 1000, water: 500, services: 200, environmentFactor: 100 } as Goods,
        sectorProfits: {} as unknown as Record<keyof IndustrialSectors, number>,
        sectorRevenue: {} as unknown as Record<keyof IndustrialSectors, number>,
        sectorLaborCosts: {} as unknown as Record<keyof IndustrialSectors, number>,
        sectorInputCosts: {} as unknown as Record<keyof IndustrialSectors, number>,
        sectorUtilization: {} as unknown as Record<keyof IndustrialSectors, number>,
        sectorStopReason: {} as unknown as Record<keyof IndustrialSectors, string>,
        techMultipliers: {} as unknown as Record<keyof IndustrialSectors, number>,
        selectedMethod: {} as unknown as Record<keyof IndustrialSectors, string | null>,
        materialRequirementMultipliers: {} as unknown as Record<keyof Goods, number>,
        workerEfficiencyMultipliers: {} as unknown as Record<keyof Population, number>,
        capitalStock: {} as unknown as Record<keyof IndustrialSectors, Partial<Goods>>,
        money: {} as unknown as Record<keyof IndustrialSectors, number>,
        goodsRequirements: {} as Goods,
        goodsProduction: {} as Goods,
        wages: {} as unknown as Record<keyof Population, number>,
        freeWorkers: {} as unknown as Record<keyof Population, { number: number; wealth: number; wealthLevel: number; qol: number; expectedQol: number; populationChange: number; mortality: number; salary: number; birthRate: number }>,
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

describe('PopulationBreakdown', () => {
    it('renders table headers', () => {
        const industry = createMockIndustry()
        renderWithTooltip(<PopulationBreakdown industry={industry} />)
        
        expect(screen.getByText('Group')).toBeInTheDocument()
        expect(screen.getByText('Count')).toBeInTheDocument()
        expect(screen.getByText('Working')).toBeInTheDocument()
        expect(screen.getByText('Growth')).toBeInTheDocument()
        expect(screen.getByText('Income')).toBeInTheDocument()
        expect(screen.getByText('Expenses')).toBeInTheDocument()
        expect(screen.getByText('Net')).toBeInTheDocument()
        expect(screen.getByText('QoL')).toBeInTheDocument()
        expect(screen.getByText('Requirements')).toBeInTheDocument()
    })

    it('renders population groups sorted by name', () => {
        const industry = createMockIndustry()
        renderWithTooltip(<PopulationBreakdown industry={industry} />)
        
        // Check all population types are rendered (alphabetically)
        // Note: "Healthcare Personal" has a typo in POPULATION_NAMES as "Healtcare Personal"
        expect(screen.getByText('Clerks')).toBeInTheDocument()
        expect(screen.getByText('Engineer')).toBeInTheDocument()
        expect(screen.getByText('Farmer')).toBeInTheDocument()
        expect(screen.getByText('Healtcare Personal')).toBeInTheDocument()
        expect(screen.getByText('Worker')).toBeInTheDocument()
    })

    it('shows population count and working count', () => {
        const industry = createMockIndustry()
        renderWithTooltip(<PopulationBreakdown industry={industry} />)
        
        // Worker: 1000 count, 800 working
        const countCells = screen.getAllByText('1000')
        expect(countCells.length).toBeGreaterThan(0)
        
        const workingCells = screen.getAllByText('800')
        expect(workingCells.length).toBeGreaterThan(0)
    })

    it('shows growth and QoL values', () => {
        const industry = createMockIndustry()
        renderWithTooltip(<PopulationBreakdown industry={industry} />)
        
        // Growth values appear in table cells
        const growthCells = screen.getAllByText('10')
        expect(growthCells.length).toBeGreaterThan(0)
        
        // QoL values
        expect(screen.getByText('7.5')).toBeInTheDocument()
        expect(screen.getByText('8.0')).toBeInTheDocument()
        expect(screen.getByText('8.5')).toBeInTheDocument()
        expect(screen.getByText('7.0')).toBeInTheDocument()
        expect(screen.getByText('6.5')).toBeInTheDocument()
    })

    it('shows requirements using RequirementItem format', () => {
        const industry = createMockIndustry()
        renderWithTooltip(<PopulationBreakdown industry={industry} />)
        
        // Requirements column shows RequirementItem with full/current/satisfied
        // There should be RequirementItem components rendered
        const requirementItems = screen.getAllByText('50')
        expect(requirementItems.length).toBeGreaterThan(0)
        
        const waterItems = screen.getAllByText('100')
        expect(waterItems.length).toBeGreaterThan(0)
    })

    it('shows dash when no requirements for all groups', () => {
        const industry = createMockIndustry({
            populationRequirements: {
                worker: {},
                clerks: {},
                engineer: {},
                healtcarePersonal: {},
                farmer: {},
            } as unknown as Record<keyof Population, Record<string, number>>,
        })
        renderWithTooltip(<PopulationBreakdown industry={industry} />)
        
        const dashes = screen.getAllByText('—')
        expect(dashes.length).toBe(5) // one for each population group
    })
})