// algorithmes/tokenRing.ts

import type { Process, TokenRingEvent, TokenRingState } from '../types/tokenRing';

const NUM_PROCESSES = 3;

export function initTokenRingState(wantsAccessConfig: boolean[] = [false, false, false]): TokenRingState {
  const processes: Process[] = Array.from({ length: NUM_PROCESSES }, (_, i) => ({
    id: i,
    state: 'idle',
    hasToken: i === 0, // P0 démarre toujours avec le jeton
    wantsAccess: false,
  }));

  const initialEvent: TokenRingEvent = {
    timestamp: Date.now(),
    type: 'TOKEN_RECEIVED',
    from: -1,
    to: 0,
    message: 'Initialisation — P0 détient le jeton',
  };

  return {
    processes,
    events: [initialEvent],
    currentTokenHolder: 0,
    messageCount: 0,
    step: 0,
    isRunning: false,
    isFinished: false,
    animatingArc: null,
    wantsAccessConfig,
  };
}

type StepFn = (state: TokenRingState) => TokenRingState;

/**
 * Génère dynamiquement les étapes selon la configuration choisie par l'utilisateur.
 * wantsAccess[i] = true si le processus Pi veut accéder à la SC.
 *
 * Déroulement Token Ring :
 *  1. Annonce de qui veut accéder (REQUEST_ACCESS pour chaque Pi qui veut)
 *  2. Circulation du jeton P0 → P1 → P2 → P0
 *     - Si Pi a le jeton ET veut accéder → ENTER_CS → EXIT_CS → passe le jeton
 *     - Si Pi a le jeton ET ne veut PAS → TOKEN_RECEIVED (passe) → TOKEN_SENT
 *  3. Fin après un tour complet de l'anneau
 */
export function generateSteps(wantsAccess: boolean[]): StepFn[] {
  const steps: StepFn[] = [];

  // ── Phase 1 : annonces des demandes ────────────────────────────────────
  wantsAccess.forEach((wants, id) => {
    if (wants) {
      steps.push((state) => {
        const procs = state.processes.map((p: Process) =>
          p.id === id ? { ...p, wantsAccess: true, state: 'waiting' as const } : p
        );
        const event: TokenRingEvent = {
          timestamp: Date.now(),
          type: 'REQUEST_ACCESS',
          from: id,
          message: `P${id} demande l'accès à la ressource partagée`,
        };
        return {
          ...state,
          processes: procs,
          events: [...state.events, event],
          step: state.step + 1,
          animatingArc: null,
        };
      });
    }
  });

  // ── Phase 2 : circulation du jeton (un tour complet) ───────────────────
  // L'anneau : 0 → 1 → 2 → 0
  const ring = [0, 1, 2];

  ring.forEach((id) => {
    const next = (id + 1) % NUM_PROCESSES;

    if (wantsAccess[id]) {
      // Ce processus veut accéder → ENTER_CS
      steps.push((state) => {
        const procs = state.processes.map((p: Process) =>
          p.id === id ? { ...p, state: 'critical' as const } : p
        );
        const event: TokenRingEvent = {
          timestamp: Date.now(),
          type: 'ENTER_CS',
          from: id,
          message: `P${id} possède le jeton et entre en Section Critique`,
        };
        return {
          ...state,
          processes: procs,
          events: [...state.events, event],
          step: state.step + 1,
          animatingArc: null,
        };
      });

      // EXIT_CS
      steps.push((state) => {
        const procs = state.processes.map((p: Process) =>
          p.id === id ? { ...p, state: 'done' as const, wantsAccess: false } : p
        );
        const event: TokenRingEvent = {
          timestamp: Date.now(),
          type: 'EXIT_CS',
          from: id,
          message: `P${id} quitte la Section Critique`,
        };
        return {
          ...state,
          processes: procs,
          events: [...state.events, event],
          step: state.step + 1,
          animatingArc: null,
        };
      });
    } else {
      // Ce processus ne veut pas accéder → reçoit et passe
      steps.push((state) => {
        const event: TokenRingEvent = {
          timestamp: Date.now(),
          type: 'TOKEN_RECEIVED',
          from: (id - 1 + NUM_PROCESSES) % NUM_PROCESSES,
          to: id,
          message: `P${id} reçoit le jeton — pas de besoin d'accès, il le passe`,
        };
        return {
          ...state,
          events: [...state.events, event],
          step: state.step + 1,
          animatingArc: null,
        };
      });
    }

    // Passage du jeton au suivant (toujours, sauf si c'est le dernier tour)
    const isLast = id === ring[ring.length - 1];
    steps.push((state) => {
      const procs = state.processes.map((p: Process) => {
        if (p.id === id)   return { ...p, hasToken: false };
        if (p.id === next) return { ...p, hasToken: true };
        return p;
      });
      const event: TokenRingEvent = {
        timestamp: Date.now(),
        type: 'TOKEN_SENT',
        from: id,
        to: next,
        message: `P${id} envoie le jeton à P${next} (+1 message)${isLast ? ' — anneau complété' : ''}`,
      };
      return {
        ...state,
        processes: procs,
        events: [...state.events, event],
        currentTokenHolder: next,
        messageCount: state.messageCount + 1,
        step: state.step + 1,
        isFinished: isLast,
        animatingArc: { from: id, to: next },
      };
    });
  });

  return steps;
}

export function nextStep(
  state: TokenRingState,
  steps: StepFn[]
): TokenRingState {
  if (state.step >= steps.length) return { ...state, isFinished: true };
  return steps[state.step](state);
}