export type FoldConfig = {
  MAX_VISIBLE_TURNS: number;
  TOKEN_BUDGET: number;
  LOAD_MORE_TURNS: number;
  CHARS_PER_TOKEN: number;
};

export const CHAT_FOLD_CONFIG: FoldConfig = {
  MAX_VISIBLE_TURNS: 5,
  TOKEN_BUDGET: 2_048,
  LOAD_MORE_TURNS: 5,
  CHARS_PER_TOKEN: 4,
};

export const TRACE_FOLD_CONFIG: FoldConfig = {
  MAX_VISIBLE_TURNS: 5,
  TOKEN_BUDGET: 32_000,
  LOAD_MORE_TURNS: 5,
  CHARS_PER_TOKEN: 4,
};
