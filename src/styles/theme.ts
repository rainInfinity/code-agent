// ============================================================
// Design System — Theme Definitions
// Following UI/UX Pro Max guidelines:
//   - Semantic color tokens (not raw hex in components)
//   - 4pt/8dp spacing system
//   - Font scale: 12, 13, 14, 16, 18, 20, 24, 32
//   - Dark/Light mode with proper contrast ratios (≥4.5:1)
// ============================================================

export interface ThemeColors {
  // Surfaces
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgElevated: string;
  bgHover: string;
  bgActive: string;

  // Sidebar
  sidebarBg: string;
  sidebarHover: string;
  sidebarActive: string;
  sidebarBorder: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;

  // Brand / Accent
  accentPrimary: string;
  accentPrimaryHover: string;
  accentSecondary: string;

  // Status
  success: string;
  warning: string;
  error: string;
  info: string;

  // Borders & Dividers
  border: string;
  borderSubtle: string;
  divider: string;

  // Message bubbles
  userMessageBg: string;
  userMessageText: string;
  assistantMessageBg: string;
  assistantMessageText: string;

  // Code
  codeBg: string;
  codeText: string;
  codeBorder: string;

  // Input
  inputBg: string;
  inputBorder: string;
  inputBorderFocus: string;
  inputText: string;
  inputPlaceholder: string;

  // StatusBar
  statusBarBg: string;
  statusBarText: string;

  // Scrollbar
  scrollbarThumb: string;
  scrollbarTrack: string;

  // Overlay
  overlay: string;
}

export interface ThemeTypography {
  fontFamily: string;
  fontFamilyMono: string;
  fontSize: {
    xs: string; // 12px
    sm: string; // 13px
    base: string; // 14px
    md: string; // 16px
    lg: string; // 18px
    xl: string; // 20px
    '2xl': string; // 24px
    '3xl': string; // 32px
  };
  fontWeight: {
    light: number;
    regular: number;
    medium: number;
    semibold: number;
    bold: number;
  };
  lineHeight: {
    tight: string;
    normal: string;
    relaxed: string;
  };
}

export interface ThemeSpacing {
  xs: string; // 4px
  sm: string; // 8px
  md: string; // 12px
  lg: string; // 16px
  xl: string; // 24px
  '2xl': string; // 32px
  '3xl': string; // 48px
}

export interface ThemeBorderRadius {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  full: string;
}

export interface ThemeShadows {
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

export interface ThemeTransitions {
  fast: string;
  normal: string;
  slow: string;
}

export interface Theme {
  mode: 'dark' | 'light';
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  borderRadius: ThemeBorderRadius;
  shadows: ThemeShadows;
  transitions: ThemeTransitions;
}

// ─── Shared tokens ───────────────────────────────────────────
const sharedTypography: ThemeTypography = {
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontFamilyMono:
    "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
  fontSize: {
    xs: '12px',
    sm: '13px',
    base: '14px',
    md: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
  },
  fontWeight: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: '1.3',
    normal: '1.5',
    relaxed: '1.75',
  },
};

const sharedSpacing: ThemeSpacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '48px',
};

const sharedBorderRadius: ThemeBorderRadius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
};

const sharedTransitions: ThemeTransitions = {
  fast: '150ms ease-out',
  normal: '250ms ease-out',
  slow: '400ms ease-out',
};

// ─── Dark Theme ──────────────────────────────────────────────
// Inspired by VS Code / GitHub Dark with a blue-gray palette
export const darkTheme: Theme = {
  mode: 'dark',
  colors: {
    bgPrimary: '#0d1117',
    bgSecondary: '#161b22',
    bgTertiary: '#1c2128',
    bgElevated: '#21262d',
    bgHover: 'rgba(136, 152, 170, 0.08)',
    bgActive: 'rgba(136, 152, 170, 0.12)',

    sidebarBg: '#0d1117',
    sidebarHover: 'rgba(136, 152, 170, 0.08)',
    sidebarActive: 'rgba(56, 139, 253, 0.15)',
    sidebarBorder: '#21262d',

    textPrimary: '#e6edf3',
    textSecondary: '#8b949e',
    textTertiary: '#6e7681',
    textInverse: '#0d1117',

    accentPrimary: '#388bfd',
    accentPrimaryHover: '#58a6ff',
    accentSecondary: '#1f6feb',

    success: '#3fb950',
    warning: '#d29922',
    error: '#f85149',
    info: '#58a6ff',

    border: '#30363d',
    borderSubtle: '#21262d',
    divider: '#21262d',

    userMessageBg: '#1f3a5f',
    userMessageText: '#e6edf3',
    assistantMessageBg: '#161b22',
    assistantMessageText: '#e6edf3',

    codeBg: '#0d1117',
    codeText: '#e6edf3',
    codeBorder: '#30363d',

    inputBg: '#0d1117',
    inputBorder: '#30363d',
    inputBorderFocus: '#388bfd',
    inputText: '#e6edf3',
    inputPlaceholder: '#6e7681',

    statusBarBg: '#0d1117',
    statusBarText: '#8b949e',

    scrollbarThumb: '#30363d',
    scrollbarTrack: 'transparent',

    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  typography: sharedTypography,
  spacing: sharedSpacing,
  borderRadius: sharedBorderRadius,
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
    md: '0 4px 8px rgba(0, 0, 0, 0.3)',
    lg: '0 8px 24px rgba(0, 0, 0, 0.4)',
    xl: '0 16px 48px rgba(0, 0, 0, 0.5)',
  },
  transitions: sharedTransitions,
};

// ─── Light Theme ─────────────────────────────────────────────
export const lightTheme: Theme = {
  mode: 'light',
  colors: {
    bgPrimary: '#ffffff',
    bgSecondary: '#f6f8fa',
    bgTertiary: '#eef1f5',
    bgElevated: '#ffffff',
    bgHover: 'rgba(0, 0, 0, 0.04)',
    bgActive: 'rgba(0, 0, 0, 0.06)',

    sidebarBg: '#f6f8fa',
    sidebarHover: 'rgba(0, 0, 0, 0.04)',
    sidebarActive: 'rgba(9, 105, 218, 0.1)',
    sidebarBorder: '#d0d7de',

    textPrimary: '#1f2328',
    textSecondary: '#656d76',
    textTertiary: '#8b949e',
    textInverse: '#ffffff',

    accentPrimary: '#0969da',
    accentPrimaryHover: '#0550ae',
    accentSecondary: '#0969da',

    success: '#1a7f37',
    warning: '#9a6700',
    error: '#cf222e',
    info: '#0969da',

    border: '#d0d7de',
    borderSubtle: '#e8ecf0',
    divider: '#d8dee4',

    userMessageBg: '#dbeafe',
    userMessageText: '#1f2328',
    assistantMessageBg: '#f6f8fa',
    assistantMessageText: '#1f2328',

    codeBg: '#f6f8fa',
    codeText: '#1f2328',
    codeBorder: '#d0d7de',

    inputBg: '#ffffff',
    inputBorder: '#d0d7de',
    inputBorderFocus: '#0969da',
    inputText: '#1f2328',
    inputPlaceholder: '#8b949e',

    statusBarBg: '#f6f8fa',
    statusBarText: '#656d76',

    scrollbarThumb: '#c1c8cd',
    scrollbarTrack: 'transparent',

    overlay: 'rgba(0, 0, 0, 0.3)',
  },
  typography: sharedTypography,
  spacing: sharedSpacing,
  borderRadius: sharedBorderRadius,
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.06)',
    md: '0 4px 8px rgba(0, 0, 0, 0.08)',
    lg: '0 8px 24px rgba(0, 0, 0, 0.12)',
    xl: '0 16px 48px rgba(0, 0, 0, 0.16)',
  },
  transitions: sharedTransitions,
};
