import { keyframes } from 'styled-components';

export const pulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
`;

export const shimmer = keyframes`
  0% { background-position: 200% 50%; }
  100% { background-position: 0% 50%; }
`;

export const blink = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
`;
