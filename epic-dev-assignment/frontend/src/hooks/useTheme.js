import { useState, useEffect } from 'react';

// Immediately ensure correct class on HTML element before React renders
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('theme');
  if (stored !== 'dark' || !localStorage.getItem('theme-user-chosen')) {
    document.documentElement.classList.remove('dark');
    if (stored === 'dark' && !localStorage.getItem('theme-user-chosen')) {
      localStorage.removeItem('theme');
    }
  }
}

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    localStorage.setItem('theme-user-chosen', 'true');
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  };

  return { theme, toggleTheme, isDark: theme === 'dark' };
}
