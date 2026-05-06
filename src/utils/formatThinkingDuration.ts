import { messages as appMessages } from '@/i18n';

export const formatThinkingDuration = (durationMs: number) => {
  if (durationMs < 1000) {
    return appMessages.messages.durationMs(Math.max(0, Math.round(durationMs)));
  }

  if (durationMs < 60000) {
    return appMessages.messages.durationS(durationMs / 1000);
  }

  const totalSeconds = Math.floor(durationMs / 1000);
  return appMessages.messages.durationMS(
    Math.floor(totalSeconds / 60),
    totalSeconds % 60,
  );
};
