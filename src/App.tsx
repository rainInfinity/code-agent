import React, { useEffect, useState, useMemo } from 'react';
import { ThemeProvider } from 'styled-components';
import { GlobalStyle } from '@/styles/GlobalStyle';
import { darkTheme, lightTheme } from '@/styles/theme';
import { useSettingsStore } from '@/stores/settingsStore';
import { AppFrame, LayoutContainer, MainArea, ContentArea } from '@/components/Layout/AppLayout';
import { Sidebar } from '@/components/Layout/Sidebar';
import { TitleBar } from '@/components/Layout/TitleBar';
import { StatusBar } from '@/components/Layout/StatusBar';
import { ChatPanel } from '@/components/Chat/ChatPanel';
import { SettingsModal } from '@/components/common/SettingsModal';
import { ApiConfigBanner } from '@/components/common/ApiConfigBanner';
import { loadSettings } from '@/hooks/useIpc';

const App: React.FC = () => {
  const themeMode = useSettingsStore((s) => s.theme);
  const isConfigured = useSettingsStore((s) => s.isConfigured());
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    loadSettings()
      .then((settings) => {
        useSettingsStore.setState({
          apiEndpoint: settings.apiEndpoint,
          model: settings.model,
          apiKeyConfigured: settings.hasApiKey,
        });
      })
      .catch(() => {
        // Settings sync is best-effort; the UI can still collect settings manually.
      });
  }, []);

  const theme = useMemo(
    () => (themeMode === 'dark' ? darkTheme : lightTheme),
    [themeMode]
  );

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <AppFrame>
        <TitleBar />
        <LayoutContainer>
          <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
          <MainArea>
            {!isConfigured && (
              <ApiConfigBanner onOpenSettings={() => setSettingsOpen(true)} />
            )}
            <ContentArea>
              <ChatPanel />
            </ContentArea>
            <StatusBar />
          </MainArea>
        </LayoutContainer>
      </AppFrame>
      {settingsOpen && (
        <SettingsModal onClose={() => setSettingsOpen(false)} />
      )}
    </ThemeProvider>
  );
};

export default App;
