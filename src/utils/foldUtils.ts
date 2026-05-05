import type { FoldConfig } from '@/config/foldConfig';
import type { Message, TurnTrace } from '@/types';

type FoldThresholds = Pick<FoldConfig, 'MAX_VISIBLE_TURNS' | 'TOKEN_BUDGET' | 'CHARS_PER_TOKEN'>;

type TurnSlice = {
  startIndex: number;
  tokens: number;
};

export type FoldComputation = {
  foldStartIndex: number;
  totalTurns: number;
  visibleTurns: number;
  foldedTurns: number;
  hiddenTokens: number;
  totalTokens: number;
};

const EMPTY_FOLD_RESULT: FoldComputation = {
  foldStartIndex: 0,
  totalTurns: 0,
  visibleTurns: 0,
  foldedTurns: 0,
  hiddenTokens: 0,
  totalTokens: 0,
};

export const estimateTokens = (text: string, charsPerToken: number): number => {
  if (!text) return 0;
  return Math.ceil(text.length / Math.max(1, charsPerToken));
};

const getMessageTokenText = (message: Message): string => {
  const toolCallText = (message.toolCalls ?? []).map((toolCall) =>
    `${toolCall.name}\n${JSON.stringify(toolCall.input)}`,
  );
  const toolResultText = (message.toolResults ?? []).flatMap((toolResult) =>
    [toolResult.output, toolResult.error ?? ''].filter(Boolean),
  );

  return [
    message.content,
    message.thinkingContent ?? '',
    ...toolCallText,
    ...toolResultText,
  ]
    .filter(Boolean)
    .join('\n');
};

const getTurnTokenText = (turn: TurnTrace): string => {
  const promptMessages = turn.prompt?.messages.map((message) => message.content) ?? [];

  return [
    turn.prompt?.systemPrompt ?? '',
    ...promptMessages,
    turn.thinking.content,
    turn.response.content,
  ]
    .filter(Boolean)
    .join('\n');
};

const computeFoldForSlices = (
  turnSlices: TurnSlice[],
  maxVisibleTurns: number,
  tokenBudget: number,
): FoldComputation => {
  if (turnSlices.length === 0) return EMPTY_FOLD_RESULT;

  const totalTokens = turnSlices.reduce((sum, turn) => sum + turn.tokens, 0);
  const clampedMaxVisibleTurns = Math.max(1, maxVisibleTurns);
  const clampedTokenBudget = Math.max(0, tokenBudget);
  let visibleTurns = 0;
  let visibleTokens = 0;
  let foldStartIndex = 0;

  for (let index = turnSlices.length - 1; index >= 0; index -= 1) {
    const nextVisibleTurns = visibleTurns + 1;
    const nextVisibleTokens = visibleTokens + turnSlices[index].tokens;
    const exceedsTurnLimit = nextVisibleTurns > clampedMaxVisibleTurns;
    const exceedsTokenBudget =
      clampedTokenBudget > 0 && nextVisibleTokens > clampedTokenBudget;

    if (visibleTurns > 0 && (exceedsTurnLimit || exceedsTokenBudget)) {
      break;
    }

    visibleTurns = nextVisibleTurns;
    visibleTokens = nextVisibleTokens;
    foldStartIndex = turnSlices[index].startIndex;
  }

  const totalTurns = turnSlices.length;
  const foldedTurns = Math.max(0, totalTurns - visibleTurns);

  return {
    foldStartIndex: foldedTurns === 0 ? 0 : foldStartIndex,
    totalTurns,
    visibleTurns,
    foldedTurns,
    hiddenTokens: Math.max(0, totalTokens - visibleTokens),
    totalTokens,
  };
};

const resolveFoldForVisibleTurns = (
  turnSlices: TurnSlice[],
  requestedVisibleTurns: number,
): FoldComputation => {
  if (turnSlices.length === 0) return EMPTY_FOLD_RESULT;

  const totalTurns = turnSlices.length;
  const visibleTurns = Math.min(Math.max(1, requestedVisibleTurns), totalTurns);
  const foldedTurns = Math.max(0, totalTurns - visibleTurns);
  const visibleTurnSlices = turnSlices.slice(totalTurns - visibleTurns);
  const visibleTokens = visibleTurnSlices.reduce((sum, turn) => sum + turn.tokens, 0);
  const totalTokens = turnSlices.reduce((sum, turn) => sum + turn.tokens, 0);

  return {
    foldStartIndex: foldedTurns === 0 ? 0 : visibleTurnSlices[0].startIndex,
    totalTurns,
    visibleTurns,
    foldedTurns,
    hiddenTokens: Math.max(0, totalTokens - visibleTokens),
    totalTokens,
  };
};

const buildMessageTurnSlices = (
  messages: Message[],
  charsPerToken: number,
): TurnSlice[] => {
  if (messages.length === 0) return [];

  const userMessageIndexes = messages.reduce<number[]>((indexes, message, index) => {
    if (message.role === 'user') {
      indexes.push(index);
    }
    return indexes;
  }, []);

  const turnStartIndexes =
    userMessageIndexes.length <= 1
      ? [0]
      : [0, ...userMessageIndexes.slice(1)];

  return turnStartIndexes.map((startIndex, index) => {
    const endIndex = turnStartIndexes[index + 1] ?? messages.length;
    let tokens = 0;

    for (let messageIndex = startIndex; messageIndex < endIndex; messageIndex += 1) {
      tokens += estimateTokens(getMessageTokenText(messages[messageIndex]), charsPerToken);
    }

    return { startIndex, tokens };
  });
};

const buildTraceTurnSlices = (
  turns: TurnTrace[],
  charsPerToken: number,
): TurnSlice[] =>
  turns.map((turn, index) => ({
    startIndex: index,
    tokens: estimateTokens(getTurnTokenText(turn), charsPerToken),
  }));

export const computeMessageFoldPoint = (
  messages: Message[],
  config: FoldThresholds,
): FoldComputation =>
  computeFoldForSlices(
    buildMessageTurnSlices(messages, config.CHARS_PER_TOKEN),
    config.MAX_VISIBLE_TURNS,
    config.TOKEN_BUDGET,
  );

export const resolveMessageFoldByVisibleTurns = (
  messages: Message[],
  visibleTurns: number,
  charsPerToken: number,
): FoldComputation =>
  resolveFoldForVisibleTurns(
    buildMessageTurnSlices(messages, charsPerToken),
    visibleTurns,
  );

export const computeTurnFoldPoint = (
  turns: TurnTrace[],
  config: FoldThresholds,
): FoldComputation =>
  computeFoldForSlices(
    buildTraceTurnSlices(turns, config.CHARS_PER_TOKEN),
    config.MAX_VISIBLE_TURNS,
    config.TOKEN_BUDGET,
  );

export const resolveTurnFoldByVisibleTurns = (
  turns: TurnTrace[],
  visibleTurns: number,
  charsPerToken: number,
): FoldComputation =>
  resolveFoldForVisibleTurns(
    buildTraceTurnSlices(turns, charsPerToken),
    visibleTurns,
  );
