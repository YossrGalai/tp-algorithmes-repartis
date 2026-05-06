import React, { useState } from 'react';

interface ControlsProps {
  currentLeader: number | null;
  onStartElection: (processId: number) => void;
  onSimulateFailure: (processId: number) => void;
  onRecoverProcess: (processId: number) => void;
  onReset: () => void;
  failedProcesses: number[];
  allProcessIds: number[];
  totalCount: number;
}

export const Controls: React.FC<ControlsProps> = ({
  currentLeader,
  onStartElection,
  onSimulateFailure,
  onRecoverProcess,
  onReset,
  failedProcesses,
  allProcessIds,
  totalCount,
}) => {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const activeCount = allProcessIds.filter(id => !failedProcesses.includes(id)).length;
  const selectedProcess = selectedId !== null ? allProcessIds.find(id => id === selectedId) : undefined;
  const isFailed = selectedId !== null && failedProcesses.includes(selectedId);

  const handleSelect = (id: number) => {
    setSelectedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="controls-container">
      <h3>Contrôles</h3>

      {/* Process selector */}
      <div className="control-section">
        <div className="control-group">
          <label>Sélectionner un processus</label>
          <div className="process-selector">
            {allProcessIds.map(id => (
              <button
                key={id}
                className={[
                  'process-btn',
                  selectedId === id ? 'selected' : '',
                  currentLeader === id ? 'leader' : '',
                  failedProcesses.includes(id) ? 'failed' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => handleSelect(id)}
              >
                P{id}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Actions for selected process */}
      {selectedId !== null && selectedProcess !== undefined && (
        <div className="control-section">
          <div className="control-group">
            <label>Actions — P{selectedId}</label>
            <div className="action-buttons">
              {!isFailed && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    onStartElection(selectedId);
                  }}
                >
                  Lancer une élection
                </button>
              )}

              {!isFailed ? (
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    onSimulateFailure(selectedId);
                    setSelectedId(null);
                  }}
                >
                  Simuler une panne
                </button>
              ) : (
                <button
                  className="btn btn-success"
                  onClick={() => {
                    onRecoverProcess(selectedId);
                    setSelectedId(null);
                  }}
                >
                  Réparer le processus
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="info-section">
        <h4>Statistiques</h4>
        <div className="info-item">
          <span>Total</span>
          <strong>{totalCount}</strong>
        </div>
        <div className="info-item">
          <span>Actifs</span>
          <strong>{activeCount}</strong>
        </div>
        <div className="info-item">
          <span>En panne</span>
          <strong>{failedProcesses.length}</strong>
        </div>
        <div className="info-item">
          <span>Leader</span>
          {currentLeader !== null ? (
            <span className="coordinator-badge">P{currentLeader}</span>
          ) : (
            <span className="no-leader">Aucun</span>
          )}
        </div>
      </div>

      {/* Reset */}
      <div className="control-section" style={{ marginTop: 'auto' }}>
        <button className="btn btn-reset" onClick={onReset}>
          Réinitialiser
        </button>
      </div>

      {/* Algorithm reminder */}
      <div className="algorithm-info">
        <h4>Principe</h4>
        <ul>
          <li>Un processus envoie ELECTION aux IDs supérieurs</li>
          <li>Les supérieurs répondent OK et lancent leur propre élection</li>
          <li>Le plus haut ID actif gagne et envoie COORDINATOR à tous</li>
        </ul>
      </div>
    </div>
  );
};
