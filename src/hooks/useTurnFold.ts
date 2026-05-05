import { useCallback, useEffect, useMemo, useState } from 'react';
import { TRACE_FOLD_CONFIG } from '@/config/foldConfig';
import { useChatStore } from '@/stores/chatStore';
import type { TurnTrace } from '@/types';
import {
  computeTurnFoldPoint,
  resolveTurnFoldByVisibleTurns,
} from '@/utils/foldUtils';
import type { FoldInfo } from './useMessageFold';
import {
  clampHiddenTurnCount,
  getVisibleTurnCount,
  type ConversationFoldState,
} from './foldState';

const EMPTY_TURNS: TurnTrace[] = [];

export const useTurnFold = (conversationId?: string | null) => {
  const conversations = useChatStore((state) => state.conversations);
  const conversation = useMemo(
    () => conversations.find((item) => item.id === conversationId),
    [conversationId, conversations],
  );
  const conversationIds = useMemo(
    () => conversations.map((item) => item.id),
    [conversations],
  );
  const turns = conversation?.turns ?? EMPTY_TURNS;

  const defaultFold = useMemo(
    () => computeTurnFoldPoint(turns, TRACE_FOLD_CONFIG),
    [turns],
  );
  const [foldStates, setFoldStates] = useState<
    Record<string, ConversationFoldState>
  >({});
  const rememberedState = conversationId ? foldStates[conversationId] : undefined;
  const hiddenTurnCount = clampHiddenTurnCount(
    rememberedState?.hiddenTurnCount ?? defaultFold.foldedTurns,
    defaultFold.totalTurns,
  );

  useEffect(() => {
    setFoldStates((current) => {
      if (Object.keys(current).length === 0) return current;

      const next = Object.fromEntries(
        Object.entries(current).filter(([id]) => conversationIds.includes(id)),
      );

      return Object.keys(next).length === Object.keys(current).length
        ? current
        : next;
    });
  }, [conversationIds]);

  useEffect(() => {
    if (!conversationId) return;

    if (defaultFold.totalTurns === 0) {
      setFoldStates((current) => {
        if (!current[conversationId]) return current;

        const { [conversationId]: _removed, ...next } = current;
        return next;
      });
      return;
    }

    setFoldStates((current) => {
      const existingState = current[conversationId];
      const nextHiddenTurnCount = existingState
        ? clampHiddenTurnCount(existingState.hiddenTurnCount, defaultFold.totalTurns)
        : defaultFold.foldedTurns;

      if (existingState?.hiddenTurnCount === nextHiddenTurnCount) {
        return current;
      }

      return {
        ...current,
        [conversationId]: { hiddenTurnCount: nextHiddenTurnCount },
      };
    });
  }, [conversationId, defaultFold.foldedTurns, defaultFold.totalTurns]);

  const currentFold = useMemo(
    () =>
      resolveTurnFoldByVisibleTurns(
        turns,
        getVisibleTurnCount(defaultFold.totalTurns, hiddenTurnCount),
        TRACE_FOLD_CONFIG.CHARS_PER_TOKEN,
      ),
    [defaultFold.totalTurns, hiddenTurnCount, turns],
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
    if (!conversationId || currentFold.totalTurns === 0) return;

    setFoldStates((current) => {
      const existingState = current[conversationId];
      const currentHiddenTurnCount = clampHiddenTurnCount(
        existingState?.hiddenTurnCount ?? defaultFold.foldedTurns,
        currentFold.totalTurns,
      );
      const nextHiddenTurnCount = Math.max(
        0,
        currentHiddenTurnCount - TRACE_FOLD_CONFIG.LOAD_MORE_TURNS,
      );

      if (existingState?.hiddenTurnCount === nextHiddenTurnCount) {
        return current;
      }

      return {
        ...current,
        [conversationId]: { hiddenTurnCount: nextHiddenTurnCount },
      };
    });
  }, [conversationId, currentFold.totalTurns, defaultFold.foldedTurns]);

  const expandAll = useCallback(() => {
    if (!conversationId || currentFold.totalTurns === 0) return;

    setFoldStates((current) => {
      if (current[conversationId]?.hiddenTurnCount === 0) {
        return current;
      }

      return {
        ...current,
        [conversationId]: { hiddenTurnCount: 0 },
      };
    });
  }, [conversationId, currentFold.totalTurns]);

  return {
    turns,
    visibleTurns,
    foldInfo,
    loadMore,
    expandAll,
  };
};
