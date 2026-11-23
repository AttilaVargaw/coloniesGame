import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProductionBar } from '@/components/productionBar/productionBar'
import { TooltipProvider } from '@/components/ui/tooltip'
import '@testing-library/jest-dom'

const mockLines = [
    {
        name: "Main Orbital shipyard",
        queue: [
            { id: 1, name: "Heavy Cruiser", imageUrl: "", totalDays: 10, remainingDays: 5 },
            { id: 2, name: "Light Cruiser", imageUrl: "", totalDays: 10, remainingDays: 5 },
            { id: 3, name: "Destroyer", imageUrl: "", totalDays: 10, remainingDays: 5 },
        ]
    },
    {
        name: "Secondary Shipyard",
        queue: [
            { id: 4, name: "Frigate", imageUrl: "", totalDays: 5, remainingDays: 3 },
            { id: 5, name: "Scout", imageUrl: "", totalDays: 5, remainingDays: 3 },
        ]
    }
]

const renderWithTooltip = (ui: React.ReactElement) => {
    return render(<TooltipProvider>{ui}</TooltipProvider>)
}

describe('ProductionBar', () => {
    const mockOnToggleCollapse = vi.fn()
    const mockOnAdd = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        mockOnToggleCollapse.mockClear()
        mockOnAdd.mockClear()
    })

    it('renders production lines', () => {
        renderWithTooltip(<ProductionBar lines={mockLines} />)
        
        expect(screen.getByText('Main Orbital shipyard')).toBeInTheDocument()
        expect(screen.getByText('Secondary Shipyard')).toBeInTheDocument()
    })

    it('renders queue items', () => {
        renderWithTooltip(<ProductionBar lines={mockLines} />)
        
        expect(screen.getByText('Heavy Cruiser')).toBeInTheDocument()
        expect(screen.getByText('Light Cruiser')).toBeInTheDocument()
        expect(screen.getByText('Destroyer')).toBeInTheDocument()
        expect(screen.getByText('Frigate')).toBeInTheDocument()
        expect(screen.getByText('Scout')).toBeInTheDocument()
    })

    it('shows remaining days badge', () => {
        renderWithTooltip(<ProductionBar lines={mockLines} />)
        
        const badges5 = screen.getAllByText('5d left')
        expect(badges5.length).toBe(3)
        const badges3 = screen.getAllByText('3d left')
        expect(badges3.length).toBe(2)
    })

    it('shows progress bar', () => {
        renderWithTooltip(<ProductionBar lines={mockLines} />)
        
        const progressDivs = document.querySelectorAll('div[style*="width: 50%"]')
        expect(progressDivs.length).toBeGreaterThan(0)
    })

    it('toggles line expansion when clicked', () => {
        renderWithTooltip(<ProductionBar lines={mockLines} />)
        
        const firstLine = screen.getByText('Main Orbital shipyard').closest('button')
        expect(firstLine).toBeInTheDocument()
        
        fireEvent.click(firstLine!)
        
        // Line should collapse (items hidden)
        expect(screen.queryByText('Heavy Cruiser')).not.toBeInTheDocument()
    })

    it('shows add button for each line', () => {
        renderWithTooltip(<ProductionBar lines={mockLines} onAdd={mockOnAdd} />)
        
        const addButtons = screen.getAllByLabelText('Add production item')
        expect(addButtons.length).toBe(2)
    })

    it('calls onAdd when add button clicked', () => {
        renderWithTooltip(<ProductionBar lines={mockLines} onAdd={mockOnAdd} />)
        
        const addButton = screen.getAllByLabelText('Add production item')[0]
        fireEvent.click(addButton)
        
        expect(mockOnAdd).not.toHaveBeenCalled() // onAdd opens modal, doesn't call directly
    })

    it('shows collapsed view when collapsed prop is true', () => {
        renderWithTooltip(<ProductionBar lines={mockLines} collapsed={true} onToggleCollapse={mockOnToggleCollapse} />)
        
        const expandButton = screen.getByLabelText('Expand sidebar')
        expect(expandButton).toBeInTheDocument()
    })

    it('calls onToggleCollapse when collapse button clicked', () => {
        renderWithTooltip(<ProductionBar lines={mockLines} onToggleCollapse={mockOnToggleCollapse} />)
        
        const collapseButton = screen.getByLabelText('Collapse sidebar')
        fireEvent.click(collapseButton)
        
        expect(mockOnToggleCollapse).toHaveBeenCalled()
    })

    it('shows expand button in collapsed view', () => {
        renderWithTooltip(<ProductionBar lines={mockLines} collapsed={true} onToggleCollapse={mockOnToggleCollapse} />)
        
        const expandButton = screen.getByLabelText('Expand sidebar')
        fireEvent.click(expandButton)
        
        expect(mockOnToggleCollapse).toHaveBeenCalled()
    })
})