import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createDefaultProviders, getProvider } from '@/config/providers';
import type {
  ProviderApiKeyConfiguredMap,
  ProviderId,
  ProviderSettings,
  Settings,
} from '@/types';

interface SettingsState extends Settings {
  apiKeyConfigured: ProviderApiKeyConfiguredMap;
  activeProviderSettings: ProviderSettings;
  activeProviderDefinition: ReturnType<typeof getProvider>;
  setApiKey: (key: string) => void;
  setApiKeyConfigured: (providerId: ProviderId, configured: boolean) => void;
  setActiveProvider: (providerId: ProviderId) => void;
  setProviderSettings: (providerId: ProviderId, settings: Partial<ProviderSettings>) => void;
  setApiEndpoint: (endpoint: string) => void;
  setModel: (model: string) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  isConfigured: () => boolean;
}

const defaultProviders = createDefaultProviders();
const defaultApiKeyConfigured: ProviderApiKeyConfiguredMap = {
  anthropic: false,
  deepseek: false,
  openai: false,
};

function activeSettings(state: Pick<SettingsState, 'activeProviderId' | 'providers'>) {
  return state.providers[state.activeProviderId] ?? createDefaultProviders()[state.activeProviderId];
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      activeProviderId: 'anthropic',
      providers: defaultProviders,
      apiKeyConfigured: defaultApiKeyConfigured,
      activeProviderSettings: defaultProviders.anthropic,
      activeProviderDefinition: getProvider('anthropic'),
      theme: 'dark' as const,
      sidebarCollapsed: false,

      setApiKey: (apiKey: string) =>
        get().setProviderSettings(get().activeProviderId, { apiKey }),
      setApiKeyConfigured: (providerId: ProviderId, configured: boolean) =>
        set((state) => ({
          apiKeyConfigured: { ...state.apiKeyConfigured, [providerId]: configured },
        })),
      setActiveProvider: (activeProviderId: ProviderId) =>
        set((state) => {
          const providers = {
            ...createDefaultProviders(),
            ...state.providers,
          };
          const activeProviderSettings =
            providers[activeProviderId] ?? createDefaultProviders()[activeProviderId];
          return {
            activeProviderId,
            providers,
            activeProviderSettings,
            activeProviderDefinition: getProvider(activeProviderId),
          };
        }),
      setProviderSettings: (providerId: ProviderId, settings: Partial<ProviderSettings>) =>
        set((state) => {
          const existing = state.providers[providerId] ?? createDefaultProviders()[providerId];
          const providers = {
            ...state.providers,
            [providerId]: {
              ...existing,
              ...settings,
            },
          };
          return {
            providers,
            activeProviderSettings:
              providerId === state.activeProviderId
                ? providers[providerId]
                : activeSettings({ ...state, providers }),
          };
        }),
      setApiEndpoint: (apiEndpoint: string) =>
        get().setProviderSettings(get().activeProviderId, { apiEndpoint }),
      setModel: (model: string) =>
        get().setProviderSettings(get().activeProviderId, { model }),
      setTheme: (theme: 'dark' | 'light') => set({ theme }),
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      setSidebarCollapsed: (sidebarCollapsed: boolean) =>
        set({ sidebarCollapsed }),
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      isConfigured: () => {
        const { activeProviderId, apiKeyConfigured, providers } = get();
        return (
          apiKeyConfigured[activeProviderId] ||
          providers[activeProviderId]?.apiKey.trim().length > 0
        );
      },
    }),
    {
      name: 'code-agent-settings',
      partialize: (state) => ({
        activeProviderId: state.activeProviderId,
        providers: Object.fromEntries(
          Object.entries(state.providers).map(([id, provider]) => [
            id,
            { ...provider, apiKey: '' },
          ]),
        ),
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<SettingsState>;
        const activeProviderId = saved.activeProviderId ?? current.activeProviderId;
        const providers = {
          ...createDefaultProviders(),
          ...saved.providers,
        };
        return {
          ...current,
          ...saved,
          activeProviderId,
          providers,
          activeProviderSettings: providers[activeProviderId],
          activeProviderDefinition: getProvider(activeProviderId),
          apiKeyConfigured: current.apiKeyConfigured,
        };
      },
    },
  ),
);
