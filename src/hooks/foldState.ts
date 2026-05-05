export type ConversationFoldState = {
  hiddenTurnCount: number;
};

export const clampHiddenTurnCount = (
  hiddenTurnCount: number,
  totalTurns: number,
) => {
  if (totalTurns <= 0) return 0;

  return Math.min(Math.max(0, hiddenTurnCount), Math.max(0, totalTurns - 1));
};

export const getVisibleTurnCount = (
  totalTurns: number,
  hiddenTurnCount: number,
) => {
  if (totalTurns <= 0) return 0;

  return Math.max(
    1,
    totalTurns - clampHiddenTurnCount(hiddenTurnCount, totalTurns),
  );
};
