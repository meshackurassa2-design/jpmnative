import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useColorScheme as useNativeColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type Theme = 'light' | 'dark' | 'system'

type Colors = {
  background: string
  card: string
  text: string
  textDim: string
  border: string
  primary: string
  tabBar: string
  isDark: boolean
}

const lightColors: Colors = {
  background: '#fafafa',
  card: '#ffffff',
  text: '#18181b',
  textDim: '#71717a',
  border: '#e4e4e7',
  primary: '#2563eb',
  tabBar: '#ffffff',
  isDark: false,
}

const darkColors: Colors = {
  background: '#000000',
  card: '#000000',
  text: '#ffffff',
  textDim: '#a1a1aa',
  border: '#111111',
  primary: '#3b82f6',
  tabBar: '#000000',
  isDark: true,
}

type ThemeContextType = {
  theme: Theme
  colors: Colors
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  colors: darkColors,
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useNativeColorScheme()
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    AsyncStorage.getItem('theme').then(v => {
      if (v === 'light' || v === 'dark' || v === 'system') {
        setThemeState(v)
      } else {
        // Default to dark as requested
        setThemeState('dark')
        AsyncStorage.setItem('theme', 'dark')
      }
    })
  }, [])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    AsyncStorage.setItem('theme', newTheme)
  }

  const isDark = theme === 'dark' || (theme === 'system' && systemScheme === 'dark')
  const colors = isDark ? darkColors : lightColors

  return (
    <ThemeContext.Provider value={{ theme, colors, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
