import type { ProviderDefinition, ProviderId, ProviderSettings } from '@/types';

export const PROVIDER_IDS: ProviderId[] = ['anthropic', 'deepseek'];

export const ProviderRegistry: Readonly<Record<ProviderId, ProviderDefinition>> = Object.freeze({
  anthropic: Object.freeze({
    id: 'anthropic',
    name: 'Anthropic',
    defaultEndpoint: 'https://api.anthropic.com',
    defaultModel: 'claude-haiku-4-5-20251001',
    chatPath: '/v1/messages',
    modelsPath: '/v1/models?limit=1000',
    authHeaderName: 'x-api-key',
    authHeaderValuePrefix: '',
    apiKeyPrefix: 'sk-ant-',
    apiKeyHelpKey: 'anthropic',
    extraHeaders: Object.freeze({ 'anthropic-version': '2023-06-01' }),
  }),
  deepseek: Object.freeze({
    id: 'deepseek',
    name: 'DeepSeek',
    defaultEndpoint: 'https://api.deepseek.com/anthropic',
    defaultModel: 'deepseek-chat',
    chatPath: '/v1/messages',
    modelsPath: '/v1/models',
    authHeaderName: 'x-api-key',
    authHeaderValuePrefix: '',
    apiKeyPrefix: 'sk-',
    apiKeyHelpKey: 'deepseek',
    extraHeaders: Object.freeze({ 'anthropic-version': '2023-06-01' }),
  }),
});

export function getProvider(id: ProviderId): ProviderDefinition {
  return ProviderRegistry[id];
}

export function createDefaultProviderSettings(id: ProviderId): ProviderSettings {
  const provider = getProvider(id);
  return {
    apiKey: '',
    apiEndpoint: provider.defaultEndpoint,
    model: provider.defaultModel,
  };
}

export function createDefaultProviders(): Record<ProviderId, ProviderSettings> {
  return {
    anthropic: createDefaultProviderSettings('anthropic'),
    deepseek: createDefaultProviderSettings('deepseek'),
  };
}
