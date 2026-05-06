import type { Process, Message, SimulationState, MessageType, ProcessState } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Chaque étape de la simulation est représentée par un ElectionStep.
// L'orchestrateur (BullyElectionApp) les rejoue une à une avec un délai
// pour rendre l'animation visible dans le graphe et le journal.
// ─────────────────────────────────────────────────────────────────────────────
export interface ElectionStep {
  type: 'msg' | 'state' | 'win';
  // type === 'msg'
  from?: number;
  to?: number;
  msgType?: MessageType;
  toFailed?: boolean;   // destinataire en panne → le message part mais sans réponse
  // type === 'state'
  id?: number;
  newState?: ProcessState;
  // type === 'win'
  winner?: number;
}

export class BullyAlgorithm {
  private processes: Process[] = [];
  private messages: Message[] = [];
  private currentLeader: number | null = null;
  private timestamp: number = 0;
  private messageId: number = 0;
  private nextProcessId: number = 5;

  constructor(processCount: number = 5) {
    this.processes = this.initProcesses(processCount);
    this.nextProcessId = processCount;
    // Pas de leader initial — l'utilisateur doit déclencher une élection
  }

  // ── Helpers privés ──────────────────────────────────────────────────────────

  private initProcesses(count: number): Process[] {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      state: 'IDLE' as ProcessState,
      isCoordinator: false,
      isFailed: false,
    }));
  }

  private getIndexById(id: number): number {
    return this.processes.findIndex(p => p.id === id);
  }

  private nextMsgId(): string {
    return `msg-${this.messageId++}`;
  }

  private createMessage(
    from: number,
    to: number,
    type: MessageType,
    toFailed = false,
  ): Message {
    return {
      id: this.nextMsgId(),
      from,
      to,
      type,
      toFailed,
      timestamp: ++this.timestamp,
      content: `P${from} → P${to}: ${type}`,
    };
  }

  /** Tous les processus actifs (non en panne) */
  private getActive(): Process[] {
    return this.processes.filter(p => !p.isFailed);
  }

  /** Tous les processus avec id > initiatorId, qu'ils soient en panne ou non */
  private getHigher(initiatorId: number): Process[] {
    return this.processes
      .filter(p => p.id > initiatorId)
      .sort((a, b) => a.id - b.id);
  }

  /** Processus actifs avec id > initiatorId (ceux qui peuvent répondre) */
  private getHigherActive(initiatorId: number): Process[] {
    return this.getHigher(initiatorId).filter(p => !p.isFailed);
  }

  // ── Cœur de l'algorithme de Bully ──────────────────────────────────────────

  /**
   * Construit la séquence complète des étapes pour l'élection initiée par
   * `initiatorId`, selon les règles exactes du Bully Algorithm :
   *
   * 1. L'initiateur envoie ELECTION à TOUS les processus d'ID supérieur
   *    (y compris ceux en panne — ils ne répondront simplement pas).
   * 2. Seuls les actifs répondent OK.
   * 3. L'initiateur se retire (IDLE) si au moins un actif répond.
   * 4. Chaque actif supérieur lance à son tour sa propre élection (récursif).
   * 5. Le processus actif le plus élevé ne trouve aucun actif supérieur →
   *    il gagne et diffuse COORDINATOR à tous les autres processus actifs.
   *
   * `visited` évite les cycles : un processus ne lance l'élection qu'une fois.
   */
  buildElectionSteps(
    initiatorId: number,
    visited: Set<number> = new Set(),
  ): ElectionStep[] {
    if (visited.has(initiatorId)) return [];
    visited.add(initiatorId);

    const steps: ElectionStep[] = [];

    const higher = this.getHigher(initiatorId);           // tous > initiatorId
    const higherActive = higher.filter(p => !p.isFailed); // ceux qui répondent

    if (higher.length === 0) {
      // Aucun processus d'ID supérieur : l'initiateur est directement élu
      steps.push({ type: 'win', winner: initiatorId });
      return steps;
    }

    // Étape 1 : envoyer ELECTION à tous les supérieurs (actifs ET en panne)
    for (const h of higher) {
      steps.push({
        type: 'msg',
        from: initiatorId,
        to: h.id,
        msgType: 'ELECTION',
        toFailed: h.isFailed,
      });
    }

    // Étape 2 : seuls les actifs répondent OK
    for (const h of higherActive) {
      steps.push({
        type: 'msg',
        from: h.id,
        to: initiatorId,
        msgType: 'OK',
        toFailed: false,
      });
    }

    if (higherActive.length === 0) {
      // Tous les supérieurs sont en panne → l'initiateur gagne quand même
      steps.push({ type: 'win', winner: initiatorId });
      return steps;
    }

    // L'initiateur se retire
    steps.push({ type: 'state', id: initiatorId, newState: 'IDLE' });

    // Étape 3 : chaque actif supérieur lance sa propre élection
    for (const h of higherActive) {
      steps.push({ type: 'state', id: h.id, newState: 'ELECTION_IN_PROGRESS' });
      steps.push(...this.buildElectionSteps(h.id, visited));
    }

    return steps;
  }

  // ── API publique ────────────────────────────────────────────────────────────

  /** Lance une élection depuis `initiatorId` et retourne les étapes à rejouer */
  startElection(initiatorId: number): ElectionStep[] {
    const index = this.getIndexById(initiatorId);
    if (index === -1 || this.processes[index].isFailed) return [];

    // Réinitialiser les états (garder les pannes)
    this.processes.forEach(p => {
      if (!p.isFailed) {
        p.state = 'IDLE';
        p.isCoordinator = false;
      }
    });
    this.currentLeader = null;
    this.processes[index].state = 'ELECTION_IN_PROGRESS';

    return this.buildElectionSteps(initiatorId, new Set());
  }

  /**
   * Applique une étape unique à l'état interne.
   * Retourne le Message créé (pour le journal) ou null.
   * Pour 'win', crée en interne tous les messages COORDINATOR et les retourne
   * groupés via un tableau — l'appelant doit donc appeler applyStep et
   * récupérer les messages COORDINATOR séparément via getNewMessages().
   */
  applyStep(step: ElectionStep): Message | null {
    // ── Message échangé ────────────────────────────────────────────────
    if (
      step.type === 'msg' &&
      step.from !== undefined &&
      step.to !== undefined &&
      step.msgType
    ) {
      const msg = this.createMessage(
        step.from,
        step.to,
        step.msgType,
        step.toFailed ?? false,
      );
      this.messages.push(msg);
      return msg;
    }

    // ── Changement d'état d'un processus ──────────────────────────────
    if (step.type === 'state' && step.id !== undefined && step.newState) {
      const idx = this.getIndexById(step.id);
      if (idx !== -1 && !this.processes[idx].isFailed) {
        this.processes[idx].state = step.newState;
      }
    }

    // ── Victoire : émettre les COORDINATOR ────────────────────────────
    if (step.type === 'win' && step.winner !== undefined) {
      const idx = this.getIndexById(step.winner);
      if (idx !== -1) {
        // Effacer l'ancien leader
        if (this.currentLeader !== null) {
          const oldIdx = this.getIndexById(this.currentLeader);
          if (oldIdx !== -1) {
            this.processes[oldIdx].isCoordinator = false;
            this.processes[oldIdx].state = 'IDLE';
          }
        }

        this.currentLeader = step.winner;
        this.processes[idx].isCoordinator = true;
        this.processes[idx].state = 'COORDINATOR';

        // Diffuser COORDINATOR à tous les autres (actifs uniquement)
        this.getActive()
          .filter(p => p.id !== step.winner)
          .forEach(p => {
            const msg = this.createMessage(step.winner!, p.id, 'COORDINATOR');
            this.messages.push(msg);
            const pIdx = this.getIndexById(p.id);
            if (pIdx !== -1) this.processes[pIdx].state = 'IDLE';
          });
      }
    }

    return null;
  }

  /** Récupère les messages COORDINATOR générés lors d'un 'win' (pour le journal) */
  getLastCoordinatorMessages(winnerId: number): Message[] {
    return this.messages.filter(
      m => m.type === 'COORDINATOR' && m.from === winnerId,
    );
  }

  simulateProcessFailure(processId: number): void {
    const index = this.getIndexById(processId);
    if (index === -1) return;
    this.processes[index].isFailed = true;
    this.processes[index].state = 'FAILED';
    this.processes[index].isCoordinator = false;
    if (this.currentLeader === processId) {
      this.currentLeader = null;
    }
  }

  recoverProcess(processId: number): void {
    const index = this.getIndexById(processId);
    if (index === -1) return;
    this.processes[index].isFailed = false;
    this.processes[index].state = 'IDLE';
  }

  addProcess(): void {
    const newId = this.nextProcessId++;
    this.processes.push({
      id: newId,
      state: 'IDLE',
      isCoordinator: false,
      isFailed: false,
    });
  }

  removeProcess(processId: number): void {
    const index = this.getIndexById(processId);
    if (index === -1) return;
    this.processes.splice(index, 1);
    if (this.currentLeader === processId) {
      this.currentLeader = null;
    }
  }

  reset(): void {
    this.processes = this.initProcesses(5);
    this.messages = [];
    this.currentLeader = null;
    this.timestamp = 0;
    this.messageId = 0;
    this.nextProcessId = 5;
  }

  getState(): SimulationState {
    return {
      processes: [...this.processes],
      messages: [...this.messages],
      currentLeader: this.currentLeader,
      electionInProgress: this.processes.some(
        p => p.state === 'ELECTION_IN_PROGRESS',
      ),
      timestamp: this.timestamp,
    };
  }

  getAllProcessIds(): number[] {
    return this.processes.map(p => p.id).sort((a, b) => a - b);
  }

  getProcessCount(): number {
    return this.processes.length;
  }
}