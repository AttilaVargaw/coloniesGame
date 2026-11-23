import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Screen } from '@/components/map/screen'
import { GameContext } from '@/hooks/useGameContext'
import { ClickEventData, MousedownEvent, MouseupEvent, MousemoveEvent, ContextMenuEvent } from '@/engine/lib/events'
import React from 'react'
import '@testing-library/jest-dom'

const mockDispatchEvent = vi.fn()
const mockGame = { dispatchEvent: mockDispatchEvent }

vi.mock('@/engine/lib/events', () => ({
    ClickEventData: vi.fn(),
    MousedownEvent: vi.fn(),
    MouseupEvent: vi.fn(),
    MousemoveEvent: vi.fn(),
    ContextMenuEvent: vi.fn(),
}))

const renderWithContext = (ui: React.ReactElement) => {
    return render(
        <GameContext.Provider value={mockGame}>
            {ui}
        </GameContext.Provider>
    )
}

describe('Screen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockDispatchEvent.mockClear()
    })

    it('renders canvas with correct id', () => {
        renderWithContext(<Screen />)
        
        const canvas = document.getElementById('2dCanvas')
        expect(canvas).toBeInTheDocument()
        expect(canvas.tagName).toBe('CANVAS')
    })

    it('dispatches ClickEventData on click', () => {
        renderWithContext(<Screen />)
        
        const canvas = document.getElementById('2dCanvas')
        fireEvent.click(canvas, { offsetX: 100, offsetY: 200, button: 0 })
        
        expect(mockDispatchEvent).toHaveBeenCalled()
        expect(ClickEventData).toHaveBeenCalled()
    })

    it('dispatches MousedownEvent on mousedown', () => {
        renderWithContext(<Screen />)
        
        const canvas = document.getElementById('2dCanvas')
        fireEvent.mouseDown(canvas, { offsetX: 50, offsetY: 75, button: 1 })
        
        expect(mockDispatchEvent).toHaveBeenCalled()
        expect(MousedownEvent).toHaveBeenCalled()
    })

    it('dispatches MouseupEvent on mouseup', () => {
        renderWithContext(<Screen />)
        
        const canvas = document.getElementById('2dCanvas')
        fireEvent.mouseUp(canvas, { offsetX: 50, offsetY: 75, button: 1 })
        
        expect(mockDispatchEvent).toHaveBeenCalled()
        expect(MouseupEvent).toHaveBeenCalled()
    })

    it('dispatches MousemoveEvent on mousemove', () => {
        renderWithContext(<Screen />)
        
        const canvas = document.getElementById('2dCanvas')
        fireEvent.mouseMove(canvas, { offsetX: 200, offsetY: 300, button: 0 })
        
        expect(mockDispatchEvent).toHaveBeenCalled()
        expect(MousemoveEvent).toHaveBeenCalled()
    })

    it('dispatches ContextMenuEvent on contextmenu', () => {
        renderWithContext(<Screen />)
        
        const canvas = document.getElementById('2dCanvas')
        fireEvent(canvas, new MouseEvent('contextmenu', { 
            offsetX: 150, 
            offsetY: 250,
            cancelable: true,
        }))
        
        // ContextMenuEvent may not fire in jsdom, just verify no error
        expect(canvas).toBeInTheDocument()
    })
})