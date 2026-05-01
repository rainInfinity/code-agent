import React from 'react';
import styled, { keyframes } from 'styled-components';
import { FaTerminal, FaCode, FaFileCode, FaWandMagicSparkles } from 'react-icons/fa6';

const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing['3xl']};
  text-align: center;
  gap: ${({ theme }) => theme.spacing.xl};
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
`;

const AnimatedContent = styled.div`
  animation: ${fadeIn} 0.5s ease-out;
`;

const IconGroup = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const IconCircle = styled.div`
  width: 48px;
  height: 48px;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg,
    ${({ theme }) => theme.colors.accentPrimary}20,
    ${({ theme }) => theme.colors.accentSecondary}20
  );
  color: ${({ theme }) => theme.colors.accentPrimary};
  font-size: 20px;
  border: 1px solid ${({ theme }) => theme.colors.borderSubtle};
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.typography.fontSize['2xl']};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const Subtitle = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  color: ${({ theme }) => theme.colors.textSecondary};
  max-width: 480px;
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
`;

const SuggestionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${({ theme }) => theme.spacing.sm};
  max-width: 560px;
  width: 100%;
  margin-top: ${({ theme }) => theme.spacing.lg};
`;

const SuggestionCard = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  background-color: ${({ theme }) => theme.colors.bgSecondary};
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  text-align: left;
  transition: all ${({ theme }) => theme.transitions.fast};
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accentPrimary};
    color: ${({ theme }) => theme.colors.textPrimary};
    background-color: ${({ theme }) => theme.colors.bgTertiary};
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const SuggestionIcon = styled.div`
  color: ${({ theme }) => theme.colors.accentPrimary};
  flex-shrink: 0;
`;

interface WelcomeScreenProps {
  onSuggestionClick: (text: string) => void;
}

const suggestions = [
  { icon: FaCode, text: 'Explain this code snippet' },
  { icon: FaTerminal, text: 'Write a bash script' },
  { icon: FaFileCode, text: 'Refactor this function' },
  { icon: FaWandMagicSparkles, text: 'Generate unit tests' },
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSuggestionClick }) => {
  return (
    <Container>
      <AnimatedContent>
        <IconGroup>
          <IconCircle>
            <FaTerminal />
          </IconCircle>
        </IconGroup>
        <Title>Code Agent</Title>
        <Subtitle>
          Your AI-powered coding assistant. Ask questions, generate code,
          debug issues, or explore new ideas.
        </Subtitle>

        <SuggestionsGrid>
          {suggestions.map((s, i) => (
            <SuggestionCard key={i} onClick={() => onSuggestionClick(s.text)}>
              <SuggestionIcon>
                <s.icon size={14} />
              </SuggestionIcon>
              {s.text}
            </SuggestionCard>
          ))}
        </SuggestionsGrid>
      </AnimatedContent>
    </Container>
  );
};
