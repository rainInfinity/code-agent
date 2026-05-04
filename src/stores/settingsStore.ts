import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PROVIDER_IDS, createDefaultProviders, getProvider } from '@/config/providers';
import { emitThemeChanged } from '@/hooks/useIpc';
import type {
  AgentMode,
  ProviderApiKeyConfiguredMap,
  ProviderId,
  ProviderSettings,
  Settings,
  WorkDir,
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
  setAgentMode: (mode: AgentMode) => void;
  addWorkingDirectory: (path: string) => void;
  removeWorkingDirectory: (path: string) => void;
}

const defaultProviders = createDefaultProviders();
const defaultApiKeyConfigured: ProviderApiKeyConfiguredMap = {
  anthropic: false,
  deepseek: false,
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
      agentMode: 'chat' as AgentMode,
      workingDirectories: [] as WorkDir[],

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
      setTheme: (theme: 'dark' | 'light') => {
        set({ theme });
        emitThemeChanged(theme).catch(() => {});
      },
      toggleTheme: () =>
        set((state) => {
          const theme = state.theme === 'dark' ? 'light' : 'dark';
          emitThemeChanged(theme).catch(() => {});
          return { theme };
        }),
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

      setAgentMode: (agentMode: AgentMode) => set({ agentMode }),

      addWorkingDirectory: (path: string) =>
        set((state) => {
          const exists = state.workingDirectories.some((d) => d.path === path);
          if (exists) return state;
          const name = path.split(/[/\\]/).filter(Boolean).pop() ?? path;
          return {
            workingDirectories: [
              ...state.workingDirectories,
              { path, name, addedAt: Date.now() },
            ],
          };
        }),

      removeWorkingDirectory: (path: string) =>
        set((state) => ({
          workingDirectories: state.workingDirectories.filter((d) => d.path !== path),
        })),
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
        agentMode: state.agentMode,
        workingDirectories: state.workingDirectories,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<SettingsState>;
        const activeProviderId = PROVIDER_IDS.includes(saved.activeProviderId as ProviderId)
          ? saved.activeProviderId as ProviderId
          : current.activeProviderId;
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
          agentMode: saved.agentMode ?? current.agentMode,
          workingDirectories: saved.workingDirectories ?? current.workingDirectories,
        };
      },
    },
  ),
);
