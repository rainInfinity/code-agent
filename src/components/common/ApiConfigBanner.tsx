import React from 'react';
import styled, { keyframes } from 'styled-components';
import { FaKey, FaArrowRight } from 'react-icons/fa6';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Banner = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
  background: linear-gradient(90deg,
    ${({ theme }) => theme.colors.warning}15,
    ${({ theme }) => theme.colors.warning}05
  );
  border-bottom: 1px solid ${({ theme }) => theme.colors.warning}30;
  animation: ${fadeIn} 300ms ease-out;
`;

const IconWrapper = styled.div`
  color: ${({ theme }) => theme.colors.warning};
  display: flex;
  align-items: center;
`;

const BannerText = styled.span`
  flex: 1;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const ConfigButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.warning};
  color: #fff;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  transition: all ${({ theme }) => theme.transitions.fast};

  &:hover {
    opacity: 0.9;
    transform: translateX(2px);
  }
`;

interface ApiConfigBannerProps {
  onOpenSettings: () => void;
}

export const ApiConfigBanner: React.FC<ApiConfigBannerProps> = ({ onOpenSettings }) => {
  return (
    <Banner>
      <IconWrapper>
        <FaKey size={14} />
      </IconWrapper>
      <BannerText>
        API key not configured. Add your Anthropic API key to start chatting.
      </BannerText>
      <ConfigButton onClick={onOpenSettings}>
        Configure <FaArrowRight size={10} />
      </ConfigButton>
    </Banner>
  );
};
