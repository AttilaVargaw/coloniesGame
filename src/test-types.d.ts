import '@testing-library/jest-dom'
import { Assertion } from 'vitest'

declare module 'vitest' {
  interface Assertion<T> {
    toBeInTheDocument(): T
  }
}