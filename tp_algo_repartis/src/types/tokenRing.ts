// types/tokenRing.ts

export type ProcessState = 'idle' | 'waiting' | 'critical' | 'done';

export interface Process {
  id: number;
  state: ProcessState;
  hasToken: boolean;
  wantsAccess: boolean;
}

export interface TokenRingEvent {
  timestamp: number;
  type:
    | 'TOKEN_SENT'
    | 'TOKEN_RECEIVED'
    | 'ENTER_CS'
    | 'EXIT_CS'
    | 'REQUEST_ACCESS'
    | 'PASS_TOKEN';
  from: number;
  to?: number;
  message: string;
}

export interface TokenRingState {
  processes: Process[];
  events: TokenRingEvent[];
  currentTokenHolder: number;
  messageCount: number;
  step: number;
  isRunning: boolean;
  isFinished: boolean;
  animatingArc: { from: number; to: number } | null;
  wantsAccessConfig: boolean[]; // config choisie par l'utilisateur [P0, P1, P2]
}