import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RequirementItem } from '@/components/coloniesInforWindow/requirementItem'
import { TooltipProvider } from '@/components/ui/tooltip'

const renderWithTooltip = (ui: React.ReactElement) => {
    return render(<TooltipProvider>{ui}</TooltipProvider>)
}

describe('RequirementItem', () => {
    it('renders full/current/satisfied format for goods', () => {
        renderWithTooltip(<RequirementItem name="energy" fullCapacityReq={100} currentCapacityReq={80} satisfied={60} />)
        expect(screen.getByText('100')).toBeInTheDocument()
        expect(screen.getByText('80')).toBeInTheDocument()
        expect(screen.getByText('(60)')).toBeInTheDocument()
    })

    it('renders full/current/satisfied format for population', () => {
        renderWithTooltip(<RequirementItem name="worker" fullCapacityReq={500} currentCapacityReq={400} satisfied={350} />)
        expect(screen.getByText('500')).toBeInTheDocument()
        expect(screen.getByText('400')).toBeInTheDocument()
        expect(screen.getByText('(350)')).toBeInTheDocument()
    })

    it('renders money with hexagon icon', () => {
        const { container } = renderWithTooltip(<RequirementItem name="money" currentCapacityReq={1000} />)
        expect(screen.getByText('1000')).toBeInTheDocument()
        const svg = container.querySelector('svg')
        expect(svg).toBeInTheDocument()
    })

    it('shows "Stopped" when isStopped is true', () => {
        renderWithTooltip(<RequirementItem name="energy" fullCapacityReq={100} currentCapacityReq={0} satisfied={0} isStopped={true} />)
        expect(screen.getByText('Stopped')).toBeInTheDocument()
        expect(screen.queryByText('100')).not.toBeInTheDocument()
    })

    it('shows red color when satisfied < 99% of currentCapacityReq', () => {
        const { container } = renderWithTooltip(<RequirementItem name="energy" fullCapacityReq={100} currentCapacityReq={100} satisfied={50} />)
        const outerSpan = container.querySelector('.text-red-400')
        expect(outerSpan).toBeInTheDocument()
    })

    it('shows green color when satisfied >= 99% of currentCapacityReq', () => {
        const { container } = renderWithTooltip(<RequirementItem name="energy" fullCapacityReq={100} currentCapacityReq={100} satisfied={100} />)
        const outerSpan = container.querySelector('.text-green-400')
        expect(outerSpan).toBeInTheDocument()
    })

    it('handles missing satisfied value gracefully', () => {
        renderWithTooltip(<RequirementItem name="energy" fullCapacityReq={100} currentCapacityReq={80} />)
        expect(screen.getByText('100')).toBeInTheDocument()
        expect(screen.getByText('80')).toBeInTheDocument()
        expect(screen.queryByText('(')).not.toBeInTheDocument()
    })

    it('handles missing fullCapacityReq', () => {
        renderWithTooltip(<RequirementItem name="energy" currentCapacityReq={80} satisfied={60} />)
        expect(screen.getByText('80')).toBeInTheDocument()
        expect(screen.getByText('(60)')).toBeInTheDocument()
        expect(screen.queryByText('100')).not.toBeInTheDocument()
    })
})