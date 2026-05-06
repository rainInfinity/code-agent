import React from 'react';
import styled from 'styled-components';
import type { ContentBlock } from '@/types';

const ToolResultShell = styled.details<{ $isError: boolean }>`
  margin: ${({ theme }) => theme.spacing.sm} 0;
  border: 1px solid
    ${({ theme, $isError }) =>
      $isError ? `${theme.colors.error}40` : theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme, $isError }) =>
    $isError ? `${theme.colors.error}10` : theme.colors.bgSecondary};
  overflow: hidden;

  summary {
    cursor: pointer;
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    color: ${({ theme, $isError }) =>
      $isError ? theme.colors.error : theme.colors.textSecondary};
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
    list-style: none;
  }

  summary::-webkit-details-marker {
    display: none;
  }
`;

const ToolResultContent = styled.pre`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.md};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.codeBg};
  color: ${({ theme }) => theme.colors.codeText};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-family: ${({ theme }) => theme.typography.fontFamilyMono};
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 220px;
  overflow: auto;
`;

export const ToolResultBlock: React.FC<{
  block: Extract<ContentBlock, { type: 'tool_result' }>;
}> = ({ block }) => (
  <ToolResultShell $isError={Boolean(block.isError)}>
    <summary>
      {block.isError
        ? `Tool error (${block.toolUseId})`
        : `Tool result (${block.toolUseId})`}
    </summary>
    <ToolResultContent>{block.content}</ToolResultContent>
  </ToolResultShell>
);
