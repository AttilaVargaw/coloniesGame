import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CircularContextMenu } from '@/components/ui/circularContextMenu'
import { TooltipProvider } from '@/components/ui/tooltip'
import { GameContext, useGameEngine } from '@/hooks/useGameContext'
import { ReactNode } from 'react'
import '@testing-library/jest-dom'

vi.mock('@/hooks/useGameContext', () => ({
    GameContext: vi.fn(({ children }: { children: ReactNode }) => <>{children}</>),
    useGameEngine: vi.fn(),
}))

vi.mock('@/hooks/useGameEvent', () => ({
    useGameEvent: vi.fn(),
}))

const renderWithTooltip = (ui: React.ReactElement) => {
    return render(<TooltipProvider>{ui}</TooltipProvider>)
}

describe('CircularContextMenu', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders null when not open', () => {
        renderWithTooltip(<CircularContextMenu />)
        
        expect(screen.queryByText('Test')).not.toBeInTheDocument()
    })

    it('does not render when no items', () => {
        renderWithTooltip(<CircularContextMenu />)
        
        // Menu is closed by default, should render nothing
        const menu = document.querySelector('.fixed.inset-0.z-50')
        expect(menu).not.toBeInTheDocument()
    })
})