import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import {
  FaXmark,
  FaKey,
  FaServer,
  FaPalette,
  FaGear,
  FaSun,
  FaMoon,
  FaFloppyDisk,
  FaRotate,
} from 'react-icons/fa6';
import { SiAnthropic } from 'react-icons/si';
import type { IconType } from 'react-icons';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  listModels,
  loadSettings,
  saveSettings,
  type ModelInfo,
} from '@/hooks/useIpc';
import { Column, Row } from '@/components/common/Flex';
import { messages } from '@/i18n';
import {
  PROVIDER_IDS,
  createDefaultProviderSettings,
  getProvider,
} from '@/config/providers';
import type { ProviderId, ProviderSettings } from '@/types';

// ─── Animations ─────────────────────────────────────────────

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(24px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

// ─── Styled Components ──────────────────────────────────────

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme }) => theme.colors.overlay};
  animation: ${fadeIn} 200ms ease-out;
`;

const Modal = styled.div`
  position: relative;
  width: 760px;
  max-width: 92vw;
  height: 560px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background-color: ${({ theme }) => theme.colors.bgElevated};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.xl};
  box-shadow: ${({ theme }) => theme.shadows.xl};
  animation: ${slideUp} 250ms ease-out;
`;

const ModalBody = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: minmax(132px, 160px) minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;

  @media (max-width: 700px) {
    grid-template-columns: minmax(112px, 34%) minmax(0, 1fr);
  }
`;

const Section = styled(Column)``;

const SectionNav = styled.nav`
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.md};
  border-right: 1px solid ${({ theme }) => theme.colors.divider};
  background-color: ${({ theme }) => theme.colors.bgSecondary};
  border-radius: ${({ theme }) => theme.borderRadius.xl} 0 0 0;
`;

const SectionNavButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 100%;
  min-height: 36px;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.accentPrimary : theme.colors.textSecondary};
  background-color: ${({ theme, $active }) =>
    $active ? `${theme.colors.accentPrimary}14` : 'transparent'};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme, $active }) =>
    $active
      ? theme.typography.fontWeight.semibold
      : theme.typography.fontWeight.medium};
  transition:
    color ${({ theme }) => theme.transitions.fast},
    background-color ${({ theme }) => theme.transitions.fast};

  &:hover {
    color: ${({ theme }) => theme.colors.accentPrimary};
    background-color: ${({ theme }) => theme.colors.bgHover};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.inputBorderFocus};
    outline-offset: 2px;
  }
`;

const SectionContent = styled(Column)`
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding: ${({ theme }) => theme.spacing.xl};
`;

const SectionScroll = styled(Column)`
  min-height: 0;
  flex: 1;
  overflow-y: auto;
`;

const SectionActions = styled(Row)`
  flex-shrink: 0;
  padding-top: ${({ theme }) => theme.spacing.lg};
`;

const SectionTitle = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`;

const SubLabel = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const FieldGroup = styled(Column)``;

const FieldLabelRow = styled(Row)`
  width: 100%;
`;

const Label = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const LabelIcon = styled.span`
  color: ${({ theme }) => theme.colors.textTertiary};
  display: flex;
  align-items: center;
`;

const Input = styled.input`
  width: 100%;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background-color: ${({ theme }) => theme.colors.inputBg};
  border: 1px solid ${({ theme }) => theme.colors.inputBorder};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme }) => theme.colors.inputText};
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-family: ${({ theme }) => theme.typography.fontFamily};
  transition: border-color ${({ theme }) => theme.transitions.fast};

  &:focus {
    border-color: ${({ theme }) => theme.colors.inputBorderFocus};
    outline: none;
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.inputPlaceholder};
  }
`;

const Select = styled.select`
  flex: 1;
  min-width: 0;
  padding: ${({ theme }) => theme.spacing.sm} 44px
    ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  appearance: none;
  background-color: ${({ theme }) => theme.colors.inputBg};
  background-image: url("data:image/svg+xml,%3Csvg width='14' height='14' viewBox='0 0 20 20' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M5 7.5L10 12.5L15 7.5' stroke='%239AA4B2' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-size: 14px;
  border: 1px solid ${({ theme }) => theme.colors.inputBorder};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme }) => theme.colors.inputText};
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-family: ${({ theme }) => theme.typography.fontFamily};
  transition: border-color ${({ theme }) => theme.transitions.fast};

  &:focus {
    border-color: ${({ theme }) => theme.colors.inputBorderFocus};
    outline: none;
  }

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
`;

const ModelControlRow = styled(Row)``;

const ProviderRadioGroup = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${({ theme }) => theme.spacing.sm};
`;

const ProviderRadioButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid
    ${({ theme, $active }) =>
      $active ? theme.colors.accentPrimary : theme.colors.inputBorder};
  background-color: ${({ theme, $active }) =>
    $active ? `${theme.colors.accentPrimary}18` : theme.colors.inputBg};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.accentPrimary : theme.colors.textSecondary};
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover {
    border-color: ${({ theme }) => theme.colors.accentPrimary};
    color: ${({ theme }) => theme.colors.accentPrimary};
    background-color: ${({ theme }) => theme.colors.bgHover};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
  }
`;

const IconButton = styled.button<{ $loading?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  min-width: 40px;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textSecondary};
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover:not([disabled]) {
    border-color: ${({ theme }) => theme.colors.accentPrimary};
    color: ${({ theme }) => theme.colors.accentPrimary};
    background-color: ${({ theme }) => theme.colors.bgHover};
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  svg {
    animation: ${({ $loading }) => ($loading ? spin : 'none')} 800ms linear
      infinite;
  }
`;

const HelperText = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.textTertiary};
`;

const ConfiguredStatus = styled(Row)`
  color: ${({ theme }) => theme.colors.success};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
`;

const ErrorText = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.error};
`;

const ThemeToggleGroup = styled(Row)``;

const InlineFieldGroup = styled(Row)`
  width: 100%;
  align-items: center;
  justify-content: space-between;
`;

const ThemeButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid
    ${({ theme, $active }) =>
      $active ? theme.colors.accentPrimary : theme.colors.border};
  background-color: ${({ theme, $active }) =>
    $active ? `${theme.colors.accentPrimary}15` : 'transparent'};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.accentPrimary : theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover {
    border-color: ${({ theme }) => theme.colors.accentPrimary};
    color: ${({ theme }) => theme.colors.accentPrimary};
  }
`;

const CloseButton = styled.button`
  position: absolute;
  top: ${({ theme }) => theme.spacing.lg};
  right: ${({ theme }) => theme.spacing.lg};
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 32px;
  min-width: 40px;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme }) => theme.colors.textSecondary};
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover {
    background-color: ${({ theme }) => theme.colors.bgActive};
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`;

const SaveButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xl};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.accentPrimary};
  color: #fff;
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover {
    background-color: ${({ theme }) => theme.colors.accentPrimaryHover};
    transform: scale(1.02);
  }

  &:active {
    transform: scale(0.98);
  }
`;

const CancelButton = styled.button`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xl};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover {
    background-color: ${({ theme }) => theme.colors.bgHover};
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`;

// ─── Component ──────────────────────────────────────────────

interface SettingsModalProps {
  onClose: () => void;
}

const providerIcons: Record<ProviderId, IconType> = {
  anthropic: SiAnthropic,
  deepseek: ({ size = 18, ...props }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path
        d="M3.2 13.7c.6-4.1 4-7.1 8.5-7.1 3.9 0 6.7 2.1 7.6 5.4 1-.2 1.9-.7 2.7-1.5-.1 2.6-1.6 4.4-3.8 5.2-.9 2.5-3.4 4.2-6.5 4.2-4.6 0-8.2-2.8-8.5-6.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 13.2c1.6 3 3.7 4.4 6.5 4.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M19.4 10.8c-.1-1.8.7-3.2 2.1-4.1.4 1.9-.1 3.3-1.5 4.3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.4 7.4c.4-1.6 1.5-2.7 3.1-3.3.1 1.7-.6 2.9-2 3.7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9.2" cy="11.1" r="0.8" fill="currentColor" />
    </svg>
  ),
};

type SettingsSection = 'general' | 'api';

const sectionItems: Array<{
  id: SettingsSection;
  label: string;
  icon: IconType;
}> = [
  { id: 'general', label: messages.settings.sidebar.general, icon: FaGear },
  { id: 'api', label: messages.settings.sidebar.api, icon: FaKey },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const settings = useSettingsStore();

  const [activeSection, setActiveSection] =
    useState<SettingsSection>('general');
  const [providerId, setProviderId] = useState<ProviderId>(
    settings.activeProviderId,
  );
  const [drafts, setDrafts] = useState<Record<ProviderId, ProviderSettings>>(
    settings.providers,
  );
  const [apiKey, setApiKey] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState(
    settings.activeProviderSettings.apiEndpoint,
  );
  const [model, setModel] = useState(settings.activeProviderSettings.model);
  const [theme, setThemeLocal] = useState(settings.theme);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(
    settings.apiKeyConfigured,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const activeProvider = getProvider(providerId);
  const providerHasApiKey =
    apiKeyConfigured[providerId] || apiKey.trim().length > 0;

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    loadSettings()
      .then((loaded) => {
        const nextProviderId = PROVIDER_IDS.includes(loaded.activeProviderId)
          ? loaded.activeProviderId
          : 'anthropic';
        const nextProviders = PROVIDER_IDS.reduce(
          (acc, id) => {
            const provider = loaded.providers[id];
            acc[id] = {
              ...createDefaultProviderSettings(id),
              apiEndpoint:
                provider?.apiEndpoint ??
                createDefaultProviderSettings(id).apiEndpoint,
              model: provider?.model ?? createDefaultProviderSettings(id).model,
              apiKey: '',
            };
            return acc;
          },
          {} as Record<ProviderId, ProviderSettings>,
        );
        const nextConfigured = PROVIDER_IDS.reduce(
          (acc, id) => {
            acc[id] = Boolean(loaded.providers[id]?.hasApiKey);
            return acc;
          },
          {} as Record<ProviderId, boolean>,
        );

        setProviderId(nextProviderId);
        setDrafts(nextProviders);
        setApiEndpoint(nextProviders[nextProviderId].apiEndpoint);
        setModel(nextProviders[nextProviderId].model);
        setApiKeyConfigured(nextConfigured);
        useSettingsStore.setState({
          activeProviderId: nextProviderId,
          providers: nextProviders,
          activeProviderSettings: nextProviders[nextProviderId],
          activeProviderDefinition: getProvider(nextProviderId),
          apiKeyConfigured: nextConfigured,
        });
      })
      .catch(() => {
        setApiKeyConfigured(settings.apiKeyConfigured);
      });
  }, []);

  const handleProviderChange = (nextProviderId: ProviderId) => {
    const nextDrafts = {
      ...drafts,
      [providerId]: {
        ...(drafts[providerId] ?? createDefaultProviderSettings(providerId)),
        apiKey,
        apiEndpoint,
        model,
      },
    };
    const nextSettings =
      nextDrafts[nextProviderId] ??
      createDefaultProviderSettings(nextProviderId);

    setDrafts(nextDrafts);
    setProviderId(nextProviderId);
    setApiKey(nextSettings.apiKey);
    setApiEndpoint(nextSettings.apiEndpoint);
    setModel(nextSettings.model);
    setAvailableModels([]);
    setModelError(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      await saveSettings({
        providerId,
        apiKey,
        apiEndpoint,
        model,
      });

      const hasReplacementKey = apiKey.trim().length > 0;
      const nextConfigured = {
        ...apiKeyConfigured,
        [providerId]: hasReplacementKey || apiKeyConfigured[providerId],
      };
      const nextProviderSettings = { apiKey: '', apiEndpoint, model };
      const nextProviders = {
        ...drafts,
        [providerId]: nextProviderSettings,
      };
      useSettingsStore.setState({
        activeProviderId: providerId,
        providers: nextProviders,
        activeProviderSettings: nextProviderSettings,
        activeProviderDefinition: getProvider(providerId),
        apiKeyConfigured: nextConfigured,
      });
      setApiKey('');
      setApiKeyConfigured(nextConfigured);
      settings.setTheme(theme);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadModels = async () => {
    setIsLoadingModels(true);
    setModelError(null);

    try {
      const models = await listModels({
        providerId,
        apiKey,
        apiEndpoint,
      });

      setAvailableModels(models);
      if (models.length > 0 && !models.some((m) => m.id === model)) {
        setModel(models[0].id);
      }
    } catch (err) {
      setModelError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingModels(false);
    }
  };

  return (
    <Overlay onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <CloseButton
          onClick={onClose}
          aria-label={messages.settings.close}
          title={messages.settings.close}
        >
          <FaXmark size={16} />
        </CloseButton>

        <ModalBody>
          <SectionNav aria-label={messages.settings.title}>
            <Column $gap="xs">
              {sectionItems.map((item) => {
                const SectionIcon = item.icon;
                return (
                  <SectionNavButton
                    key={item.id}
                    type="button"
                    $active={activeSection === item.id}
                    onClick={() => setActiveSection(item.id)}
                  >
                    <SectionIcon size={13} />
                    <span>{item.label}</span>
                  </SectionNavButton>
                );
              })}
            </Column>
          </SectionNav>

          <SectionContent $gap="xl">
            <SectionScroll $gap="xl">
              {activeSection === 'general' && (
                <Section $gap="md">
                  <SectionTitle>
                    {messages.settings.sidebar.general}
                  </SectionTitle>

                  <InlineFieldGroup $gap="md">
                    <Label>
                      <LabelIcon>
                        <FaPalette size={12} />
                      </LabelIcon>
                      {messages.settings.theme}
                    </Label>
                    <ThemeToggleGroup $gap="sm">
                      <ThemeButton
                        type="button"
                        $active={theme === 'dark'}
                        onClick={() => setThemeLocal('dark')}
                      >
                        <FaMoon size={12} />
                        {messages.settings.dark}
                      </ThemeButton>
                      <ThemeButton
                        type="button"
                        $active={theme === 'light'}
                        onClick={() => setThemeLocal('light')}
                      >
                        <FaSun size={12} />
                        {messages.settings.light}
                      </ThemeButton>
                    </ThemeToggleGroup>
                  </InlineFieldGroup>
                </Section>
              )}

              {activeSection === 'api' && (
                <Section $gap="md">
                  <SectionTitle>{messages.settings.sidebar.api}</SectionTitle>

                  <FieldGroup $gap="xs">
                    <Label id="provider-label">
                      <LabelIcon>
                        <FaServer size={12} />
                      </LabelIcon>
                      {messages.settings.provider}
                    </Label>
                    <ProviderRadioGroup
                      role="radiogroup"
                      aria-labelledby="provider-label"
                    >
                      {PROVIDER_IDS.map((id) => {
                        const ProviderIcon = providerIcons[id];
                        return (
                          <ProviderRadioButton
                            key={id}
                            type="button"
                            $active={providerId === id}
                            role="radio"
                            aria-checked={providerId === id}
                            aria-label={messages.settings.providerOptions[id]}
                            title={messages.settings.providerOptions[id]}
                            onClick={() => handleProviderChange(id)}
                          >
                            <ProviderIcon size={18} />
                          </ProviderRadioButton>
                        );
                      })}
                    </ProviderRadioGroup>
                  </FieldGroup>

                  <FieldGroup $gap="xs">
                    <FieldLabelRow
                      $align="center"
                      $justify="space-between"
                      $gap="md"
                    >
                      <Label htmlFor="api-key">
                        <LabelIcon>
                          <FaKey size={12} />
                        </LabelIcon>
                        {messages.settings.apiKey}
                      </Label>
                      {providerHasApiKey && (
                        <ConfiguredStatus $align="center" $gap="xs">
                          <FaKey size={11} />
                          {messages.settings.apiKeyConfigured}
                        </ConfiguredStatus>
                      )}
                    </FieldLabelRow>
                    <Input
                      id="api-key"
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={
                        providerHasApiKey
                          ? messages.settings.apiKeyReplacePlaceholder
                          : `${activeProvider.apiKeyPrefix}...`
                      }
                      autoComplete="off"
                    />
                    <HelperText>
                      {providerHasApiKey
                        ? messages.settings.apiKeyKeepHelp
                        : messages.settings.apiKeyStorageHelpForProvider(
                            activeProvider.name,
                          )}
                    </HelperText>
                    {saveError && <ErrorText>{saveError}</ErrorText>}
                  </FieldGroup>

                  <FieldGroup $gap="xs">
                    <Label htmlFor="api-endpoint">
                      <LabelIcon>
                        <FaServer size={12} />
                      </LabelIcon>
                      {messages.settings.apiEndpoint}
                    </Label>
                    <Input
                      id="api-endpoint"
                      type="url"
                      value={apiEndpoint}
                      onChange={(e) => setApiEndpoint(e.target.value)}
                      placeholder={activeProvider.defaultEndpoint}
                    />
                    <HelperText>
                      {messages.settings.apiEndpointHelpForProvider(
                        activeProvider.name,
                      )}
                    </HelperText>
                  </FieldGroup>

                  <FieldGroup $gap="xs">
                    <SubLabel>{messages.settings.model}</SubLabel>
                    <ModelControlRow $gap="sm" style={{ marginTop: 8 }}>
                      <Select
                        id="model"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        disabled={availableModels.length === 0}
                      >
                        {availableModels.length === 0 ? (
                          <option value={model}>{model}</option>
                        ) : (
                          availableModels.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.displayName
                                ? `${item.displayName} (${item.id})`
                                : item.id}
                            </option>
                          ))
                        )}
                      </Select>
                      <IconButton
                        type="button"
                        onClick={handleLoadModels}
                        disabled={isLoadingModels}
                        $loading={isLoadingModels}
                        title={
                          isLoadingModels
                            ? messages.settings.refreshModelsLoading
                            : messages.settings.refreshModels
                        }
                        aria-label={
                          isLoadingModels
                            ? messages.settings.refreshModelsLoading
                            : messages.settings.refreshModels
                        }
                      >
                        <FaRotate size={13} />
                      </IconButton>
                    </ModelControlRow>
                    <HelperText>
                      {availableModels.length > 0
                        ? messages.settings.modelsAvailable(
                            availableModels.length,
                          )
                        : messages.settings.modelsRefreshHelp}
                    </HelperText>
                    {modelError && <ErrorText>{modelError}</ErrorText>}
                  </FieldGroup>
                </Section>
              )}
            </SectionScroll>

            <SectionActions $justify="flex-end" $align="center" $gap="sm">
              <CancelButton onClick={onClose}>
                {messages.settings.cancel}
              </CancelButton>
              <SaveButton onClick={handleSave} disabled={isSaving}>
                <FaFloppyDisk size={13} />
                {isSaving ? messages.settings.saving : messages.settings.save}
              </SaveButton>
            </SectionActions>
          </SectionContent>
        </ModalBody>
      </Modal>
    </Overlay>
  );
};
