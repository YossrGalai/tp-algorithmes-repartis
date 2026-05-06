import React, { useState, useCallback } from 'react';
import { BullyAlgorithm } from './bullyAlgorithm.ts';
import { ProcessGraph } from './ProcessGraph.tsx';
import { MessageLog } from './MessageLog.tsx';
import { Controls } from './Controls.tsx';
import type { SimulationState } from './types.ts';
import './styles.css';

const BullyElectionApp: React.FC = () => {
  const [algorithm] = useState(() => new BullyAlgorithm(5));
  const [state, setState] = useState<SimulationState>(algorithm.getState());
  const [failedProcesses, setFailedProcesses] = useState<number[]>([]);

  const updateState = useCallback(() => {
    setState(algorithm.getState());
    setFailedProcesses(algorithm.getState().processes.filter((p) => p.isFailed).map((p) => p.id));
  }, [algorithm]);

  const handleStartElection = useCallback((processId: number) => {
    algorithm.startElection(processId);
    updateState();
  }, [algorithm, updateState]);

  const handleSimulateFailure = useCallback((processId: number) => {
    algorithm.simulateProcessFailure(processId);
    updateState();
  }, [algorithm, updateState]);

  const handleRecoverProcess = useCallback((processId: number) => {
    algorithm.recoverProcess(processId);
    updateState();
  }, [algorithm, updateState]);

  const handleReset = useCallback(() => {
    algorithm.reset();
    updateState();
  }, [algorithm, updateState]);

  return (
    <div className="bully-election-container">
      <div className="bully-election-header">
        <h1>🎯 Simulation du Bully Algorithm</h1>
        <p>Algorithme d'élection dans les systèmes distribués</p>
      </div>

      <div className="bully-election-content">
        <div className="bully-election-left">
          <Controls
            processCount={algorithm.getProcessCount()}
            currentLeader={state.currentLeader}
            onStartElection={handleStartElection}
            onSimulateFailure={handleSimulateFailure}
            onRecoverProcess={handleRecoverProcess}
            onReset={handleReset}
            failedProcesses={failedProcesses}
          />
        </div>

        <div className="bully-election-center">
          <ProcessGraph
            processes={state.processes}
            messages={state.messages}
            currentLeader={state.currentLeader}
          />
        </div>

        <div className="bully-election-right">
          <MessageLog messages={state.messages} messageLog={state.messageLog} />
        </div>
      </div>
    </div>
  );
};

export default BullyElectionApp;
