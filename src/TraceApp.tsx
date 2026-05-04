import type React from 'react';
import { useEffect, useMemo } from 'react';
import { ThemeProvider } from 'styled-components';
import { TracePanel } from '@/components/Trace/TracePanel';
import { TraceErrorBoundary } from '@/components/Trace/TraceErrorBoundary';
import { GlobalStyle } from '@/styles/GlobalStyle';
import { darkTheme, lightTheme } from '@/styles/theme';
import { useSettingsStore } from '@/stores/settingsStore';
import { onThemeChanged } from '@/hooks/useIpc';

export const TraceApp: React.FC = () => {
  const themeMode = useSettingsStore((state) => state.theme);
  const theme = useMemo(() => (themeMode === 'dark' ? darkTheme : lightTheme), [themeMode]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    onThemeChanged((event) => {
      useSettingsStore.setState({ theme: event.theme });
    })
      .then((cleanup) => {
        unlisten = cleanup;
      })
      .catch(() => {
        unlisten = undefined;
      });

    return () => {
      unlisten?.();
    };
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <TraceErrorBoundary>
        <TracePanel />
      </TraceErrorBoundary>
    </ThemeProvider>
  );
};
