export type ProcessState = {
  id: number;
  isActive: boolean;
  isLeader: boolean;
  isFailed: boolean;
  queue: unknown[];
};

export const MESSAGE_TYPES: {
  readonly ELECTION: 'ELECTION';
  readonly COORDINATOR: 'COORDINATOR';
};

export type MessageType = keyof typeof MESSAGE_TYPES;

export type RingMessage = {
  fromIndex: number;
  toIndex: number;
  type: MessageType;
  value: number;
};

export type HandleMessageResult =
  | { action: 'FORWARD'; newValue: number; log: string }
  | { action: 'REPLACE'; newValue: number; log: string }
  | { action: 'WIN'; newValue: number; log: string }
  | { action: 'FORWARD_COORDINATOR'; newValue: number; log: string }
  | { action: 'STOP'; log: string };

export const INITIAL_PROCESSES: ProcessState[];

export function handleMessage(
  process: ProcessState,
  message: Pick<RingMessage, 'type' | 'value'>
): HandleMessageResult;
