import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

// Types
export type Theme = 'dark' | 'light' | 'auto';
export type Language = 'en' | 'fa' | 'ar' | 'tr';
export type Direction = 'ltr' | 'rtl';

export interface ThemeSettings {
  theme: Theme;
  language: Language;
  direction: Direction;
  primaryColor: string;
  fontSize: 'small' | 'medium' | 'large';
  density: 'compact' | 'comfortable' | 'spacious';
  reducedMotion: boolean;
  highContrast: boolean;
}

export interface ThemeState extends ThemeSettings {
  isRTL: boolean;
  isDark: boolean;
  resolvedTheme: 'dark' | 'light';
}

interface ThemeContextType extends ThemeState {
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
  setPrimaryColor: (color: string) => void;
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
  setDensity: (density: 'compact' | 'comfortable' | 'spacious') => void;
  toggleReducedMotion: () => void;
  toggleHighContrast: () => void;
  resetToDefaults: () => void;
}

// Default settings
const DEFAULT_SETTINGS: ThemeSettings = {
  theme: 'auto',
  language: 'en',
  direction: 'ltr',
  primaryColor: '#3B82F6', // blue-500
  fontSize: 'medium',
  density: 'comfortable',
  reducedMotion: false,
  highContrast: false
};

// CSS custom properties for themes
const CSS_VARIABLES = {
  colors: {
    light: {
      '--bg-primary': '#ffffff',
      '--bg-secondary': '#f8fafc',
      '--bg-tertiary': '#f1f5f9',
      '--text-primary': '#1e293b',
      '--text-secondary': '#64748b',
      '--text-tertiary': '#94a3b8',
      '--border-light': '#e2e8f0',
      '--border-medium': '#cbd5e1',
      '--accent-primary': '#3b82f6',
      '--accent-secondary': '#1d4ed8',
      '--success': '#10b981',
      '--warning': '#f59e0b',
      '--error': '#ef4444',
      '--info': '#06b6d4'
    },
    dark: {
      '--bg-primary': '#0f172a',
      '--bg-secondary': '#1e293b',
      '--bg-tertiary': '#334155',
      '--text-primary': '#f1f5f9',
      '--text-secondary': '#cbd5e1',
      '--text-tertiary': '#94a3b8',
      '--border-light': '#334155',
      '--border-medium': '#475569',
      '--accent-primary': '#60a5fa',
      '--accent-secondary': '#3b82f6',
      '--success': '#34d399',
      '--warning': '#fbbf24',
      '--error': '#f87171',
      '--info': '#22d3ee'
    }
  },
  spacing: {
    compact: {
      '--spacing-xs': '0.25rem',
      '--spacing-sm': '0.5rem',
      '--spacing-md': '0.75rem',
      '--spacing-lg': '1rem',
      '--spacing-xl': '1.5rem'
    },
    comfortable: {
      '--spacing-xs': '0.5rem',
      '--spacing-sm': '0.75rem',
      '--spacing-md': '1rem',
      '--spacing-lg': '1.5rem',
      '--spacing-xl': '2rem'
    },
    spacious: {
      '--spacing-xs': '0.75rem',
      '--spacing-sm': '1rem',
      '--spacing-md': '1.5rem',
      '--spacing-lg': '2rem',
      '--spacing-xl': '3rem'
    }
  },
  typography: {
    small: {
      '--text-xs': '0.75rem',
      '--text-sm': '0.875rem',
      '--text-base': '0.9rem',
      '--text-lg': '1rem',
      '--text-xl': '1.125rem'
    },
    medium: {
      '--text-xs': '0.75rem',
      '--text-sm': '0.875rem',
      '--text-base': '1rem',
      '--text-lg': '1.125rem',
      '--text-xl': '1.25rem'
    },
    large: {
      '--text-xs': '0.875rem',
      '--text-sm': '1rem',
      '--text-base': '1.125rem',
      '--text-lg': '1.25rem',
      '--text-xl': '1.5rem'
    }
  }
};

// Create context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Theme provider component
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_SETTINGS);
  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>('light');

  // Detect system theme
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Load saved settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = await invoke<Partial<ThemeSettings>>('load_theme_settings');
        setSettings(prev => ({ ...prev, ...savedSettings }));
      } catch (error) {
        console.error('Failed to load theme settings:', error);
      }
    };

    loadSettings();
  }, []);

  // Save settings when they change
  useEffect(() => {
    const saveSettings = async () => {
      try {
        await invoke('save_theme_settings', { settings });
      } catch (error) {
        console.error('Failed to save theme settings:', error);
      }
    };

    saveSettings();
  }, [settings]);

  // Apply CSS variables and classes
  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;
      const resolvedTheme = settings.theme === 'auto' ? systemTheme : settings.theme;
      
      // Apply color scheme
      const colorVars = CSS_VARIABLES.colors[resolvedTheme];
      Object.entries(colorVars).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });

      // Apply primary color
      root.style.setProperty('--color-primary', settings.primaryColor);

      // Apply spacing
      const spacingVars = CSS_VARIABLES.spacing[settings.density];
      Object.entries(spacingVars).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });

      // Apply typography
      const typographyVars = CSS_VARIABLES.typography[settings.fontSize];
      Object.entries(typographyVars).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });

      // Apply reduced motion
      if (settings.reducedMotion) {
        root.style.setProperty('--animation-duration', '0.1s');
      } else {
        root.style.setProperty('--animation-duration', '0.3s');
      }

      // Apply high contrast
      if (settings.highContrast) {
        root.classList.add('high-contrast');
      } else {
        root.classList.remove('high-contrast');
      }

      // Set data attributes for CSS selectors
      root.setAttribute('data-theme', resolvedTheme);
      root.setAttribute('data-direction', settings.direction);
      root.setAttribute('data-density', settings.density);
    };

    applyTheme();
  }, [settings, systemTheme]);

  // Calculate derived state
  const themeState: ThemeState = {
    ...settings,
    isRTL: settings.direction === 'rtl',
    isDark: (settings.theme === 'auto' ? systemTheme : settings.theme) === 'dark',
    resolvedTheme: settings.theme === 'auto' ? systemTheme : settings.theme
  };

    // Theme actions
    const toggleTheme = useCallback(() => {
      setSettings(prev => {
        const themes: Theme[] = ['light', 'dark', 'auto'];
        const currentIndex = themes.indexOf(prev.theme);
        const nextIndex = (currentIndex + 1) % themes.length;
        return { ...prev, theme: themes[nextIndex] };
      });
    }, []);
  
    const setTheme = useCallback((theme: Theme) => {
      setSettings(prev => ({ ...prev, theme }));
    }, []);
  
    const setLanguage = useCallback((language: Language) => {
      const direction = language === 'fa' || language === 'ar' ? 'rtl' : 'ltr';
      setSettings(prev => ({ ...prev, language, direction }));
    }, []);
  
    const setPrimaryColor = useCallback((primaryColor: string) => {
      setSettings(prev => ({ ...prev, primaryColor }));
    }, []);
  
    const setFontSize = useCallback((fontSize: 'small' | 'medium' | 'large') => {
      setSettings(prev => ({ ...prev, fontSize }));
    }, []);
  
    const setDensity = useCallback((density: 'compact' | 'comfortable' | 'spacious') => {
      setSettings(prev => ({ ...prev, density }));
    }, []);
  
    const toggleReducedMotion = useCallback(() => {
      setSettings(prev => ({ ...prev, reducedMotion: !prev.reducedMotion }));
    }, []);
  
    const toggleHighContrast = useCallback(() => {
      setSettings(prev => ({ ...prev, highContrast: !prev.highContrast }));
    }, []);
  
    const resetToDefaults = useCallback(() => {
      setSettings(DEFAULT_SETTINGS);
    }, []);
  
    // Context value
    const contextValue: ThemeContextType = {
      ...themeState,
      toggleTheme,
      setTheme,
      setLanguage,
      setPrimaryColor,
      setFontSize,
      setDensity,
      toggleReducedMotion,
      toggleHighContrast,
      resetToDefaults
    };
  
    return (
      <ThemeContext.Provider value={contextValue}>
        {children}
      </ThemeContext.Provider>
    );
  };
  
  // Custom hook to use theme context
  export const useTheme = (): ThemeContextType => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
      throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
  };
  
  // Helper hooks for specific theme properties
  export const useThemeColors = () => {
    const { resolvedTheme, primaryColor } = useTheme();
    return {
      isDark: resolvedTheme === 'dark',
      primaryColor,
      getColor: (colorName: keyof typeof CSS_VARIABLES.colors.light) => {
        return CSS_VARIABLES.colors[resolvedTheme][colorName];
      }
    };
  };
  
  export const useThemeSpacing = () => {
    const { density } = useTheme();
    return CSS_VARIABLES.spacing[density];
  };
  
  export const useThemeTypography = () => {
    const { fontSize } = useTheme();
    return CSS_VARIABLES.typography[fontSize];
  };
  
  // Direction hook for RTL/LTR aware components
  export const useDirection = () => {
    const { isRTL, direction } = useTheme();
    
    return {
      isRTL,
      direction,
      // For margin and padding utilities
      marginStart: isRTL ? 'marginRight' : 'marginLeft',
      marginEnd: isRTL ? 'marginLeft' : 'marginRight',
      paddingStart: isRTL ? 'paddingRight' : 'paddingLeft',
      paddingEnd: isRTL ? 'paddingLeft' : 'paddingRight',
      borderStart: isRTL ? 'borderRight' : 'borderLeft',
      borderEnd: isRTL ? 'borderLeft' : 'borderRight',
      // For flexbox utilities
      start: isRTL ? 'flex-end' : 'flex-start',
      end: isRTL ? 'flex-start' : 'flex-end',
      // For transform utilities
      rotate: isRTL ? 'rotateY(180deg)' : 'none'
    };
  };
  
  // Export for tests
  export { DEFAULT_SETTINGS, CSS_VARIABLES };