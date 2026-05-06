export type ProcessState = 'IDLE' | 'WANTING' | 'IN_CS' | 'FAILED';

export type MessageType = 'REQUEST' | 'REPLY';

export interface Message {
  id: string;
  type: MessageType;
  from: number;
  to: number;
  timestamp: number;
  clock: number;
  status: 'sending' | 'delivered' | 'pending';
}

export interface ProcessNode {
  id: number;
  state: ProcessState;
  clock: number;
  requestClock: number | null;
  repliesReceived: number[];
  deferredReplies: number[];
  inCS: boolean;
  failed: boolean;
}

export interface Event {
  id: string;
  time: number;
  processId: number;
  type: 'REQUEST_SENT' | 'REPLY_SENT' | 'REPLY_RECEIVED' | 'ENTERED_CS' | 'EXITED_CS' | 'DEFERRED' | 'FAILED' | 'RECOVERED';
  description: string;
  clock: number;
}

export interface AlgorithmState {
  processes: ProcessNode[];
  messages: Message[];
  events: Event[];
  step: number;
  isRunning: boolean;
  speed: number;
}