import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => cleanup())

// Mock ResizeObserver (used by some UI libraries)
function MockResizeObserver(this: any) {
  this.observe = vi.fn()
  this.unobserve = vi.fn()
  this.disconnect = vi.fn()
}

global.ResizeObserver = MockResizeObserver as any

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock Worker for Vite's ?worker imports in tests
function MockWorker(this: any) {
  this.onmessage = null
  this.onerror = null
  this.postMessage = vi.fn((message) => {
    // Simulate async worker response for texture worker
    if (message?.type === "texture") {
      queueMicrotask(() => {
        if (this.onmessage) {
          this.onmessage({
            data: {
              type: "result",
              id: message.id,
              bitmap: { width: 128, height: 128 } as ImageBitmap,
            },
          } as MessageEvent)
        }
      })
    }
    // Handle industry tick worker messages
    if (message?.type === "tick") {
      queueMicrotask(() => {
        if (this.onmessage) {
          this.onmessage({
            data: {
              type: "result",
              patches: [],
            },
          } as MessageEvent)
        }
      })
    }
  })
  this.terminate = vi.fn()
  this.addEventListener = vi.fn()
  this.removeEventListener = vi.fn()
  this.dispatchEvent = vi.fn()
}

global.Worker = MockWorker as any