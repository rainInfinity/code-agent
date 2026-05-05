import { useCallback, useEffect, useMemo, useState } from 'react';
import { TRACE_FOLD_CONFIG } from '@/config/foldConfig';
import { useChatStore } from '@/stores/chatStore';
import type { TurnTrace } from '@/types';
import {
  computeTurnFoldPoint,
  resolveTurnFoldByVisibleTurns,
} from '@/utils/foldUtils';
import type { FoldInfo } from './useMessageFold';

const EMPTY_TURNS: TurnTrace[] = [];

export const useTurnFold = (conversationId?: string | null) => {
  const turns = useChatStore((state) =>
    state.conversations.find((conversation) => conversation.id === conversationId)?.turns ??
    EMPTY_TURNS,
  );

  const defaultFold = useMemo(
    () => computeTurnFoldPoint(turns, TRACE_FOLD_CONFIG),
    [turns],
  );
  const [visibleTurnCount, setVisibleTurnCount] = useState(defaultFold.visibleTurns);

  useEffect(() => {
    setVisibleTurnCount(defaultFold.visibleTurns);
  }, [conversationId]);

  const currentFold = useMemo(
    () =>
      resolveTurnFoldByVisibleTurns(
        turns,
        visibleTurnCount,
        TRACE_FOLD_CONFIG.CHARS_PER_TOKEN,
      ),
    [turns, visibleTurnCount],
  );

  const visibleTurns = useMemo(
    () => turns.slice(currentFold.foldStartIndex),
    [currentFold.foldStartIndex, turns],
  );

  const foldInfo = useMemo<FoldInfo>(
    () => ({
      isFolded: currentFold.foldedTurns > 0,
      foldedTurnCount: currentFold.foldedTurns,
      visibleTurnCount: currentFold.visibleTurns,
      totalTurnCount: currentFold.totalTurns,
      hiddenTokenCount: currentFold.hiddenTokens,
      loadMoreTurnCount: Math.min(
        TRACE_FOLD_CONFIG.LOAD_MORE_TURNS,
        currentFold.foldedTurns,
      ),
    }),
    [currentFold],
  );

  const loadMore = useCallback(() => {
    setVisibleTurnCount((current) =>
      Math.min(current + TRACE_FOLD_CONFIG.LOAD_MORE_TURNS, currentFold.totalTurns),
    );
  }, [currentFold.totalTurns]);

  const expandAll = useCallback(() => {
    setVisibleTurnCount(currentFold.totalTurns);
  }, [currentFold.totalTurns]);

  return {
    turns,
    visibleTurns,
    foldInfo,
    loadMore,
    expandAll,
  };
};
