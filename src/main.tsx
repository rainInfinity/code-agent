import React from 'react';
import ReactDOM from 'react-dom/client';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import App from './App';
import { TraceApp } from './TraceApp';

function isTraceWindow(): boolean {
  // Primary: URL query parameter (injected by Rust when creating the window)
  if (typeof window !== 'undefined' && window.location.search.includes('window=trace')) {
    return true;
  }

  // Fallback: IPC label check (for HMR dev scenarios where URL params may be lost)
  try {
    return getCurrentWebviewWindow().label === 'trace';
  } catch {
    return false;
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {isTraceWindow() ? <TraceApp /> : <App />}
  </React.StrictMode>,
);
