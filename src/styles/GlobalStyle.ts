import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  /* CSS Reset */
  *, *::before, *::after {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html, body, #root {
    height: 100%;
    width: 100%;
    overflow: hidden;
  }

  body {
    font-family: ${({ theme }) => theme.typography.fontFamily};
    font-size: ${({ theme }) => theme.typography.fontSize.base};
    line-height: ${({ theme }) => theme.typography.lineHeight.normal};
    color: ${({ theme }) => theme.colors.textPrimary};
    background-color: ${({ theme }) => theme.colors.bgPrimary};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;

    /* Prevent text selection during drag */
    user-select: none;
  }

  /* Allow text selection in content areas */
  .selectable, textarea, input, pre, code,
  [contenteditable] {
    user-select: text;
  }

  /* Scrollbar styling */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colors.scrollbarTrack};
  }

  ::-webkit-scrollbar-thumb {
    background-color: ${({ theme }) => theme.colors.scrollbarThumb};
    border-radius: 4px;

    &:hover {
      background-color: ${({ theme }) => theme.colors.textTertiary};
    }
  }

  /* Focus styles — visible focus rings on interactive elements */
  :focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accentPrimary};
    outline-offset: 2px;
  }

  /* Links */
  a {
    color: ${({ theme }) => theme.colors.accentPrimary};
    text-decoration: none;

    &:hover {
      color: ${({ theme }) => theme.colors.accentPrimaryHover};
      text-decoration: underline;
    }
  }

  /* Code elements */
  code, pre {
    font-family: ${({ theme }) => theme.typography.fontFamilyMono};
  }

  /* Button reset */
  button {
    border: none;
    background: none;
    cursor: pointer;
    font-family: inherit;
    font-size: inherit;
    color: inherit;
  }

  /* Input reset */
  input, textarea {
    border: none;
    background: none;
    font-family: inherit;
    font-size: inherit;
    color: inherit;
    outline: none;
  }

  /* Prevent Tauri window drag on text/inputs */
  input, textarea, button, a, select {
    -webkit-app-region: no-drag;
  }
`;
