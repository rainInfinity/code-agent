export type ProviderId = 'anthropic' | 'deepseek';

export interface ProviderDefinition {
  id: ProviderId;
  name: string;
  defaultEndpoint: string;
  defaultModel: string;
  chatPath: string;
  modelsPath: string;
  authHeaderName: string;
  authHeaderValuePrefix: string;
  apiKeyPrefix: string;
  apiKeyHelpKey: 'anthropic' | 'deepseek';
  extraHeaders?: Record<string, string>;
}

export interface ProviderSettings {
  apiKey: string;
  apiEndpoint: string;
  model: string;
}
