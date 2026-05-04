import { useCallback, useState } from 'react';

export type CopyTone = 'idle' | 'success' | 'error';

export function useCopyFeedback() {
  const [copyTone, setCopyTone] = useState<CopyTone>('idle');

  const copyText = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopyTone('success');
    } catch {
      setCopyTone('error');
    }

    window.setTimeout(() => {
      setCopyTone('idle');
    }, 1600);
  }, []);

  return { copyTone, copyText };
}
