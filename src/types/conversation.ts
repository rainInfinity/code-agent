import type { Message } from './message';
import type { TurnTrace } from './trace';

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  turns: TurnTrace[];
  turnsCleared?: boolean;
  createdAt: number;
  updatedAt: number;
  workDir?: string;
}
