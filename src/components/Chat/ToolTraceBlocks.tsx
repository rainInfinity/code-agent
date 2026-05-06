import type React from 'react';
import styled from 'styled-components';
import type { ToolTrace } from '@/types';

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  margin: ${({ theme }) => theme.spacing.sm} 0;
`;

const Card = styled.details`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme }) => theme.colors.bgSecondary};
  overflow: hidden;

  summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.sm};
    cursor: pointer;
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    list-style: none;
  }

  summary::-webkit-details-marker {
    display: none;
  }
`;

const SummaryMain = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-width: 0;
`;

const SummaryText = styled.span`
  min-width: 0;
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
`;

const Status = styled.span<{ $status: ToolTrace['status'] }>`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  background: ${({ theme, $status }) =>
    $status === 'failed'
      ? `${theme.colors.error}18`
      : $status === 'completed'
        ? `${theme.colors.success}18`
        : `${theme.colors.info}18`};
  color: ${({ theme, $status }) =>
    $status === 'failed'
      ? theme.colors.error
      : $status === 'completed'
        ? theme.colors.success
        : theme.colors.info};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  white-space: nowrap;
`;


const Body = styled.div`
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  padding: ${({ theme }) => theme.spacing.md};
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Label = styled.div`
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const CodeBlock = styled.pre`
  margin: 0;
  max-height: 220px;
  overflow: auto;
  padding: ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  background: ${({ theme }) => theme.colors.codeBg};
  color: ${({ theme }) => theme.colors.codeText};
  border: 1px solid ${({ theme }) => theme.colors.codeBorder};
  white-space: pre-wrap;
  word-break: break-word;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-family: ${({ theme }) => theme.typography.fontFamilyMono};
`;

const statusLabel: Record<ToolTrace['status'], string> = {
  requested: 'Requested',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
};

const formatJson = (value: Record<string, unknown>) =>
  JSON.stringify(value, null, 2);

export const ToolTraceBlocks: React.FC<{ toolTraces: ToolTrace[] }> = ({ toolTraces }) => {
  if (toolTraces.length === 0) return null;

  return (
    <List>
      {toolTraces.map((toolTrace) => (
        <Card key={toolTrace.toolCallId}>
          <summary>
            <SummaryMain>
              <Status $status={toolTrace.status}>{statusLabel[toolTrace.status]}</Status>
              <SummaryText>{toolTrace.name}</SummaryText>
            </SummaryMain>
          </summary>
          <Body>
            <div>
              <Label>Input</Label>
              <CodeBlock>{formatJson(toolTrace.input)}</CodeBlock>
            </div>
            {toolTrace.output ? (
              <div>
                <Label>Output</Label>
                <CodeBlock>{toolTrace.output}</CodeBlock>
              </div>
            ) : null}
            {toolTrace.error ? (
              <div>
                <Label>Error</Label>
                <CodeBlock>{toolTrace.error}</CodeBlock>
              </div>
            ) : null}
          </Body>
        </Card>
      ))}
    </List>
  );
};
