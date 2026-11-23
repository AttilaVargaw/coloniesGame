import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Header } from '@/components/header/header'
import { TooltipProvider } from '@/components/ui/tooltip'
import { GameContext, useGameEngine } from '@/hooks/useGameContext'
import { ReactNode } from 'react'
import '@testing-library/jest-dom'

const mockAddCommand = vi.fn()
const mockGetEntityById = vi.fn()

vi.mock('@/hooks/useGameContext', () => ({
    GameContext: vi.fn(({ children }: { children: ReactNode }) => <>{children}</>),
    useGameEngine: vi.fn(),
}))

vi.mock('@/hooks/useGameDate', () => ({
    useGameDate: vi.fn(() => 1000),
}))

vi.mock('@/lib/colonialCalendar', () => ({
    ColonialDate: vi.fn(() => ({
        year: 2026,
        monthString: 'Jan',
        day: 15,
        hour: 10,
        minute: 30,
    })),
}))

vi.mock('@/engine/lib/SetTimeScaleCommand', () => ({
    SetTimeScaleCommand: vi.fn().mockImplementation(function(this: any, time: number) {
        this.type = 'SetTimeScaleCommand'
        this.time = time
    }),
}))

const renderWithProviders = (ui: React.ReactElement) => {
    return render(<TooltipProvider>{ui}</TooltipProvider>)
}

describe('Header', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAddCommand.mockClear()
        mockGetEntityById.mockClear()
        
        const mockEngineWithEntity = {
            addCommand: mockAddCommand,
            getEntityById: mockGetEntityById.mockResolvedValue({ id: 'Caprica' }),
        }
        
        ;(useGameEngine as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockEngineWithEntity)
    })

    it('renders speed buttons', () => {
        renderWithProviders(<Header />)
        
        expect(screen.getByRole('button', { name: '||' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '1x' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '10x' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '150x' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '500x' })).toBeInTheDocument()
    })

    it('shows pause button (||) for speed 0', () => {
        renderWithProviders(<Header />)
        
        const pauseButton = screen.getByRole('button', { name: '||' })
        expect(pauseButton).toBeInTheDocument()
    })

    it('displays game date', () => {
        renderWithProviders(<Header />)
        
        expect(screen.getByText('2026 Jan 15 10:30')).toBeInTheDocument()
    })

    it('calls engine.addCommand when speed button clicked', () => {
        renderWithProviders(<Header />)
        
        fireEvent.click(screen.getByRole('button', { name: '10x' }))
        
        expect(mockAddCommand).toHaveBeenCalled()
    })

    it('shows DebugModal', () => {
        renderWithProviders(<Header />)
        
        expect(screen.getByText('Debug')).toBeInTheDocument()
    })
})