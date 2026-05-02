import React, { useCallback } from 'react';
import styled from 'styled-components';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FaCopy, FaCheck } from 'react-icons/fa6';
import { messages } from '@/i18n';

// ─── Styled Components for Markdown ─────────────────────────

const MarkdownContainer = styled.div`
  word-wrap: break-word;
  overflow-wrap: break-word;

  p {
    margin-bottom: ${({ theme }) => theme.spacing.sm};
    &:last-child { margin-bottom: 0; }
  }

  h1, h2, h3, h4, h5, h6 {
    margin-top: ${({ theme }) => theme.spacing.lg};
    margin-bottom: ${({ theme }) => theme.spacing.sm};
    font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
    color: ${({ theme }) => theme.colors.textPrimary};
  }

  h1 { font-size: ${({ theme }) => theme.typography.fontSize['2xl']}; }
  h2 { font-size: ${({ theme }) => theme.typography.fontSize.xl}; }
  h3 { font-size: ${({ theme }) => theme.typography.fontSize.lg}; }

  ul, ol {
    margin-bottom: ${({ theme }) => theme.spacing.sm};
    padding-left: ${({ theme }) => theme.spacing.xl};
  }

  li {
    margin-bottom: ${({ theme }) => theme.spacing.xs};
  }

  blockquote {
    border-left: 3px solid ${({ theme }) => theme.colors.accentPrimary};
    padding-left: ${({ theme }) => theme.spacing.lg};
    margin: ${({ theme }) => theme.spacing.sm} 0;
    color: ${({ theme }) => theme.colors.textSecondary};
  }

  hr {
    border: none;
    border-top: 1px solid ${({ theme }) => theme.colors.divider};
    margin: ${({ theme }) => theme.spacing.lg} 0;
  }

  table {
    border-collapse: collapse;
    width: 100%;
    margin: ${({ theme }) => theme.spacing.sm} 0;

    th, td {
      border: 1px solid ${({ theme }) => theme.colors.border};
      padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
      text-align: left;
      font-size: ${({ theme }) => theme.typography.fontSize.sm};
    }

    th {
      background-color: ${({ theme }) => theme.colors.bgTertiary};
      font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
    }

    tr:nth-child(even) td {
      background-color: ${({ theme }) => theme.colors.bgSecondary};
    }
  }

  a {
    color: ${({ theme }) => theme.colors.accentPrimary};
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }

  code:not(pre code) {
    background-color: ${({ theme }) => theme.colors.codeBg};
    border: 1px solid ${({ theme }) => theme.colors.codeBorder};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    padding: 1px 6px;
    font-size: 0.9em;
    font-family: ${({ theme }) => theme.typography.fontFamilyMono};
  }

  strong {
    font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  }
`;

const CodeBlockWrapper = styled.div`
  position: relative;
  margin: ${({ theme }) => theme.spacing.sm} 0;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.codeBorder};
`;

const CodeHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  background-color: ${({ theme }) => theme.colors.bgTertiary};
  border-bottom: 1px solid ${({ theme }) => theme.colors.codeBorder};
`;

const LanguageLabel = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.textTertiary};
  font-family: ${({ theme }) => theme.typography.fontFamilyMono};
  text-transform: lowercase;
`;

const CopyButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: 2px ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.textTertiary};
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover {
    color: ${({ theme }) => theme.colors.textPrimary};
    background-color: ${({ theme }) => theme.colors.bgActive};
  }
`;

// ─── Component ──────────────────────────────────────────────

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <MarkdownContainer>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: ({ className, children }) => {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            const isInline = !match && !String(children).includes('\n');

            if (isInline) {
              return <code className={className}>{children}</code>;
            }

            return (
              <CodeBlock language={match?.[1] ?? 'text'} code={codeString} />
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </MarkdownContainer>
  );
};

// ─── Code Block Sub-component ───────────────────────────────

const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <CodeBlockWrapper>
      <CodeHeader>
        <LanguageLabel>{language}</LanguageLabel>
        <CopyButton onClick={handleCopy} aria-label={messages.messages.code.copy}>
          {copied ? <FaCheck size={11} /> : <FaCopy size={11} />}
          {copied ? messages.messages.code.copied : messages.messages.code.copy}
        </CopyButton>
      </CodeHeader>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: '13px',
          lineHeight: '1.5',
        }}
        showLineNumbers={false}
      >
        {code}
      </SyntaxHighlighter>
    </CodeBlockWrapper>
  );
};
