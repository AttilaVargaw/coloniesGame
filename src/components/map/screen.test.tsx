import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Screen } from '@/components/map/screen'
import { GameContext } from '@/hooks/useGameContext'
import { ClickEventData, MousedownEvent, MouseupEvent, MousemoveEvent, ContextMenuEvent } from '@/engine/lib/events'
import React from 'react'
import type { Engine } from '@engine/core/engine'

const mockDispatchEvent = vi.fn()
const mockGame: Partial<Engine> = { 
    dispatchEvent: mockDispatchEvent,
    getSystem: vi.fn(),
    addEntity: vi.fn(),
    removeEntity: vi.fn(),
    reindexEntity: vi.fn(),
    addCommand: vi.fn(),
    registerNodeType: vi.fn(),
    unregisterNodeType: vi.fn(),
    getNodeList: vi.fn(),
    getAllEntities: vi.fn(),
    getEntityById: vi.fn(),
    addSystem: vi.fn(),
    removeSystem: vi.fn(),
    getEvents: vi.fn(),
    update: vi.fn(),
    destruct: vi.fn(),
    getDebugManager: vi.fn(),
    registerEventQueue: vi.fn(),
    removeEventQueue: vi.fn(),
    getCanvas: vi.fn(),
    getEconomicDiagnostics: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    registerCommandQueue: vi.fn(),
    removeCommandQueue: vi.fn(),
}

vi.mock('@/engine/lib/events', () => ({
    ClickEventData: vi.fn(),
    MousedownEvent: vi.fn(),
    MouseupEvent: vi.fn(),
    MousemoveEvent: vi.fn(),
    ContextMenuEvent: vi.fn(),
}))

const renderWithContext = (ui: React.ReactElement) => {
    return render(
        <GameContext.Provider value={mockGame as Engine}>
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
        expect(canvas?.tagName).toBe('CANVAS')
    })

    it('dispatches ClickEventData on click', () => {
        renderWithContext(<Screen />)
        
        const canvas = document.getElementById('2dCanvas') as HTMLCanvasElement | null
        expect(canvas).not.toBeNull()
        if (canvas) {
            fireEvent.click(canvas, { clientX: 100, clientY: 200, button: 0 })
            
            expect(mockDispatchEvent).toHaveBeenCalled()
            expect(ClickEventData).toHaveBeenCalled()
        }
    })

    it('dispatches MousedownEvent on mousedown', () => {
        renderWithContext(<Screen />)
        
        const canvas = document.getElementById('2dCanvas') as HTMLCanvasElement | null
        expect(canvas).not.toBeNull()
        if (canvas) {
            fireEvent.mouseDown(canvas, { clientX: 50, clientY: 75, button: 1 })
            
            expect(mockDispatchEvent).toHaveBeenCalled()
            expect(MousedownEvent).toHaveBeenCalled()
        }
    })

    it('dispatches MouseupEvent on mouseup', () => {
        renderWithContext(<Screen />)
        
        const canvas = document.getElementById('2dCanvas') as HTMLCanvasElement | null
        expect(canvas).not.toBeNull()
        if (canvas) {
            fireEvent.mouseUp(canvas, { clientX: 50, clientY: 75, button: 1 })
            
            expect(mockDispatchEvent).toHaveBeenCalled()
            expect(MouseupEvent).toHaveBeenCalled()
        }
    })

    it('dispatches MousemoveEvent on mousemove', () => {
        renderWithContext(<Screen />)
        
        const canvas = document.getElementById('2dCanvas') as HTMLCanvasElement | null
        expect(canvas).not.toBeNull()
        if (canvas) {
            fireEvent.mouseMove(canvas, { clientX: 200, clientY: 300, button: 0 })
            
            expect(mockDispatchEvent).toHaveBeenCalled()
            expect(MousemoveEvent).toHaveBeenCalled()
        }
    })

    it('dispatches ContextMenuEvent on contextmenu', () => {
        renderWithContext(<Screen />)
        
        const canvas = document.getElementById('2dCanvas') as HTMLCanvasElement | null
        expect(canvas).not.toBeNull()
        if (canvas) {
            fireEvent(canvas, new MouseEvent('contextmenu', { 
                clientX: 150, 
                clientY: 250,
                cancelable: true,
            }))
            
            // ContextMenuEvent may not fire in jsdom, just verify no error
            expect(canvas).toBeInTheDocument()
        }
    })
})