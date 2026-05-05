import { useCallback, useEffect, useMemo, useState } from 'react';
import { CHAT_FOLD_CONFIG } from '@/config/foldConfig';
import { useChatStore } from '@/stores/chatStore';
import type { Message } from '@/types';
import {
  computeMessageFoldPoint,
  resolveMessageFoldByVisibleTurns,
} from '@/utils/foldUtils';

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
  const messages = useChatStore((state) =>
    state.conversations.find((conversation) => conversation.id === conversationId)?.messages ??
    EMPTY_MESSAGES,
  );

  const defaultFold = useMemo(
    () => computeMessageFoldPoint(messages, CHAT_FOLD_CONFIG),
    [messages],
  );
  const [visibleTurnCount, setVisibleTurnCount] = useState(defaultFold.visibleTurns);

  useEffect(() => {
    setVisibleTurnCount(defaultFold.visibleTurns);
  }, [conversationId]);

  const currentFold = useMemo(
    () =>
      resolveMessageFoldByVisibleTurns(
        messages,
        visibleTurnCount,
        CHAT_FOLD_CONFIG.CHARS_PER_TOKEN,
      ),
    [messages, visibleTurnCount],
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
    setVisibleTurnCount((current) =>
      Math.min(current + CHAT_FOLD_CONFIG.LOAD_MORE_TURNS, currentFold.totalTurns),
    );
  }, [currentFold.totalTurns]);

  const expandAll = useCallback(() => {
    setVisibleTurnCount(currentFold.totalTurns);
  }, [currentFold.totalTurns]);

  return {
    messages,
    visibleMessages,
    foldInfo,
    loadMore,
    expandAll,
  };
};
