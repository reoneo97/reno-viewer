import { useTheme } from '../hooks/useTheme'
import type { Theme } from '../theme'
import { nextTheme } from '../theme'

const ICON: Record<Theme, string> = { dark: '🌙', light: '☀️', warm: '🏺' }
const NAME: Record<Theme, string> = { dark: 'Dark', light: 'Light', warm: 'Warm' }

export function ThemeToggle() {
  const [theme, cycle] = useTheme()
  const upcoming = nextTheme(theme)
  return (
    <button
      className="theme-toggle"
      onClick={cycle}
      aria-label={`Theme: ${NAME[theme]}. Switch to ${NAME[upcoming]}`}
      title={`${NAME[theme]} theme — click for ${NAME[upcoming]}`}
    >
      {ICON[theme]}
    </button>
  )
}
