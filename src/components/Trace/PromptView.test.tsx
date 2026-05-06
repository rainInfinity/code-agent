import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { describe, expect, test } from 'vitest';
import { PromptView } from './PromptView';
import { darkTheme } from '@/styles/theme';
import type { TurnTrace } from '@/types';

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={darkTheme}>{ui}</ThemeProvider>);

const prompt: NonNullable<TurnTrace['prompt']> = {
  systemPrompt: 'system prompt',
  messages: [
    {
      role: 'assistant',
      content: '',
      contentBlocks: [
        { type: 'thinking', thinking: 'Need a tool' },
        { type: 'tool_use', id: 'tool-1', name: 'shell', input: { command: 'pwd' } },
      ],
    },
    {
      role: 'user',
      content: '',
      contentBlocks: [
        { type: 'tool_result', toolUseId: 'tool-1', content: '/workspace' },
      ],
    },
  ],
  tools: [],
};

describe('PromptView', () => {
  test('renders non-empty rows for contentBlocks-only messages', async () => {
    const user = userEvent.setup();
    renderWithTheme(<PromptView prompt={prompt} />);

    await user.click(screen.getByRole('button', { name: /prompt/i }));

    expect(screen.getByText(/assistant - Thinking: Need a tool/i)).toBeTruthy();
    expect(screen.getAllByText(/Tool use: shell/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/user - Tool result: \/workspace/i)).toBeTruthy();
  });
});
