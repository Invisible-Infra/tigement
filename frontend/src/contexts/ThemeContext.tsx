import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type ThemeName = 'light' | 'classic' | 'dark' | 'terminal' | 'spectrum' | 'neon-light' | 'neon-dark' | 'ocean-light' | 'ocean-dark' | 'forest-light' | 'forest-dark' | 'ember-light' | 'ember-dark'

interface ThemeContextType {
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    const saved = localStorage.getItem('tigement_theme')
    return (saved as ThemeName) || 'light'
  })

  useEffect(() => {
    // Remove all theme classes
    document.documentElement.classList.remove('theme-light', 'theme-classic', 'theme-dark', 'theme-terminal', 'theme-spectrum', 'theme-neon-light', 'theme-neon-dark', 'theme-ocean-light', 'theme-ocean-dark', 'theme-forest-light', 'theme-forest-dark', 'theme-ember-light', 'theme-ember-dark')
    
    // Add current theme class
    document.documentElement.classList.add(`theme-${theme}`)
    
    // Save to localStorage
    localStorage.setItem('tigement_theme', theme)
  }, [theme])

  const setTheme = (newTheme: ThemeName) => {
    setThemeState(newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

