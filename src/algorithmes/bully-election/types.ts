export type ProcessState = 'IDLE' | 'ELECTION_IN_PROGRESS' | 'COORDINATOR' | 'FAILED';

// Trois types de messages selon l'algorithme de Bully :
// ELECTION  → envoyé aux processus d'ID supérieur
// OK        → réponse d'un supérieur à l'initiateur
// COORDINATOR → diffusé par le gagnant à tous les autres
export type MessageType = 'ELECTION' | 'OK' | 'COORDINATOR';

export interface Process {
  id: number;
  state: ProcessState;
  isCoordinator: boolean;
  isFailed: boolean;
}

export interface Message {
  id: string;
  from: number;
  to: number;
  type: MessageType;
  /** true si le destinataire est en panne (pas de réponse attendue) */
  toFailed?: boolean;
  timestamp: number;
  content: string;
}

export interface SimulationState {
  processes: Process[];
  messages: Message[];
  currentLeader: number | null;
  electionInProgress: boolean;
  timestamp: number;
}