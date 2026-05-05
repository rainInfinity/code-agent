import { useCallback, useEffect, useMemo, useState } from 'react';
import { CHAT_FOLD_CONFIG } from '@/config/foldConfig';
import { useChatStore } from '@/stores/chatStore';
import type { Message } from '@/types';
import {
  computeMessageFoldPoint,
  resolveMessageFoldByVisibleTurns,
} from '@/utils/foldUtils';
import {
  clampHiddenTurnCount,
  getVisibleTurnCount,
  type ConversationFoldState,
} from './foldState';

const EMPTY_MESSAGES: Message[] = [];

export type FoldInfo = {
  isFolded: boolean;
  foldedTurnCount: number;
  visibleTurnCount: number;
  totalTurnCount: number;
  hiddenTokenCount: number;
  loadMoreTurnCount: number;
};

export const useMessageFold = (conversationId?: string | null) => {
  const conversations = useChatStore((state) => state.conversations);
  const conversation = useMemo(
    () => conversations.find((item) => item.id === conversationId),
    [conversationId, conversations],
  );
  const conversationIds = useMemo(
    () => conversations.map((item) => item.id),
    [conversations],
  );
  const messages = conversation?.messages ?? EMPTY_MESSAGES;

  const defaultFold = useMemo(
    () => computeMessageFoldPoint(messages, CHAT_FOLD_CONFIG),
    [messages],
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
      resolveMessageFoldByVisibleTurns(
        messages,
        getVisibleTurnCount(defaultFold.totalTurns, hiddenTurnCount),
        CHAT_FOLD_CONFIG.CHARS_PER_TOKEN,
      ),
    [defaultFold.totalTurns, hiddenTurnCount, messages],
  );

  const visibleMessages = useMemo(
    () => messages.slice(currentFold.foldStartIndex),
    [currentFold.foldStartIndex, messages],
  );

  const foldInfo = useMemo<FoldInfo>(
    () => ({
      isFolded: currentFold.foldedTurns > 0,
      foldedTurnCount: currentFold.foldedTurns,
      visibleTurnCount: currentFold.visibleTurns,
      totalTurnCount: currentFold.totalTurns,
      hiddenTokenCount: currentFold.hiddenTokens,
      loadMoreTurnCount: Math.min(
        CHAT_FOLD_CONFIG.LOAD_MORE_TURNS,
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
        currentHiddenTurnCount - CHAT_FOLD_CONFIG.LOAD_MORE_TURNS,
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
    messages,
    visibleMessages,
    foldInfo,
    loadMore,
    expandAll,
  };
};
