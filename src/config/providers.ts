import type { ProviderDefinition, ProviderId, ProviderSettings } from '@/types';

export const PROVIDER_IDS: ProviderId[] = ['anthropic', 'deepseek', 'openai'];

export const ProviderRegistry: Readonly<Record<ProviderId, ProviderDefinition>> = Object.freeze({
  anthropic: Object.freeze({
    id: 'anthropic',
    name: 'Anthropic',
    defaultEndpoint: 'https://api.anthropic.com',
    defaultModel: 'claude-haiku-4-5-20251001',
    chatPath: '/v1/messages',
    modelsPath: '/v1/models',
    authHeaderName: 'x-api-key',
    authHeaderValuePrefix: '',
    apiKeyPrefix: 'sk-ant-',
    apiKeyHelpKey: 'anthropic',
    extraHeaders: Object.freeze({ 'anthropic-version': '2023-06-01' }),
  }),
  deepseek: Object.freeze({
    id: 'deepseek',
    name: 'DeepSeek',
    defaultEndpoint: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    chatPath: '/v1/chat/completions',
    modelsPath: '/v1/models',
    authHeaderName: 'Authorization',
    authHeaderValuePrefix: 'Bearer ',
    apiKeyPrefix: 'sk-',
    apiKeyHelpKey: 'deepseek',
  }),
  openai: Object.freeze({
    id: 'openai',
    name: 'OpenAI',
    defaultEndpoint: 'https://api.openai.com',
    defaultModel: 'gpt-4.1-mini',
    chatPath: '/v1/chat/completions',
    modelsPath: '/v1/models',
    authHeaderName: 'Authorization',
    authHeaderValuePrefix: 'Bearer ',
    apiKeyPrefix: 'sk-',
    apiKeyHelpKey: 'openai',
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
    openai: createDefaultProviderSettings('openai'),
  };
}
