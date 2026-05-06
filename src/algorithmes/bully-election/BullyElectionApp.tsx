import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BullyAlgorithm } from './bullyAlgorithm';
import { ProcessGraph } from './ProcessGraph';
import { MessageLog } from './MessageLog';
import { Controls } from './Controls';
import type { SimulationState, Message } from './types';
import './styles.css';

const STEP_DELAY_MS = 350;

const BullyElectionApp: React.FC = () => {
  const navigate = useNavigate();
  const [algorithm] = useState(() => new BullyAlgorithm(5));
  const [state, setState] = useState<SimulationState>(algorithm.getState());
  const [logMessages, setLogMessages] = useState<Message[]>([]);
  const stepTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncState = useCallback(() => {
    setState(algorithm.getState());
  }, [algorithm]);

  const cancelPending = useCallback(() => {
    if (stepTimeoutRef.current !== null) {
      clearTimeout(stepTimeoutRef.current);
      stepTimeoutRef.current = null;
    }
  }, []);

  /**
   * Rejoue les étapes une à une avec un délai pour rendre visible
   * l'animation dans le graphe et le journal des messages.
   *
   * Cas particulier pour 'win' : applyStep génère en interne tous les
   * messages COORDINATOR → on les récupère et on les ajoute au journal.
   */
  const playSteps = useCallback(
    (
      steps: ReturnType<typeof algorithm.buildElectionSteps>,
      index: number = 0,
    ) => {
      if (index >= steps.length) {
        syncState();
        return;
      }

      const step = steps[index];
      const msgFromStep = algorithm.applyStep(step);

      if (step.type === 'msg' && msgFromStep) {
        // Message simple (ELECTION ou OK) — on l'ajoute au journal
        setLogMessages(prev => [...prev, msgFromStep]);
      } else if (step.type === 'win' && step.winner !== undefined) {
        // Victoire : récupérer tous les COORDINATOR générés
        const coordMsgs = algorithm.getLastCoordinatorMessages(step.winner);
        setLogMessages(prev => [...prev, ...coordMsgs]);
      }

      syncState();

      stepTimeoutRef.current = setTimeout(
        () => playSteps(steps, index + 1),
        STEP_DELAY_MS,
      );
    },
    [algorithm, syncState],
  );

  const handleStartElection = useCallback(
    (processId: number) => {
      cancelPending();
      const steps = algorithm.startElection(processId);
      syncState();
      playSteps(steps);
    },
    [algorithm, cancelPending, syncState, playSteps],
  );

  const handleSimulateFailure = useCallback(
    (processId: number) => {
      cancelPending();
      algorithm.simulateProcessFailure(processId);
      syncState();
    },
    [algorithm, cancelPending, syncState],
  );

  const handleRecoverProcess = useCallback(
    (processId: number) => {
      algorithm.recoverProcess(processId);
      syncState();
    },
    [algorithm, syncState],
  );

  const handleAddProcess = useCallback(() => {
    algorithm.addProcess();
    syncState();
  }, [algorithm, syncState]);

  const handleRemoveProcess = useCallback(
    (processId: number) => {
      cancelPending();
      algorithm.removeProcess(processId);
      syncState();
    },
    [algorithm, cancelPending, syncState],
  );

  const handleReset = useCallback(() => {
    cancelPending();
    algorithm.reset();
    setLogMessages([]);
    syncState();
  }, [algorithm, cancelPending, syncState]);

  const failedProcessIds = state.processes.filter(p => p.isFailed).map(p => p.id);

  return (
    <div className="bully-election-container">
      <div className="bully-election-header">
        <button className="back-to-menu-btn" onClick={() => navigate('/')}>
          ← Retour
        </button>
        <h1>Bully Algorithm</h1>
        <p>Simulation d'élection dans les systèmes distribués</p>
      </div>

      <div className="bully-election-content">
        {/* Gauche — Contrôles */}
        <div className="bully-election-left">
          <Controls
            currentLeader={state.currentLeader}
            onStartElection={handleStartElection}
            onSimulateFailure={handleSimulateFailure}
            onRecoverProcess={handleRecoverProcess}
            onReset={handleReset}
            failedProcesses={failedProcessIds}
            allProcessIds={algorithm.getAllProcessIds()}
            totalCount={algorithm.getProcessCount()}
          />
        </div>

        {/* Centre — Graphe */}
        <div className="bully-election-center">
          <ProcessGraph
            processes={state.processes}
            messages={state.messages}
            currentLeader={state.currentLeader}
            onAddProcess={handleAddProcess}
            onRemoveProcess={handleRemoveProcess}
          />
        </div>

        {/* Droite — Journal */}
        <div className="bully-election-right">
          <MessageLog messages={logMessages} />
        </div>
      </div>
    </div>
  );
};

export default BullyElectionApp;