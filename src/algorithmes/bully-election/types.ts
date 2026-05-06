// Types pour le Bully Algorithm

export type MessageType = 'ELECTION' | 'OK' | 'ELECTED';

export interface Message {
  id: string;
  from: number;
  to: number;
  type: MessageType;
  timestamp: number;
  content: string;
}

export type ProcessState = 'IDLE' | 'ELECTION_IN_PROGRESS' | 'COORDINATOR' | 'FAILED';

export interface Process {
  id: number;
  state: ProcessState;
  isCoordinator: boolean;
  isFailed: boolean;
  receivedMessages: Message[];
  sentMessages: Message[];
}

export interface SimulationState {
  processes: Process[];
  messages: Message[];
  currentLeader: number | null;
  electionInProgress: boolean;
  messageLog: string[];
  timestamp: number;
}

export interface MessageExchange {
  from: number;
  to: number;
  type: MessageType;
  timestamp: number;
}
