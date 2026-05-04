import { useEffect } from 'react';
import {
  onAgentComplete,
  onAgentTurn,
  onStreamDelta,
  onThinkingDelta,
  onTraceConversationChanged,
  onTracePrompt,
  onTraceThinkingEnd,
  onTraceThinkingStart,
} from '@/hooks/useIpc';
import { useTraceStore } from '@/stores/traceStore';

const TRACE_FLUSH_INTERVAL_MS = 50;

export function useTraceIpc() {
  useEffect(() => {
    let disposed = false;
    let cleanup: Array<() => void> = [];
    let flushTimer: number | undefined;
    const thinkingBuffer = new Map<string, string>();
    const responseBuffer = new Map<string, string>();

    const flushBuffers = () => {
      flushTimer = undefined;
      const store = useTraceStore.getState();
      thinkingBuffer.forEach((delta, key) => {
        const [conversationId, messageId] = key.split('|');
        store.appendThinking({ conversationId, messageId, delta });
      });
      responseBuffer.forEach((delta, key) => {
        const [conversationId, messageId] = key.split('|');
        store.appendResponse({ conversationId, messageId, delta });
      });
      thinkingBuffer.clear();
      responseBuffer.clear();
    };

    const flushNow = () => {
      if (flushTimer !== undefined) {
        window.clearTimeout(flushTimer);
      }
      flushBuffers();
    };

    const scheduleFlush = () => {
      if (flushTimer !== undefined) return;
      flushTimer = window.setTimeout(flushBuffers, TRACE_FLUSH_INTERVAL_MS);
    };

    const appendBuffered = (
      buffer: Map<string, string>,
      conversationId: string,
      messageId: string,
      delta: string,
    ) => {
      const key = `${conversationId}|${messageId}`;
      buffer.set(key, `${buffer.get(key) ?? ''}${delta}`);
      scheduleFlush();
    };

    const install = async () => {
      cleanup = await Promise.all([
        onTraceConversationChanged((event) => useTraceStore.getState().reset(event.conversationId)),
        onAgentTurn((event) => useTraceStore.getState().startTurn(event)),
        onTracePrompt((event) => useTraceStore.getState().addPrompt(event)),
        onTraceThinkingStart((event) => useTraceStore.getState().startThinking(event)),
        onTraceThinkingEnd((event) => {
          flushNow();
          useTraceStore.getState().endThinking(event);
        }),
        onThinkingDelta((event) =>
          appendBuffered(thinkingBuffer, event.conversationId, event.messageId, event.delta),
        ),
        onStreamDelta((event) =>
          appendBuffered(responseBuffer, event.conversationId, event.messageId, event.delta),
        ),
        onAgentComplete((event) => {
          flushNow();
          useTraceStore.getState().endTurn(event);
        }),
      ]);

      if (disposed) {
        cleanup.forEach((unlisten) => unlisten());
        cleanup = [];
      }
    };

    install().catch(() => {
      cleanup = [];
    });

    return () => {
      disposed = true;
      if (flushTimer !== undefined) {
        window.clearTimeout(flushTimer);
      }
      flushBuffers();
      cleanup.forEach((unlisten) => unlisten());
    };
  }, []);
}
