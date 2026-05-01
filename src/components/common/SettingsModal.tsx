import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import {
  FaXmark,
  FaKey,
  FaServer,
  FaRobot,
  FaPalette,
  FaSun,
  FaMoon,
  FaFloppyDisk,
  FaRotate,
} from 'react-icons/fa6';
import { useSettingsStore } from '@/stores/settingsStore';
import { listModels, saveSettings, type ModelInfo } from '@/hooks/useIpc';

// ─── Animations ─────────────────────────────────────────────

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(24px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
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
  width: 520px;
  max-width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
  background-color: ${({ theme }) => theme.colors.bgElevated};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.xl};
  box-shadow: ${({ theme }) => theme.shadows.xl};
  animation: ${slideUp} 250ms ease-out;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing.xl};
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
`;

const ModalTitle = styled.h2`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const CloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme }) => theme.colors.textSecondary};
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover {
    background-color: ${({ theme }) => theme.colors.bgActive};
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`;

const ModalBody = styled.div`
  padding: ${({ theme }) => theme.spacing.xl};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xl};
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

const SectionTitle = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
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

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
`;

const ModelControlRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const IconButton = styled.button`
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
`;

const HelperText = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.textTertiary};
`;

const ErrorText = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.error};
`;

const ThemeToggleGroup = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const ThemeButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme, $active }) =>
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

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
  border-top: 1px solid ${({ theme }) => theme.colors.divider};
  gap: ${({ theme }) => theme.spacing.sm};
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

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const settings = useSettingsStore();

  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [apiEndpoint, setApiEndpoint] = useState(settings.apiEndpoint);
  const [model, setModel] = useState(settings.model);
  const [theme, setThemeLocal] = useState(settings.theme);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      await saveSettings({
        apiKey,
        apiEndpoint,
        model,
      });

      if (apiKey.trim()) {
        settings.setApiKey(apiKey);
      } else {
        settings.setApiKeyConfigured(settings.apiKeyConfigured);
      }
      settings.setApiEndpoint(apiEndpoint);
      settings.setModel(model);
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
        <ModalHeader>
          <ModalTitle>Settings</ModalTitle>
          <CloseButton onClick={onClose} aria-label="Close settings">
            <FaXmark size={16} />
          </CloseButton>
        </ModalHeader>

        <ModalBody>
          <Section>
            <SectionTitle>API Configuration</SectionTitle>

            <FieldGroup>
              <Label htmlFor="api-key">
                <LabelIcon><FaKey size={12} /></LabelIcon>
                API Key
              </Label>
              <Input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                autoComplete="off"
              />
              <HelperText>Your Anthropic API key. Stored securely in memory only.</HelperText>
              {saveError && <ErrorText>{saveError}</ErrorText>}
            </FieldGroup>

            <FieldGroup>
              <Label htmlFor="api-endpoint">
                <LabelIcon><FaServer size={12} /></LabelIcon>
                API Endpoint
              </Label>
              <Input
                id="api-endpoint"
                type="url"
                value={apiEndpoint}
                onChange={(e) => setApiEndpoint(e.target.value)}
                placeholder="https://api.anthropic.com"
              />
              <HelperText>Anthropic API endpoint. Change for proxy usage.</HelperText>
            </FieldGroup>

            <FieldGroup>
              <Label htmlFor="model">
                <LabelIcon><FaRobot size={12} /></LabelIcon>
                Model
              </Label>
              <ModelControlRow>
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
                        {item.displayName ? `${item.displayName} (${item.id})` : item.id}
                      </option>
                    ))
                  )}
                </Select>
                <IconButton
                  onClick={handleLoadModels}
                  disabled={isLoadingModels}
                  title="Refresh available models"
                  aria-label="Refresh available models"
                >
                  <FaRotate size={13} />
                </IconButton>
              </ModelControlRow>
              <HelperText>
                {availableModels.length > 0
                  ? `${availableModels.length} models available.`
                  : 'Refresh to query available models for this API key.'}
              </HelperText>
              {modelError && <ErrorText>{modelError}</ErrorText>}
            </FieldGroup>
          </Section>

          <Section>
            <SectionTitle>Appearance</SectionTitle>

            <FieldGroup>
              <Label>
                <LabelIcon><FaPalette size={12} /></LabelIcon>
                Theme
              </Label>
              <ThemeToggleGroup>
                <ThemeButton
                  $active={theme === 'dark'}
                  onClick={() => setThemeLocal('dark')}
                >
                  <FaMoon size={12} />
                  Dark
                </ThemeButton>
                <ThemeButton
                  $active={theme === 'light'}
                  onClick={() => setThemeLocal('light')}
                >
                  <FaSun size={12} />
                  Light
                </ThemeButton>
              </ThemeToggleGroup>
            </FieldGroup>
          </Section>
        </ModalBody>

        <ModalFooter>
          <CancelButton onClick={onClose}>Cancel</CancelButton>
          <SaveButton onClick={handleSave} disabled={isSaving}>
            <FaFloppyDisk size={13} />
            {isSaving ? 'Saving...' : 'Save'}
          </SaveButton>
        </ModalFooter>
      </Modal>
    </Overlay>
  );
};
