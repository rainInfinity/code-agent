import type React from 'react';
import styled from 'styled-components';
import type { ToolTrace, TurnTrace } from '@/types';
import { TraceCopyButton } from './TraceCopyButton';
import { useCopyFeedback } from './useCopyFeedback';

const Section = styled.section`
  border-top: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  margin-top: ${({ theme }) => theme.spacing.md};
  padding-top: ${({ theme }) => theme.spacing.md};
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.sm};
`;

const Card = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  background: ${({ theme }) => theme.colors.bgPrimary};
  overflow: hidden;
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm};
`;

const Name = styled.span`
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
`;

const Status = styled.span<{ $status: ToolTrace['status'] }>`
  color: ${({ theme, $status }) =>
    $status === 'failed'
      ? theme.colors.error
      : $status === 'completed'
        ? theme.colors.success
        : theme.colors.info};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
`;

const Body = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: 0 ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.sm};
`;

const Label = styled.div`
  color: ${({ theme }) => theme.colors.textTertiary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  text-transform: uppercase;
`;

const Content = styled.pre`
  margin: ${({ theme }) => theme.spacing.xs} 0 0;
  max-height: 220px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  border: 1px solid ${({ theme }) => theme.colors.codeBorder};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colors.codeBg};
  color: ${({ theme }) => theme.colors.codeText};
  font-family: ${({ theme }) => theme.typography.fontFamilyMono};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
`;

const statusLabel: Record<ToolTrace['status'], string> = {
  requested: 'Requested',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
};

const stringifyTrace = (toolTrace: ToolTrace) =>
  JSON.stringify(
    {
      name: toolTrace.name,
      status: toolTrace.status,
      input: toolTrace.input,
      output: toolTrace.output,
      error: toolTrace.error,
      logicalIndex: toolTrace.logicalIndex,
      batchId: toolTrace.batchId,
      batchIndex: toolTrace.batchIndex,
      isConcurrent: toolTrace.isConcurrent,
    },
    null,
    2,
  );

export const ToolView: React.FC<{ tools: TurnTrace['tools'] }> = ({ tools }) => {
  const { copyTone, copyText } = useCopyFeedback();
  if (tools.length === 0) return null;

  return (
    <Section>
      <Header>
        <span>Tool</span>
        <TraceCopyButton
          tone={copyTone}
          idleLabel="Copy"
          onClick={() => {
            void copyText(tools.map(stringifyTrace).join('\n\n'));
          }}
        />
      </Header>
      <List>
        {tools.map((toolTrace) => (
          <Card key={toolTrace.toolCallId}>
            <CardHeader>
              <Name>{toolTrace.name}</Name>
              <Status $status={toolTrace.status}>{statusLabel[toolTrace.status]}</Status>
            </CardHeader>
            <Body>
              <div>
                <Label>Input</Label>
                <Content>{JSON.stringify(toolTrace.input, null, 2)}</Content>
              </div>
              {toolTrace.output ? (
                <div>
                  <Label>Output</Label>
                  <Content>{toolTrace.output}</Content>
                </div>
              ) : null}
              {toolTrace.error ? (
                <div>
                  <Label>Error</Label>
                  <Content>{toolTrace.error}</Content>
                </div>
              ) : null}
            </Body>
          </Card>
        ))}
      </List>
    </Section>
  );
};
