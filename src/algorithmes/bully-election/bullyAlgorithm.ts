import type { Process, Message, SimulationState, MessageType } from './types.ts';

export class BullyAlgorithm {
  private processCount: number;
  private processes: Process[];
  private messages: Message[] = [];
  private messageLog: string[] = [];
  private currentLeader: number | null = null;
  private timestamp: number = 0;
  private messageId: number = 0;

  constructor(processCount: number = 5) {
    this.processCount = processCount;
    this.processes = this.initializeProcesses(processCount);
    // Le processus avec l'ID le plus grand est le coordinateur initial
    this.currentLeader = processCount - 1;
    this.processes[this.currentLeader].isCoordinator = true;
    this.processes[this.currentLeader].state = 'COORDINATOR';
    this.logMessage(`[INIT] Coordinateur initial: Processus ${this.currentLeader}`);
  }

  private initializeProcesses(count: number): Process[] {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      state: 'IDLE',
      isCoordinator: i === count - 1,
      isFailed: false,
      receivedMessages: [],
      sentMessages: [],
    }));
  }

  private logMessage(msg: string): void {
    this.messageLog.push(`[${this.timestamp}] ${msg}`);
  }

  private createMessage(
    from: number,
    to: number,
    type: MessageType,
    content: string
  ): Message {
    return {
      id: `msg-${this.messageId++}`,
      from,
      to,
      type,
      timestamp: this.timestamp,
      content,
    };
  }

  // Simuler la détection de panne
  simulateProcessFailure(processId: number): void {
    if (processId >= this.processCount || processId < 0) {
      this.logMessage(`[ERREUR] Processus invalide: ${processId}`);
      return;
    }

    this.processes[processId].isFailed = true;
    this.processes[processId].state = 'FAILED';
    this.logMessage(`[PANNE DÉTECTÉE] Processus ${processId} est en panne`);

    // Si le leader tombe en panne, déclencher une élection
    if (this.currentLeader === processId) {
      this.logMessage(`[CRITIQUE] Le coordinateur ${processId} est en panne!`);
      this.currentLeader = null;
    }
  }

  // Démarrer une élection
  startElection(initiatorId: number): void {
    if (this.processes[initiatorId].isFailed) {
      this.logMessage(`[ERREUR] Le processus ${initiatorId} est en panne, il ne peut pas initier l'élection`);
      return;
    }

    this.timestamp++;
    this.logMessage(`[ÉLECTION DÉBUTÉE] Initiée par le processus ${initiatorId}`);
    this.processes[initiatorId].state = 'ELECTION_IN_PROGRESS';

    // Envoyer des messages ELECTION à tous les processus avec un ID supérieur
    const higherProcesses = this.processes
      .filter((p) => p.id > initiatorId && !p.isFailed)
      .map((p) => p.id);

    if (higherProcesses.length === 0) {
      // Aucun processus avec un ID supérieur -> l'initiateur gagne
      this.logMessage(`[RÉSULTAT] Aucun processus supérieur trouvé. Processus ${initiatorId} est le nouveau coordinateur`);
      this.electProcess(initiatorId);
    } else {
      // Envoyer des messages ELECTION aux processus supérieurs
      for (const targetId of higherProcesses) {
        const msg = this.createMessage(initiatorId, targetId, 'ELECTION', 'Participez à l\'élection');
        this.messages.push(msg);
        this.processes[initiatorId].sentMessages.push(msg);
        this.processes[targetId].receivedMessages.push(msg);
        this.logMessage(`[ENVOI] Processus ${initiatorId} -> Processus ${targetId}: MESSAGE ELECTION`);

        // Simuler la réception et la réaction
        if (!this.processes[targetId].isFailed) {
          this.timestamp++;
          const okMsg = this.createMessage(targetId, initiatorId, 'OK', 'Je suis actif');
          this.messages.push(okMsg);
          this.processes[targetId].sentMessages.push(okMsg);
          this.processes[initiatorId].receivedMessages.push(okMsg);
          this.logMessage(`[RÉPONSE] Processus ${targetId} -> Processus ${initiatorId}: MESSAGE OK`);

          // Le processus supérieur démarre sa propre élection
          if (this.processes[targetId].state !== 'ELECTION_IN_PROGRESS') {
            this.timestamp++;
            this.startElectionFrom(targetId);
          }
        }
      }

      // Vérifier après un délai si quelqu'un a répondu
      this.timestamp += 2; // Simuler un délai
      const receivedOk = this.messages.some(
        (m) => m.from !== initiatorId && m.to === initiatorId && m.type === 'OK'
      );

      if (!receivedOk) {
        // Aucune réponse -> l'initiateur gagne
        this.logMessage(`[RÉSULTAT] Aucune réponse reçue. Processus ${initiatorId} est le nouveau coordinateur`);
        this.electProcess(initiatorId);
      }
    }
  }

  private startElectionFrom(processId: number): void {
    if (this.processes[processId].state === 'ELECTION_IN_PROGRESS') {
      return;
    }

    this.processes[processId].state = 'ELECTION_IN_PROGRESS';
    this.logMessage(`[ÉLECTION DÉBUTÉE] Initiée par le processus ${processId}`);

    const higherProcesses = this.processes
      .filter((p) => p.id > processId && !p.isFailed)
      .map((p) => p.id);

    if (higherProcesses.length === 0) {
      // Aucun processus supérieur -> ce processus gagne
      this.logMessage(`[RÉSULTAT] Processus ${processId} est le nouveau coordinateur`);
      this.electProcess(processId);
    } else {
      for (const targetId of higherProcesses) {
        const msg = this.createMessage(processId, targetId, 'ELECTION', 'Participez à l\'élection');
        this.messages.push(msg);
        this.processes[processId].sentMessages.push(msg);
        this.processes[targetId].receivedMessages.push(msg);
        this.logMessage(`[ENVOI] Processus ${processId} -> Processus ${targetId}: MESSAGE ELECTION`);

        if (!this.processes[targetId].isFailed && this.processes[targetId].state !== 'ELECTION_IN_PROGRESS') {
          this.timestamp++;
          const okMsg = this.createMessage(targetId, processId, 'OK', 'Je suis actif');
          this.messages.push(okMsg);
          this.processes[targetId].sentMessages.push(okMsg);
          this.processes[processId].receivedMessages.push(okMsg);
          this.logMessage(`[RÉPONSE] Processus ${targetId} -> Processus ${processId}: MESSAGE OK`);
          this.timestamp++;
          this.startElectionFrom(targetId);
        }
      }

      this.timestamp += 2;
      const receivedOk = this.messages.some(
        (m) => m.from !== processId && m.to === processId && m.type === 'OK'
      );

      if (!receivedOk) {
        this.logMessage(`[RÉSULTAT] Processus ${processId} est le nouveau coordinateur`);
        this.electProcess(processId);
      }
    }
  }

  private electProcess(winnerId: number): void {
    this.timestamp++;
    this.currentLeader = winnerId;
    this.processes[winnerId].isCoordinator = true;
    this.processes[winnerId].state = 'COORDINATOR';

    // Envoyer des messages ELECTED à tous les autres processus (non en panne)
    for (const process of this.processes) {
      if (process.id !== winnerId && !process.isFailed) {
        const msg = this.createMessage(winnerId, process.id, 'ELECTED', `Je suis le coordinateur`);
        this.messages.push(msg);
        this.processes[winnerId].sentMessages.push(msg);
        process.receivedMessages.push(msg);
        this.logMessage(`[ENVOI] Processus ${winnerId} -> Processus ${process.id}: MESSAGE ELECTED`);
        this.timestamp++;
      }
    }

    this.logMessage(`[SUCCÈS] Élection terminée. Nouveau coordinateur: ${winnerId}`);

    // Réinitialiser les états
    for (const process of this.processes) {
      if (!process.isFailed && process.id !== winnerId) {
        process.state = 'IDLE';
        process.isCoordinator = false;
      }
    }
  }

  getState(): SimulationState {
    return {
      processes: this.processes,
      messages: this.messages,
      currentLeader: this.currentLeader,
      electionInProgress: this.processes.some((p) => p.state === 'ELECTION_IN_PROGRESS'),
      messageLog: this.messageLog,
      timestamp: this.timestamp,
    };
  }

  getProcessCount(): number {
    return this.processCount;
  }

  reset(): void {
    this.processes = this.initializeProcesses(this.processCount);
    this.messages = [];
    this.messageLog = [];
    this.currentLeader = this.processCount - 1;
    this.processes[this.currentLeader].isCoordinator = true;
    this.processes[this.currentLeader].state = 'COORDINATOR';
    this.timestamp = 0;
    this.messageId = 0;
    this.logMessage(`[INIT] Simulateur réinitialisé. Coordinateur initial: Processus ${this.currentLeader}`);
  }

  recoverProcess(processId: number): void {
    if (processId >= this.processCount || processId < 0) {
      this.logMessage(`[ERREUR] Processus invalide: ${processId}`);
      return;
    }

    this.processes[processId].isFailed = false;
    this.processes[processId].state = 'IDLE';
    this.logMessage(`[RÉCUPÉRATION] Processus ${processId} est revenu en ligne`);
  }
}
