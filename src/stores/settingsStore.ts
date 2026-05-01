import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings } from '@/types';

interface SettingsState extends Settings {
  apiKeyConfigured: boolean;
  setApiKey: (key: string) => void;
  setApiKeyConfigured: (configured: boolean) => void;
  setApiEndpoint: (endpoint: string) => void;
  setModel: (model: string) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  isConfigured: () => boolean;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Defaults
      apiKey: '',
      apiKeyConfigured: false,
      apiEndpoint: 'https://api.anthropic.com',
      model: 'claude-haiku-4-5-20251001',
      theme: 'dark' as const,
      sidebarCollapsed: false,

      setApiKey: (apiKey: string) =>
        set({ apiKey, apiKeyConfigured: apiKey.trim().length > 0 }),
      setApiKeyConfigured: (apiKeyConfigured: boolean) =>
        set({ apiKeyConfigured }),
      setApiEndpoint: (apiEndpoint: string) => set({ apiEndpoint }),
      setModel: (model: string) => set({ model }),
      setTheme: (theme: 'dark' | 'light') => set({ theme }),
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      setSidebarCollapsed: (sidebarCollapsed: boolean) =>
        set({ sidebarCollapsed }),
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      isConfigured: () => {
        const { apiKey, apiKeyConfigured } = get();
        return apiKeyConfigured || apiKey.trim().length > 0;
      },
    }),
    {
      name: 'code-agent-settings',
      // Do NOT persist apiKey to localStorage for security
      partialize: (state) => ({
        apiEndpoint: state.apiEndpoint,
        model: state.model,
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
);
