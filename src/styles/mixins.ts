import { css } from 'styled-components';
import type { Theme } from './theme';

export const focusRing = css`
  &:focus-visible {
    outline: 2px solid ${({ theme }: { theme: Theme }) => theme.colors.inputBorderFocus};
    outline-offset: 2px;
  }
`;

export const interactiveBg = css`
  &:hover {
    background-color: ${({ theme }: { theme: Theme }) => theme.colors.bgHover};
  }

  ${focusRing}
`;

type StatusTone = 'success' | 'error' | 'warning' | 'info';

export const statusColor = (tone: StatusTone) => css`
  color: ${({ theme }: { theme: Theme }) => theme.colors[tone]};
`;

export const textEllipsis = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
