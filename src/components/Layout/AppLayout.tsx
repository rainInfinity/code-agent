import styled from 'styled-components';

export const LayoutContainer = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  width: 100vw;
  overflow: hidden;
  background-color: ${({ theme }) => theme.colors.bgPrimary};
`;

export const AppFrame = styled.div`
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: ${({ theme }) => theme.colors.bgPrimary};
`;

export const MainArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
`;

export const ContentArea = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;
