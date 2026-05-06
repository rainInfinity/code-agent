import type { ProviderId, ProviderSettings } from './provider';

export interface WorkDir {
  path: string;
  name: string;
  addedAt: number;
}

export interface Settings {
  activeProviderId: ProviderId;
  providers: Record<ProviderId, ProviderSettings>;
  theme: 'dark' | 'light';
  sidebarCollapsed: boolean;
  agentMode: import('./message').AgentMode;
  workingDirectories: WorkDir[];
}

export type ProviderSettingsMap = Record<ProviderId, ProviderSettings>;

export type ProviderApiKeyConfiguredMap = Record<ProviderId, boolean>;
