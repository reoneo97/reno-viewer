import { useState } from 'react'
import { nextTheme, resolveInitialTheme, setTheme as persistTheme } from '../theme'
import type { Theme } from '../theme'

// Returns the current theme and a function that cycles to the next one
// (dark → light → warm → dark) while persisting the choice.
export function useTheme(): [Theme, () => void] {
  const [theme, setThemeState] = useState<Theme>(() => resolveInitialTheme())

  const cycle = () => {
    setThemeState((prev) => {
      const next = nextTheme(prev)
      persistTheme(next)
      return next
    })
  }

  return [theme, cycle]
}
