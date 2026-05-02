import styled, { css } from 'styled-components';
import type { ThemeSpacing } from '@/styles/theme';

type FlexDirection = 'row' | 'row-reverse' | 'column' | 'column-reverse';
type FlexAlign = 'stretch' | 'flex-start' | 'center' | 'flex-end' | 'baseline';
type FlexJustify =
  | 'flex-start'
  | 'center'
  | 'flex-end'
  | 'space-between'
  | 'space-around'
  | 'space-evenly';
type FlexWrap = 'nowrap' | 'wrap' | 'wrap-reverse';
type GapValue = keyof ThemeSpacing | string | number;

export interface FlexProps {
  $direction?: FlexDirection;
  $align?: FlexAlign;
  $justify?: FlexJustify;
  $gap?: GapValue;
  $wrap?: FlexWrap;
  $width?: string;
  $minWidth?: string;
  $flex?: string | number;
  $responsive?: boolean;
}

const resolveGap = (gap: GapValue | undefined, spacing: ThemeSpacing) => {
  if (gap === undefined) return undefined;
  if (typeof gap === 'number') return `${gap}px`;
  return gap in spacing ? spacing[gap as keyof ThemeSpacing] : gap;
};

// Thin flex primitives for repeated layout concerns; component-specific visuals stay local.
export const Flex = styled.div<FlexProps>`
  display: flex;
  flex-direction: ${({ $direction = 'row' }) => $direction};
  align-items: ${({ $align = 'stretch' }) => $align};
  justify-content: ${({ $justify = 'flex-start' }) => $justify};
  flex-wrap: ${({ $wrap = 'nowrap' }) => $wrap};
  ${({ theme, $gap }) => {
    const gap = resolveGap($gap, theme.spacing);
    return gap ? css`gap: ${gap};` : undefined;
  }}
  ${({ $width }) => $width && css`width: ${$width};`}
  ${({ $minWidth }) => $minWidth && css`min-width: ${$minWidth};`}
  ${({ $flex }) => $flex !== undefined && css`flex: ${$flex};`}
  ${({ $responsive }) =>
    $responsive &&
    css`
      min-width: 0;
    `}
`;

export const Row = styled(Flex).attrs<FlexProps>(({ $direction }) => ({
  $direction: $direction ?? 'row',
}))``;

export const Column = styled(Flex).attrs<FlexProps>(({ $direction }) => ({
  $direction: $direction ?? 'column',
}))``;

export const Center = styled(Flex).attrs<FlexProps>({
  $align: 'center',
  $justify: 'center',
})``;
