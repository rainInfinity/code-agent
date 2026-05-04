import { Component, type ReactNode } from 'react';
import styled from 'styled-components';

const ErrorShell = styled.div`
  min-height: 100vh;
  padding: ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colors.bgPrimary};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-family: ${({ theme }) => theme.typography.fontFamily};
`;

const Title = styled.h1`
  margin: 0 0 ${({ theme }) => theme.spacing.md};
  font-size: ${({ theme }) => theme.typography.fontSize.md};
`;

const Details = styled.pre`
  white-space: pre-wrap;
  word-break: break-word;
  padding: ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme }) => theme.colors.codeBg};
  color: ${({ theme }) => theme.colors.codeText};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
`;

type State = {
  error: Error | null;
};

export class TraceErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <ErrorShell>
          <Title>Trace 面板加载失败</Title>
          <Details>{this.state.error.message}</Details>
        </ErrorShell>
      );
    }

    return this.props.children;
  }
}
